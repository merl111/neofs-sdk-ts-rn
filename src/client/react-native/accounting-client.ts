/**
 * React Native compatible NeoFS Accounting client.
 */

import { GrpcClient } from 'grpc-react-native';

import { NeoFsV2Refs } from '../../gen-grpc-react-native/refs/types_types';
import { AccountingServiceClient } from '../../gen-grpc-react-native/accounting/service_services';
import {
  BalanceRequestImpl,
  BalanceRequest_BodyImpl,
} from '../../gen-grpc-react-native/accounting/service_types';

import { BaseServiceClient } from './base-client';
import { ReactNativeClientConfig, Balance } from './types';

/**
 * React Native compatible NeoFS Accounting client.
 */
export class ReactNativeAccountingClient extends BaseServiceClient {
  private serviceClient: AccountingServiceClient;

  constructor(grpcClient: GrpcClient, config: ReactNativeClientConfig) {
    super(config);
    this.serviceClient = new AccountingServiceClient(grpcClient);
  }

  /**
   * Get account balance (user-friendly).
   */
  async getBalance(ownerId?: Uint8Array): Promise<Balance> {
    return this.balance(ownerId);
  }

  /**
   * Get account balance (raw API).
   */
  async balance(ownerId?: Uint8Array): Promise<Balance> {
    const body = new BalanceRequest_BodyImpl({
      OwnerId: ownerId 
        ? new NeoFsV2Refs.OwnerIDImpl({ Value: ownerId })
        : this.getOwnerID(),
    });
    const metaHeader = this.createMetaHeader();

    const request = new BalanceRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.balance(request);
    this.checkResponseStatus(response.MetaHeader);
    return {
      value: response.Body?.Balance?.Value || 0n,
      precision: response.Body?.Balance?.Precision || 0,
    };
  }
}
