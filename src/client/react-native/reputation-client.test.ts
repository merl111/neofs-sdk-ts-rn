import { describe, it, expect, vi } from 'vitest';

import { AnnounceLocalTrustResponseImpl } from '../../gen-grpc-react-native/reputation/service_types';

import { asGrpcClient } from '../../test/grpc-stub';
import { createTestClientConfig } from '../../test/test-signer';

import { ReactNativeReputationClient } from './reputation-client';

describe('ReactNativeReputationClient', () => {
  it('announceTrust maps peers and invokes unary RPC', async () => {
    const unaryCall = vi.fn().mockResolvedValue({
      data: new AnnounceLocalTrustResponseImpl({}).serializeBinary(),
    });

    const grpc = asGrpcClient({ unaryCall });

    const client = new ReactNativeReputationClient(grpc, createTestClientConfig());

    await client.announceTrust(15n, [
      {
        peer: new Uint8Array([1, 2, 9]),
        value: 0.75,
      },
    ]);

    expect(unaryCall).toHaveBeenCalledWith(
      'neo.fs.v2.reputation.ReputationService/AnnounceLocalTrust',
      expect.any(Uint8Array),
    );
  });
});
