/**
 * React Native compatible NeoFS Session client.
 */

import { publicKeyBytes } from '@axlabs/neofs-sdk-ts-core/crypto';
import { GrpcClient } from '@merl1231/grpc-react-native';

import { NeoFsV2Refs } from '../../gen-grpc-react-native/refs/types_types';
import { SessionServiceClient } from '../../gen-grpc-react-native/session/service_services';
import {
  CreateRequestImpl as SessionCreateRequestImpl,
  CreateRequest_BodyImpl as SessionCreateRequest_BodyImpl,
} from '../../gen-grpc-react-native/session/service_types';
import { NeoFsV2Session } from '../../gen-grpc-react-native/session/types_types';

import { BaseServiceClient } from './base-client';
import { ReactNativeClientConfig, SessionToken } from './types';

/** Re-export for app code building container session delegations. */
export import ContainerSessionContext_Verb = NeoFsV2Session.ContainerSessionContext_Verb;

/**
 * React Native compatible NeoFS Session client.
 */
export class ReactNativeSessionClient extends BaseServiceClient {
  private serviceClient: SessionServiceClient;

  constructor(grpcClient: GrpcClient, config: ReactNativeClientConfig) {
    super(config);
    this.serviceClient = new SessionServiceClient(grpcClient);
  }

  /**
   * Create a session token (user-friendly).
   * @param expirationEpoch - Epoch when the session expires
   */
  async createSession(expirationEpoch: bigint): Promise<SessionToken> {
    return this.create(expirationEpoch);
  }

  /**
   * Create a session token (raw API).
   */
  async create(expiration: bigint): Promise<SessionToken> {
    const body = new SessionCreateRequest_BodyImpl({
      OwnerId: this.getOwnerID(),
      Expiration: expiration,
    });
    const metaHeader = this.createMetaHeader();

    const request = new SessionCreateRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.create(request);
    return {
      id: response.Body?.Id || new Uint8Array(),
      sessionKey: response.Body?.SessionKey || new Uint8Array(),
    };
  }

  /**
   * Build and sign a container session token that delegates a container verb
   * to a third party identified by `delegatePublicKey`.
   *
   * Unlike object session tokens, container sessions don't need Session.Create
   * — the token is self-contained. The `SessionKey` field identifies who is
   * authorized to USE the token; it must be the delegate's (e.g. backend's)
   * compressed public key, NOT this client's key.
   *
   * @param verb              - CONTAINER_PUT or CONTAINER_SETEACL
   * @param delegatePublicKey - compressed public key (33 bytes) of the party
   *                            that will use this token (e.g. backend server)
   * @param sessionExpirationEpoch - epoch when the token expires
   * @param lifetimeEpoch          - current epoch (iat/nbf)
   */
  async createSignedContainerSessionToken(
    verb: NeoFsV2Session.ContainerSessionContext_Verb,
    delegatePublicKey: Uint8Array,
    sessionExpirationEpoch: bigint,
    lifetimeEpoch: bigint,
  ): Promise<Uint8Array> {
    const idBytes = new Uint8Array(16);
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
      globalThis.crypto.getRandomValues(idBytes);
    } else {
      for (let i = 0; i < 16; i++) {
        idBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    // RFC 4122 UUID v4: set version (byte 6) and variant (byte 8)
    idBytes[6] = (idBytes[6] & 0x0f) | 0x40;
    idBytes[8] = (idBytes[8] & 0x3f) | 0x80;

    const body = new NeoFsV2Session.SessionToken_BodyImpl({
      Id: idBytes,
      OwnerId: this.getOwnerID(),
      Lifetime: new NeoFsV2Session.SessionToken_Body_TokenLifetimeImpl({
        Iat: lifetimeEpoch,
        Nbf: lifetimeEpoch,
        Exp: sessionExpirationEpoch,
      }),
      SessionKey: delegatePublicKey,
      Container: new NeoFsV2Session.ContainerSessionContextImpl({
        Verb: verb,
        Wildcard: true,
      }),
    });

    const bodyBytes = body.serializeBinary();
    const bodySig = this.config.signer.sign(bodyBytes);
    const pubKey = publicKeyBytes(this.config.signer.public());
    const scheme = this.config.signer.scheme() as unknown as NeoFsV2Refs.SignatureScheme;

    const token = new NeoFsV2Session.SessionTokenImpl({
      Body: body,
      Signature: new NeoFsV2Refs.SignatureImpl({
        Key: pubKey,
        Sign: bodySig,
        Scheme: scheme,
      }),
    });

    return token.serializeBinary();
  }
}
