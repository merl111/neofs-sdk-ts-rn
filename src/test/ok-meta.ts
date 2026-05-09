import { NeoFsV2Session } from '../gen-grpc-react-native/session/types_types';

/** Successful NeoFS response meta (status omitted). */
export function okResponseMeta(
  overrides: Partial<NeoFsV2Session.ResponseMetaHeader> = {},
): NeoFsV2Session.ResponseMetaHeaderImpl {
  return new NeoFsV2Session.ResponseMetaHeaderImpl({
    Epoch: 0n,
    Ttl: 2,
    ...overrides,
  });
}
