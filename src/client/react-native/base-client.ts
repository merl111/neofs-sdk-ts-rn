/**
 * Base service client with common functionality.
 */

import { publicKeyBytes } from '@axlabs/neofs-sdk-ts-core/crypto';
import { ownerIdFromPublicKey } from '@axlabs/neofs-sdk-ts-core/user';
import { NeoFsV2Refs } from '../../gen-grpc-react-native/refs/types_types';
import { NeoFsV2Session } from '../../gen-grpc-react-native/session/types_types';
import { NeoFsV2Object } from '../../gen-grpc-react-native/object/types_types';
import { NeoFsV2Container } from '../../gen-grpc-react-native/container/types_types';
import { NeoFsV2Netmap } from '../../gen-grpc-react-native/netmap/types_types';
import { NeoFsV2Status } from '../../gen-grpc-react-native/status/types_types';
import { NeoFsV2Acl } from '../../gen-grpc-react-native/acl/types_types';

import {
  ReactNativeClientConfig,
  ObjectInfo,
  ObjectType,
  ContainerInfo,
  ObjectAttribute,
} from './types';

/**
 * Options that can be passed to API methods.
 */
export interface RequestOptions {
  /** Bearer token for delegated access */
  bearerToken?: Uint8Array | NeoFsV2Acl.BearerToken;
  /** Session token */
  sessionToken?: NeoFsV2Session.SessionToken;
}

/**
 * NeoFS error class that contains status code and message.
 */
export class NeoFSError extends Error {
  public readonly code: number;
  public readonly statusMessage: string;

  constructor(code: number, message: string) {
    super(`NeoFS error (code ${code}): ${message}`);
    this.name = 'NeoFSError';
    this.code = code;
    this.statusMessage = message;
  }
}

/**
 * Base class with common functionality for all service clients.
 */
export abstract class BaseServiceClient {
  protected config: ReactNativeClientConfig;

  constructor(config: ReactNativeClientConfig) {
    this.config = config;
  }

  /**
   * Create request meta header
   */
  protected createMetaHeader(options?: RequestOptions): NeoFsV2Session.RequestMetaHeaderImpl {
    const header = new NeoFsV2Session.RequestMetaHeaderImpl({
      Version: new NeoFsV2Refs.VersionImpl({ Major: 2, Minor: 18 }),
      Ttl: 2,
    });

    // Add bearer token if provided
    if (options?.bearerToken) {
      if (options.bearerToken instanceof Uint8Array) {
        // Deserialize from bytes
        header.BearerToken = NeoFsV2Acl.BearerTokenImpl.deserializeBinary(options.bearerToken);
      } else {
        header.BearerToken = options.bearerToken;
      }
    }

    // Add session token if provided
    if (options?.sessionToken) {
      header.SessionToken = options.sessionToken;
    }

    return header;
  }

  /**
   * Create verification header with proper signatures.
   * NeoFS requires:
   * - BodySignature: signature of the serialized request body
   * - MetaSignature: signature of the serialized meta header
   * - OriginSignature: signature of the origin verification header (empty if no origin)
   */
  protected createVerificationHeader(
    bodyBytes: Uint8Array,
    metaHeader: NeoFsV2Session.RequestMetaHeaderImpl
  ): NeoFsV2Session.RequestVerificationHeaderImpl {
    const pubKey = publicKeyBytes(this.config.signer.public());
    const scheme = this.config.signer.scheme() as unknown as NeoFsV2Refs.SignatureScheme;

    // Sign the body
    const bodySignature = this.config.signer.sign(bodyBytes);

    // Sign the serialized meta header
    const metaBytes = metaHeader.serializeBinary();
    const metaSignature = this.config.signer.sign(metaBytes);

    // For origin signature, we sign an empty byte array (no origin header)
    const originSignature = this.config.signer.sign(new Uint8Array(0));

    return new NeoFsV2Session.RequestVerificationHeaderImpl({
      BodySignature: new NeoFsV2Refs.SignatureImpl({
        Key: pubKey,
        Sign: bodySignature,
        Scheme: scheme,
      }),
      MetaSignature: new NeoFsV2Refs.SignatureImpl({
        Key: pubKey,
        Sign: metaSignature,
        Scheme: scheme,
      }),
      OriginSignature: new NeoFsV2Refs.SignatureImpl({
        Key: pubKey,
        Sign: originSignature,
        Scheme: scheme,
      }),
    });
  }

  /**
   * Get owner ID from signer public key.
   * The owner ID is a 25-byte value derived from the public key:
   * - 1 byte: NEO address prefix (0x35)
   * - 20 bytes: script hash (RIPEMD160(SHA256(verification_script)))
   * - 4 bytes: checksum
   */
  protected getOwnerID(): NeoFsV2Refs.OwnerIDImpl {
    const pubKey = publicKeyBytes(this.config.signer.public());
    const ownerId = ownerIdFromPublicKey(pubKey);
    return new NeoFsV2Refs.OwnerIDImpl({ Value: ownerId });
  }

  /**
   * Convert proto header to user-friendly ObjectInfo
   */
  protected headerToObjectInfo(header: NeoFsV2Object.Header, objectId?: Uint8Array): ObjectInfo {
    return {
      objectId: objectId || new Uint8Array(),
      containerId: header.ContainerId?.Value || new Uint8Array(),
      ownerId: header.OwnerId?.Value || new Uint8Array(),
      creationEpoch: header.CreationEpoch || 0n,
      payloadSize: header.PayloadLength || 0n,
      payloadChecksum: header.PayloadHash?.Sum,
      objectType: (header.ObjectType || 0) as ObjectType,
      attributes: (header.Attributes || []).map(a => ({
        key: a.Key || '',
        value: a.Value || '',
      })),
      parentId: header.Split?.Parent?.Value,
      splitId: header.Split?.SplitId,
    };
  }

  /**
   * Convert proto container to user-friendly ContainerInfo
   */
  protected containerToInfo(container: NeoFsV2Container.Container, containerId?: Uint8Array): ContainerInfo {
    const attributes: ObjectAttribute[] = (container.Attributes || []).map(a => ({
      key: a.Key || '',
      value: a.Value || '',
    }));

    const nameAttr = attributes.find(a => a.key === 'Name');
    const timestampAttr = attributes.find(a => a.key === 'Timestamp');

    return {
      containerId: containerId || new Uint8Array(),
      ownerId: container.OwnerId?.Value || new Uint8Array(),
      basicAcl: container.BasicAcl || 0,
      attributes,
      name: nameAttr?.value,
      createdAt: timestampAttr ? new Date(parseInt(timestampAttr.value, 10) * 1000) : undefined,
      placementPolicy: this.policyToString(container.PlacementPolicy),
    };
  }

  /**
   * Convert placement policy to string description
   */
  protected policyToString(policy?: NeoFsV2Netmap.PlacementPolicy): string | undefined {
    if (!policy?.Replicas?.length) return undefined;
    return policy.Replicas.map(r => `REP ${r.Count}`).join(' ');
  }

  /**
   * Check response status and throw NeoFSError if not successful.
   * Status code 0 means success. Any other code is an error.
   */
  protected checkResponseStatus(metaHeader?: NeoFsV2Session.ResponseMetaHeader): void {
    const status = metaHeader?.Status;
    if (status && status.Code !== 0) {
      throw new NeoFSError(status.Code, status.Message || 'Unknown error');
    }
  }
}
