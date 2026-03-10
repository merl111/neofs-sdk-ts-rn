/**
 * React Native compatible NeoFS Session client.
 */

import { GrpcClient } from 'grpc-react-native';

import { SessionServiceClient } from '../../gen-grpc-react-native/session/service_services';
import {
  CreateRequestImpl as SessionCreateRequestImpl,
  CreateRequest_BodyImpl as SessionCreateRequest_BodyImpl,
} from '../../gen-grpc-react-native/session/service_types';

import { BaseServiceClient } from './base-client';
import { ReactNativeClientConfig, SessionToken } from './types';

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
}
