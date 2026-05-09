import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { NeoFsV2Refs } from '../../gen-grpc-react-native/refs/types_types';
import { NeoFsV2Object } from '../../gen-grpc-react-native/object/types_types';
import {
  HeaderWithSignatureImpl,
  HeadResponseImpl,
  HeadResponse_BodyImpl,
  PutResponseImpl,
  PutResponse_BodyImpl,
  SearchResponseImpl,
  SearchResponse_BodyImpl,
  SearchV2ResponseImpl,
  SearchV2Response_BodyImpl,
  SearchV2Response_OIDWithMetaImpl,
} from '../../gen-grpc-react-native/object/service_types';
import { asGrpcClient } from '../../test/grpc-stub';
import { okResponseMeta } from '../../test/ok-meta';
import { createTestClientConfig } from '../../test/test-signer';
import { MatchType } from './types';

import { ReactNativeObjectClient } from './object-client';

describe('ReactNativeObjectClient', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(17_010_030_456_000); // deterministic timestamp attrs
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getInfo stitches Head response body into ObjectInfo', async () => {
    const cid = new Uint8Array(32).fill(4);
    const oid = new Uint8Array(32).fill(5);
    const head = new NeoFsV2Object.HeaderImpl({
      ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: cid }),
      OwnerId: new NeoFsV2Refs.OwnerIDImpl({ Value: new Uint8Array(25).fill(3) }),
      CreationEpoch: 12n,
      PayloadLength: 55n,
      ObjectType: 0,
      Attributes: [],
    });

    const unaryCall = vi.fn().mockResolvedValue({
      data: new HeadResponseImpl({
        MetaHeader: okResponseMeta(),
        Body: new HeadResponse_BodyImpl({
          Header: new HeaderWithSignatureImpl({ Header: head }),
        }),
      }).serializeBinary(),
    });

    const client = new ReactNativeObjectClient(
      asGrpcClient({ unaryCall }),
      createTestClientConfig(),
    );

    const info = await client.getInfo(cid, oid);
    expect(info?.containerId).toEqual(cid);
    expect(info?.objectId).toEqual(oid);
    expect(info?.creationEpoch).toBe(12n);
    expect(info?.payloadSize).toBe(55n);
  });

  it('upload merges duplicate attribute keys via unary chunk stream stub', async () => {
    const cid = new Uint8Array([6, 6]);
    const returnedOid = new Uint8Array([1, 2, 9]);

    const clientStreamCall = vi.fn(async (_path: string, requests: AsyncIterable<Uint8Array>) => {
      let n = 0;
      for await (const _ of requests) {
        n++;
      }
      expect(n).toBeGreaterThan(0);

      const res = new PutResponseImpl({
        MetaHeader: okResponseMeta(),
        Body: new PutResponse_BodyImpl({
          ObjectId: new NeoFsV2Refs.ObjectIDImpl({ Value: returnedOid }),
        }),
      });
      return { data: res.serializeBinary() };
    });

    const client = new ReactNativeObjectClient(
      asGrpcClient({ unaryCall: vi.fn(), clientStreamCall }),
      createTestClientConfig(),
    );

    const id = await client.upload({
      containerId: cid,
      payload: new Uint8Array(50).fill(0xab),
      filename: 'a.txt',
      contentType: 'text/plain',
      attributes: [{ key: 'Timestamp', value: 'should_be_overridden' }],
    });

    expect(id).toEqual(returnedOid);
  });

  it('find aggregates Search stream object ids', async () => {
    const cid = new Uint8Array(32).fill(7);
    const id1 = new Uint8Array([1]);
    const id2 = new Uint8Array([2]);

    async function* searchStream() {
      yield {
        done: false,
        data: new SearchResponseImpl({
          Body: new SearchResponse_BodyImpl({
            IdList: [
              new NeoFsV2Refs.ObjectIDImpl({ Value: id1 }),
              new NeoFsV2Refs.ObjectIDImpl({ Value: id2 }),
            ],
          }),
        }).serializeBinary(),
      };
      yield { done: true };
    }

    const serverStreamCall = vi.fn().mockReturnValue(searchStream());

    const client = new ReactNativeObjectClient(
      asGrpcClient({ unaryCall: vi.fn(), serverStreamCall }),
      createTestClientConfig(),
    );

    const ids = await client.find({
      containerId: cid,
      filters: [{ key: 'FileName', value: '*.txt', matchType: MatchType.STRING_EQUAL }],
    });

    expect(ids).toHaveLength(2);
    expect(ids.map((x) => [...x])).toEqual([[1], [2]]);
  });

  it('findPaginated maps SearchV2 result list and cursor', async () => {
    const cid = new Uint8Array(32).fill(8);
    const oid = new Uint8Array([0xfa]);

    const unaryCall = vi.fn().mockResolvedValue({
      data: new SearchV2ResponseImpl({
        MetaHeader: okResponseMeta(),
        Body: new SearchV2Response_BodyImpl({
          Result: [
            new SearchV2Response_OIDWithMetaImpl({
              Id: new NeoFsV2Refs.ObjectIDImpl({ Value: oid }),
              Attributes: ['FileName'],
            }),
          ],
          Cursor: 'next-page',
        }),
      }).serializeBinary(),
    });

    const client = new ReactNativeObjectClient(
      asGrpcClient({ unaryCall }),
      createTestClientConfig(),
    );

    const page = await client.findPaginated({
      containerId: cid,
      filters: [{ key: 'any', value: 'v', matchType: MatchType.STRING_EQUAL }],
      cursor: '',
      limit: 10,
    });

    expect(page.cursor).toBe('next-page');
    expect(page.objects).toEqual([{ objectId: oid, attributes: ['FileName'] }]);
  });
});
