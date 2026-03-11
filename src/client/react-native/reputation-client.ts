/**
 * React Native compatible NeoFS Reputation client.
 */

import { GrpcClient } from '@merl1231/grpc-react-native';

import { NeoFsV2Reputation } from '../../gen-grpc-react-native/reputation/types_types';
import { ReputationServiceClient } from '../../gen-grpc-react-native/reputation/service_services';
import {
  AnnounceLocalTrustRequestImpl,
  AnnounceLocalTrustRequest_BodyImpl,
  AnnounceIntermediateResultRequestImpl,
  AnnounceIntermediateResultRequest_BodyImpl,
} from '../../gen-grpc-react-native/reputation/service_types';

import { BaseServiceClient } from './base-client';
import { ReactNativeClientConfig, Trust } from './types';

/**
 * React Native compatible NeoFS Reputation client.
 */
export class ReactNativeReputationClient extends BaseServiceClient {
  private serviceClient: ReputationServiceClient;

  constructor(grpcClient: GrpcClient, config: ReactNativeClientConfig) {
    super(config);
    this.serviceClient = new ReputationServiceClient(grpcClient);
  }

  /**
   * Announce trust values for peers (user-friendly).
   */
  async announceTrust(epoch: bigint, trusts: Trust[]): Promise<void> {
    const protoTrusts = trusts.map(t => new NeoFsV2Reputation.TrustImpl({
      Peer: new NeoFsV2Reputation.PeerIDImpl({ PublicKey: t.peer }),
      Value: t.value,
    }));

    await this.announceLocalTrust(epoch, protoTrusts);
  }

  /**
   * Announce local trust values (raw API).
   */
  async announceLocalTrust(epoch: bigint, trusts: NeoFsV2Reputation.Trust[]): Promise<void> {
    const body = new AnnounceLocalTrustRequest_BodyImpl({
      Epoch: epoch,
      Trusts: trusts,
    });
    const metaHeader = this.createMetaHeader();

    const request = new AnnounceLocalTrustRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    await this.serviceClient.announceLocalTrust(request);
  }

  /**
   * Announce intermediate result (raw API).
   */
  async announceIntermediateResult(epoch: bigint, iteration: number, trust: NeoFsV2Reputation.PeerToPeerTrust): Promise<void> {
    const body = new AnnounceIntermediateResultRequest_BodyImpl({
      Epoch: epoch,
      Iteration: iteration,
      Trust: trust,
    });
    const metaHeader = this.createMetaHeader();

    const request = new AnnounceIntermediateResultRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    await this.serviceClient.announceIntermediateResult(request);
  }
}
