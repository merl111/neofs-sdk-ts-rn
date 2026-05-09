import { describe, it, expect, vi } from 'vitest';

import {
  GetResponseImpl,
  GetResponse_BodyImpl,
  PutResponseImpl,
  PutResponse_BodyImpl,
} from '../../gen-grpc-react-native/container/service_types';
import { NeoFsV2Refs } from '../../gen-grpc-react-native/refs/types_types';
import { NeoFsV2Container } from '../../gen-grpc-react-native/container/types_types';
import { NeoFsV2Netmap } from '../../gen-grpc-react-native/netmap/types_types';

import { asGrpcClient } from '../../test/grpc-stub';
import { okResponseMeta } from '../../test/ok-meta';
import { createTestClientConfig } from '../../test/test-signer';
import { BasicACL } from './types';

import { ReactNativeContainerClient } from './container-client';

describe('ReactNativeContainerClient', () => {
  it('create derives container id when PutResponse cid is absent', async () => {
    const unaryCall = vi.fn().mockImplementation(async (path: string) => {
      expect(path).toContain('/Put');
      return {
        data: new PutResponseImpl({
          MetaHeader: okResponseMeta(),
          Body: new PutResponse_BodyImpl({}),
        }).serializeBinary(),
      };
    });

    const client = new ReactNativeContainerClient(
      asGrpcClient({ unaryCall }),
      createTestClientConfig(),
    );

    const cid = await client.create({
      nonce: new Uint8Array(16).fill(0xbc),
      name: 'documents',
      basicAcl: BasicACL.PUBLIC_READ,
      placementPolicy: 'REP 7',
    });

    expect(cid.byteLength).toBe(32);
    expect(unaryCall).toHaveBeenCalled();
  });

  it('create returns server cid when present', async () => {
    const serverBytes = new Uint8Array(Array.from({ length: 16 }, (_, i) => i));
    const unaryCall = vi.fn().mockResolvedValue({
      data: new PutResponseImpl({
        MetaHeader: okResponseMeta(),
        Body: new PutResponse_BodyImpl({
          ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: serverBytes }),
        }),
      }).serializeBinary(),
    });

    const client = new ReactNativeContainerClient(
      asGrpcClient({ unaryCall }),
      createTestClientConfig(),
    );

    await expect(
      client.create({
        nonce: new Uint8Array(16),
        placementPolicy: 'REP 1',
      }),
    ).resolves.toEqual(serverBytes);
  });

  it('getInfo maps protobuf container fields', async () => {
    const cid = new Uint8Array(32).fill(2);
    const ts = `${Math.floor(Date.now() / 1000)}`;
    const container = new NeoFsV2Container.ContainerImpl({
      Nonce: new Uint8Array(16),
      BasicAcl: 0xfe,
      Attributes: [
        new NeoFsV2Container.Container_AttributeImpl({
          Key: 'Name',
          Value: 'archives',
        }),
        new NeoFsV2Container.Container_AttributeImpl({
          Key: 'Timestamp',
          Value: ts,
        }),
      ],
      OwnerId: new NeoFsV2Refs.OwnerIDImpl({ Value: new Uint8Array(25).fill(9) }),
      PlacementPolicy: new NeoFsV2Netmap.PlacementPolicyImpl({
        Replicas: [
          new NeoFsV2Netmap.ReplicaImpl({ Count: 4 }),
          new NeoFsV2Netmap.ReplicaImpl({ Count: 1 }),
        ],
      }),
    });

    const unaryCall = vi.fn().mockResolvedValue({
      data: new GetResponseImpl({
        MetaHeader: okResponseMeta(),
        Body: new GetResponse_BodyImpl({ Container: container }),
      }).serializeBinary(),
    });

    const client = new ReactNativeContainerClient(
      asGrpcClient({ unaryCall }),
      createTestClientConfig(),
    );

    const info = await client.getInfo(cid);

    expect(info?.name).toBe('archives');
    expect(info?.placementPolicy).toBe('REP 4 REP 1');
    expect(info?.basicAcl).toBe(0xfe);
  });
});
