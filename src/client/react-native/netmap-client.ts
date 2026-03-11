/**
 * React Native compatible NeoFS Netmap client.
 */

import { GrpcClient } from '@merl1231/grpc-react-native';

import { NeoFsV2Refs } from '../../gen-grpc-react-native/refs/types_types';
import { NeoFsV2Netmap } from '../../gen-grpc-react-native/netmap/types_types';
import { NetmapServiceClient } from '../../gen-grpc-react-native/netmap/service_services';
import {
  LocalNodeInfoRequestImpl,
  LocalNodeInfoRequest_BodyImpl,
  NetworkInfoRequestImpl,
  NetworkInfoRequest_BodyImpl,
  NetmapSnapshotRequestImpl,
  NetmapSnapshotRequest_BodyImpl,
} from '../../gen-grpc-react-native/netmap/service_types';

import { BaseServiceClient } from './base-client';
import {
  ReactNativeClientConfig,
  NodeInfo,
  NetworkInfo,
  LocalNodeInfo,
  NodeState,
} from './types';

/**
 * React Native compatible NeoFS Netmap client.
 */
export class ReactNativeNetmapClient extends BaseServiceClient {
  private serviceClient: NetmapServiceClient;

  constructor(grpcClient: GrpcClient, config: ReactNativeClientConfig) {
    super(config);
    this.serviceClient = new NetmapServiceClient(grpcClient);
  }

  // ----------------------
  // User-Friendly API
  // ----------------------

  /**
   * Get information about the local node.
   */
  async getLocalNode(): Promise<LocalNodeInfo> {
    const result = await this.localNodeInfo();
    return {
      version: {
        major: result.version?.Major || 0,
        minor: result.version?.Minor || 0,
      },
      node: this.nodeInfoToFriendly(result.nodeInfo),
    };
  }

  /**
   * Get network information.
   */
  async getNetwork(): Promise<NetworkInfo> {
    const result = await this.networkInfo();
    if (!result) {
      return {
        currentEpoch: 0n,
        magicNumber: 0n,
        msPerBlock: 0n,
        config: new Map(),
      };
    }

    const config = new Map<string, Uint8Array>();
    for (const param of result.NetworkConfig?.Parameters || []) {
      if (param.Key && param.Key.length > 0) {
        const keyStr = this.decodeUtf8(param.Key);
        config.set(keyStr, param.Value || new Uint8Array());
      }
    }

    return {
      currentEpoch: result.CurrentEpoch || 0n,
      magicNumber: result.MagicNumber || 0n,
      msPerBlock: result.MsPerBlock || 0n,
      config,
    };
  }

  /**
   * Get all nodes in the network.
   */
  async getNodes(): Promise<NodeInfo[]> {
    const result = await this.netmapSnapshot();
    if (!result?.Nodes) return [];

    return result.Nodes.map(n => this.nodeInfoToFriendly(n));
  }

  /**
   * Get current epoch number.
   */
  async getCurrentEpoch(): Promise<bigint> {
    const network = await this.getNetwork();
    return network.currentEpoch;
  }

  private nodeInfoToFriendly(node?: NeoFsV2Netmap.NodeInfo): NodeInfo {
    return {
      publicKey: node?.PublicKey || new Uint8Array(),
      addresses: node?.Addresses || [],
      state: (node?.State || 0) as NodeState,
      attributes: (node?.Attributes || []).map(a => ({
        key: a.Key || '',
        value: a.Value || '',
      })),
    };
  }

  // ----------------------
  // Raw Proto API
  // ----------------------

  /**
   * Get local node information
   */
  async localNodeInfo(): Promise<{ version: NeoFsV2Refs.Version | undefined; nodeInfo: NeoFsV2Netmap.NodeInfo | undefined }> {
    const body = new LocalNodeInfoRequest_BodyImpl({});
    const metaHeader = this.createMetaHeader();

    const request = new LocalNodeInfoRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.localNodeInfo(request);
    this.checkResponseStatus(response.MetaHeader);
    return {
      version: response.Body?.Version,
      nodeInfo: response.Body?.NodeInfo,
    };
  }

  /**
   * Get network information
   */
  async networkInfo(): Promise<NeoFsV2Netmap.NetworkInfo | undefined> {
    const body = new NetworkInfoRequest_BodyImpl({});
    const metaHeader = this.createMetaHeader();

    const request = new NetworkInfoRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.networkInfo(request);
    this.checkResponseStatus(response.MetaHeader);
    return response.Body?.NetworkInfo;
  }

  /**
   * Get network map snapshot
   */
  async netmapSnapshot(): Promise<NeoFsV2Netmap.Netmap | undefined> {
    const body = new NetmapSnapshotRequest_BodyImpl({});
    const metaHeader = this.createMetaHeader();

    const request = new NetmapSnapshotRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.netmapSnapshot(request);
    this.checkResponseStatus(response.MetaHeader);
    return response.Body?.Netmap;
  }

  /**
   * Decode UTF-8 bytes to string (React Native compatible).
   */
  private decodeUtf8(bytes: Uint8Array): string {
    let result = '';
    let i = 0;
    while (i < bytes.length) {
      const byte1 = bytes[i++];
      if (byte1 < 0x80) {
        result += String.fromCharCode(byte1);
      } else if ((byte1 & 0xE0) === 0xC0) {
        const byte2 = bytes[i++] & 0x3F;
        result += String.fromCharCode(((byte1 & 0x1F) << 6) | byte2);
      } else if ((byte1 & 0xF0) === 0xE0) {
        const byte2 = bytes[i++] & 0x3F;
        const byte3 = bytes[i++] & 0x3F;
        result += String.fromCharCode(((byte1 & 0x0F) << 12) | (byte2 << 6) | byte3);
      } else if ((byte1 & 0xF8) === 0xF0) {
        const byte2 = bytes[i++] & 0x3F;
        const byte3 = bytes[i++] & 0x3F;
        const byte4 = bytes[i++] & 0x3F;
        const codePoint = ((byte1 & 0x07) << 18) | (byte2 << 12) | (byte3 << 6) | byte4;
        result += String.fromCharCode(0xD800 + ((codePoint - 0x10000) >> 10), 0xDC00 + ((codePoint - 0x10000) & 0x3FF));
      }
    }
    return result;
  }
}
