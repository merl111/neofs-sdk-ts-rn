import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  CreateResponseImpl,
  CreateResponse_BodyImpl,
} from '../../gen-grpc-react-native/session/service_types';
import { NeoFsV2Session } from '../../gen-grpc-react-native/session/types_types';

import { asGrpcClient } from '../../test/grpc-stub';
import { okResponseMeta } from '../../test/ok-meta';
import { createTestClientConfig } from '../../test/test-signer';

import { ReactNativeSessionClient } from './session-client';

describe('ReactNativeSessionClient', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array): Uint8Array => {
        arr.fill(4);
        return arr;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('create maps session id fields from Create response', async () => {
    const sid = new Uint8Array([0xde, 0xad]);
    const sKey = new Uint8Array([0xbe, 0xef]);
    const unaryCall = vi.fn().mockResolvedValue({
      data: new CreateResponseImpl({
        MetaHeader: okResponseMeta(),
        Body: new CreateResponse_BodyImpl({
          Id: sid,
          SessionKey: sKey,
        }),
      }).serializeBinary(),
    });

    const client = new ReactNativeSessionClient(
      asGrpcClient({ unaryCall }),
      createTestClientConfig(),
    );

    const token = await client.createSession(500n);

    expect(token.id).toEqual(sid);
    expect(token.sessionKey).toEqual(sKey);
    expect(unaryCall).toHaveBeenCalled();
  });

  it('createSignedContainerSessionToken serializes delegated container session fields', async () => {
    const delegate = new Uint8Array(33).fill(8);
    const grpc = asGrpcClient({ unaryCall: vi.fn() });

    const client = new ReactNativeSessionClient(grpc, createTestClientConfig());

    const serialized = await client.createSignedContainerSessionToken(
      NeoFsV2Session.ContainerSessionContext_Verb.ContainerSessionContext_PUT,
      delegate,
      321n,
      100n,
    );

    const token = NeoFsV2Session.SessionTokenImpl.deserializeBinary(serialized);

    expect(token.Body?.SessionKey).toEqual(delegate);
    expect(token.Body?.Container?.Verb).toBe(
      NeoFsV2Session.ContainerSessionContext_Verb.ContainerSessionContext_PUT,
    );
    expect(token.Body?.Lifetime?.Exp).toBe(321n);
    expect(token.Signature?.Sign?.length).toBeGreaterThan(0);
  });
});
