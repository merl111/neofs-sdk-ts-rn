import { describe, it, expect, vi } from 'vitest';

import {
  LocalNodeInfoResponseImpl,
  LocalNodeInfoResponse_BodyImpl,
  NetworkInfoResponseImpl,
  NetworkInfoResponse_BodyImpl,
} from '../../gen-grpc-react-native/netmap/service_types';
import { NeoFsV2Refs } from '../../gen-grpc-react-native/refs/types_types';
import { NeoFsV2Netmap } from '../../gen-grpc-react-native/netmap/types_types';

import { asGrpcClient } from '../../test/grpc-stub';
import { okResponseMeta } from '../../test/ok-meta';
import { createTestClientConfig } from '../../test/test-signer';
import { NodeState } from './types';

import { ReactNativeNetmapClient } from './netmap-client';

describe('ReactNativeNetmapClient', () => {
  it('getLocalNode maps LocalNodeInfo payload', async () => {
    const unaryCall = vi.fn().mockResolvedValue({
      data: new LocalNodeInfoResponseImpl({
        MetaHeader: okResponseMeta(),
        Body: new LocalNodeInfoResponse_BodyImpl({
          Version: new NeoFsV2Refs.VersionImpl({ Major: 2, Minor: 17 }),
          NodeInfo: new NeoFsV2Netmap.NodeInfoImpl({
            PublicKey: new Uint8Array([1, 2, 3]),
            Addresses: ['grpc:8080'],
            State: NeoFsV2Netmap.NodeInfo_State.NodeInfo_ONLINE,
            Attributes: [new NeoFsV2Netmap.NodeInfo_AttributeImpl({ Key: 'role', Value: 'storage' })],
          }),
        }),
      }).serializeBinary(),
    });

    const client = new ReactNativeNetmapClient(
      asGrpcClient({ unaryCall }),
      createTestClientConfig(),
    );

    const local = await client.getLocalNode();
    expect(local.version).toEqual({ major: 2, minor: 17 });
    expect(local.node.publicKey).toEqual(new Uint8Array([1, 2, 3]));
    expect(local.node.state).toBe(NodeState.ONLINE);
    expect(local.node.attributes[0]).toEqual({ key: 'role', value: 'storage' });
  });

  it('getNetwork parses config parameters with UTF8 keys', async () => {
    const keyUtf8 = new TextEncoder().encode('café-parameter');
    const unaryCall = vi.fn().mockResolvedValue({
      data: new NetworkInfoResponseImpl({
        MetaHeader: okResponseMeta(),
        Body: new NetworkInfoResponse_BodyImpl({
          NetworkInfo: new NeoFsV2Netmap.NetworkInfoImpl({
            CurrentEpoch: 33n,
            MagicNumber: 44n,
            MsPerBlock: 15n,
            NetworkConfig: new NeoFsV2Netmap.NetworkConfigImpl({
              Parameters: [
                new NeoFsV2Netmap.NetworkConfig_ParameterImpl({
                  Key: keyUtf8,
                  Value: new Uint8Array([0xde]),
                }),
              ],
            }),
          }),
        }),
      }).serializeBinary(),
    });

    const client = new ReactNativeNetmapClient(
      asGrpcClient({ unaryCall }),
      createTestClientConfig(),
    );

    const nw = await client.getNetwork();

    expect(nw.currentEpoch).toBe(33n);
    expect(nw.magicNumber).toBe(44n);
    expect(nw.msPerBlock).toBe(15n);
    expect([...nw.config.entries()]).toEqual([['café-parameter', new Uint8Array([0xde])]]);
  });

  it('getNetwork yields empty defaults when response body missing', async () => {
    const unaryCall = vi.fn().mockResolvedValue({
      data: new NetworkInfoResponseImpl({
        MetaHeader: okResponseMeta(),
        Body: new NetworkInfoResponse_BodyImpl({}),
      }).serializeBinary(),
    });

    const client = new ReactNativeNetmapClient(
      asGrpcClient({ unaryCall }),
      createTestClientConfig(),
    );

    const nw = await client.getNetwork();
    expect(nw.currentEpoch).toBe(0n);
    expect(nw.config.size).toBe(0);
  });
});
