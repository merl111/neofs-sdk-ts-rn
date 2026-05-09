import type { GrpcClient } from '@merl1231/grpc-react-native';

/**
 * Cast a hand-rolled mock object to {@link GrpcClient} for typed service clients.
 */
export function asGrpcClient(mock: Record<string, unknown>): GrpcClient {
  return mock as unknown as GrpcClient;
}
