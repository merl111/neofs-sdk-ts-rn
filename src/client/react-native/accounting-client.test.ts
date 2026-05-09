import { describe, it, expect, vi } from 'vitest';

import { NeoFsV2Accounting } from '../../gen-grpc-react-native/accounting/types_types';
import {
  BalanceResponseImpl,
  BalanceResponse_BodyImpl,
} from '../../gen-grpc-react-native/accounting/service_types';
import { NeoFsV2Status } from '../../gen-grpc-react-native/status/types_types';
import { ReactNativeAccountingClient } from './accounting-client';
import { createTestClientConfig } from '../../test/test-signer';
import { asGrpcClient } from '../../test/grpc-stub';
import { okResponseMeta } from '../../test/ok-meta';

describe('ReactNativeAccountingClient', () => {
  it('returns balance from Balance RPC', async () => {
    const unaryCall = vi.fn().mockImplementation(async (path: string) => {
      expect(path).toContain('AccountingService/Balance');
      const res = new BalanceResponseImpl({
        MetaHeader: okResponseMeta(),
        Body: new BalanceResponse_BodyImpl({
          Balance: new NeoFsV2Accounting.DecimalImpl({ Value: 9001n, Precision: 4 }),
        }),
      });
      return { data: res.serializeBinary() };
    });

    const client = new ReactNativeAccountingClient(
      asGrpcClient({ unaryCall }),
      createTestClientConfig(),
    );

    const bal = await client.getBalance();
    expect(bal.value).toBe(9001n);
    expect(bal.precision).toBe(4);
  });

  it('throws NeoFSError when meta reports failure', async () => {
    const unaryCall = vi.fn().mockResolvedValue({
      data: new BalanceResponseImpl({
        MetaHeader: okResponseMeta({
          Status: new NeoFsV2Status.StatusImpl({ Code: 77, Message: 'boom' }),
        }),
        Body: new BalanceResponse_BodyImpl({}),
      }).serializeBinary(),
    });

    const client = new ReactNativeAccountingClient(
      asGrpcClient({ unaryCall }),
      createTestClientConfig(),
    );

    await expect(client.balance()).rejects.toMatchObject({
      code: 77,
    });
    expect(unaryCall.mock.calls.length).toBe(1);
  });
});
