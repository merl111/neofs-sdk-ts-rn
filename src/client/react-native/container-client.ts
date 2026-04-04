/**
 * React Native compatible NeoFS Container client.
 */

import { GrpcClient } from '@merl1231/grpc-react-native';
import { publicKeyBytes } from '@axlabs/neofs-sdk-ts-core/crypto';
import { sha256 } from '@axlabs/neofs-sdk-ts-core/utils';
import { ContainerID } from '@axlabs/neofs-sdk-ts-core/types';

import { NeoFsV2Refs } from '../../gen-grpc-react-native/refs/types_types';
import { NeoFsV2Container } from '../../gen-grpc-react-native/container/types_types';
import { NeoFsV2Acl } from '../../gen-grpc-react-native/acl/types_types';
import { NeoFsV2Netmap } from '../../gen-grpc-react-native/netmap/types_types';
import { ContainerServiceClient } from '../../gen-grpc-react-native/container/service_services';
import {
  PutRequestImpl as ContainerPutRequestImpl,
  PutRequest_BodyImpl as ContainerPutRequest_BodyImpl,
  GetRequestImpl as ContainerGetRequestImpl,
  GetRequest_BodyImpl as ContainerGetRequest_BodyImpl,
  DeleteRequestImpl as ContainerDeleteRequestImpl,
  DeleteRequest_BodyImpl as ContainerDeleteRequest_BodyImpl,
  ListRequestImpl as ContainerListRequestImpl,
  ListRequest_BodyImpl as ContainerListRequest_BodyImpl,
  SetExtendedACLRequestImpl,
  SetExtendedACLRequest_BodyImpl,
  GetExtendedACLRequestImpl,
  GetExtendedACLRequest_BodyImpl,
  AnnounceUsedSpaceRequestImpl,
  AnnounceUsedSpaceRequest_BodyImpl,
  AnnounceUsedSpaceRequest_Body_AnnouncementImpl,
  SetAttributeRequestImpl,
  SetAttributeRequest_BodyImpl,
  SetAttributeRequest_Body_ParametersImpl,
  RemoveAttributeRequestImpl,
  RemoveAttributeRequest_BodyImpl,
  RemoveAttributeRequest_Body_ParametersImpl,
} from '../../gen-grpc-react-native/container/service_types';

import { BaseServiceClient } from './base-client';
import {
  ReactNativeClientConfig,
  ContainerInfo,
  ContainerCreateOptions,
  BasicACL,
} from './types';

/**
 * React Native compatible NeoFS Container client.
 */
export class ReactNativeContainerClient extends BaseServiceClient {
  private serviceClient: ContainerServiceClient;

  constructor(grpcClient: GrpcClient, config: ReactNativeClientConfig) {
    super(config);
    this.serviceClient = new ContainerServiceClient(grpcClient);
  }

  // ----------------------
  // User-Friendly API
  // ----------------------

  /**
   * Create a new container.
   */
  async create(options: ContainerCreateOptions = {}): Promise<Uint8Array> {
    const {
      basicAcl = BasicACL.PRIVATE,
      placementPolicy = 'REP 2',
      attributes = [],
      name,
      nonce,
    } = options;

    const containerAttributes: NeoFsV2Container.Container_AttributeImpl[] = [];
    
    if (name) {
      containerAttributes.push(new NeoFsV2Container.Container_AttributeImpl({
        Key: 'Name',
        Value: name,
      }));
    }

    containerAttributes.push(new NeoFsV2Container.Container_AttributeImpl({
      Key: 'Timestamp',
      Value: Math.floor(Date.now() / 1000).toString(),
    }));

    for (const attr of attributes) {
      containerAttributes.push(new NeoFsV2Container.Container_AttributeImpl({
        Key: attr.key,
        Value: attr.value,
      }));
    }

    const containerNonce = nonce || this.generateNonce();
    const policy = this.parsePlacementPolicy(placementPolicy);

    const container = new NeoFsV2Container.ContainerImpl({
      Version: new NeoFsV2Refs.VersionImpl({ Major: 2, Minor: 18 }),
      OwnerId: this.getOwnerID(),
      Nonce: containerNonce,
      BasicAcl: basicAcl,
      Attributes: containerAttributes,
      PlacementPolicy: policy,
    });

    // Sign the serialized container data
    const containerBytes = container.serializeBinary();
    const containerSignature = new NeoFsV2Refs.SignatureRFC6979Impl({
      Key: publicKeyBytes(this.config.signer.public()),
      Sign: this.config.signer.sign(containerBytes),
    });

    const result = await this.put(container, containerSignature);
    // NeoFS container ID is SHA-256 of the marshaled container. Some nodes return
    // an empty ContainerId in PutResponse; derive it locally (matches neofs-sdk-go cid.NewFromMarshalledContainer).
    const id = result.value;
    if (!id || id.length === 0) {
      return sha256(containerBytes);
    }
    return id;
  }

  /**
   * Get container information.
   */
  async getInfo(containerId: Uint8Array): Promise<ContainerInfo | undefined> {
    const container = await this.get({ value: containerId });
    return container ? this.containerToInfo(container, containerId) : undefined;
  }

  /**
   * Delete a container.
   */
  async remove(containerId: Uint8Array): Promise<void> {
    await this.delete({ value: containerId });
  }

  /**
   * List all containers for the current owner.
   */
  async listAll(): Promise<Uint8Array[]> {
    const results = await this.list();
    return results.map(r => r.value);
  }

  /**
   * List containers with full information.
   */
  async listWithInfo(): Promise<ContainerInfo[]> {
    const containerIds = await this.list();
    const infos: ContainerInfo[] = [];

    for (const id of containerIds) {
      const info = await this.getInfo(id.value);
      if (info) {
        infos.push(info);
      }
    }

    return infos;
  }

  // ----------------------
  // Helper Methods
  // ----------------------

  /**
   * Generate a UUID v4 nonce (16 bytes).
   * UUID v4 format requires:
   * - Byte 6: version 4 (high nibble = 0x40)
   * - Byte 8: variant 1 (high bits = 0x80)
   */
  private generateNonce(): Uint8Array {
    const nonce = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      nonce[i] = Math.floor(Math.random() * 256);
    }
    // Set version to 4 (UUID v4)
    nonce[6] = (nonce[6] & 0x0f) | 0x40;
    // Set variant to 1 (RFC 4122)
    nonce[8] = (nonce[8] & 0x3f) | 0x80;
    return nonce;
  }

  private parsePlacementPolicy(policy: string): NeoFsV2Netmap.PlacementPolicyImpl {
    const repMatch = policy.match(/REP\s+(\d+)/i);
    const replicas: NeoFsV2Netmap.ReplicaImpl[] = [];

    if (repMatch) {
      replicas.push(new NeoFsV2Netmap.ReplicaImpl({
        Count: parseInt(repMatch[1], 10),
        Selector: '',
      }));
    }

    return new NeoFsV2Netmap.PlacementPolicyImpl({
      Replicas: replicas,
      ContainerBackupFactor: 0,
      Selectors: [],
      Filters: [],
    });
  }

  // ----------------------
  // Raw Proto API
  // ----------------------

  /**
   * Create a new container using the raw proto API.
   */
  async put(container: NeoFsV2Container.Container, signature?: NeoFsV2Refs.SignatureRFC6979): Promise<ContainerID> {
    const body = new ContainerPutRequest_BodyImpl({
      Container: container,
      Signature: signature,
    });
    const metaHeader = this.createMetaHeader();

    const request = new ContainerPutRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.put(request);
    this.checkResponseStatus(response.MetaHeader);
    return { value: response.Body?.ContainerId?.Value || new Uint8Array() };
  }

  /**
   * Get container by ID
   */
  async get(containerId: ContainerID): Promise<NeoFsV2Container.Container | undefined> {
    const body = new ContainerGetRequest_BodyImpl({
      ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: containerId.value }),
    });
    const metaHeader = this.createMetaHeader();

    const request = new ContainerGetRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.get(request);
    this.checkResponseStatus(response.MetaHeader);
    return response.Body?.Container;
  }

  /**
   * Delete a container.
   * The container ID must be signed for deletion.
   */
  async delete(containerId: ContainerID, signature?: NeoFsV2Refs.SignatureRFC6979): Promise<void> {
    // Sign the container ID if no signature provided
    // The signature is over the raw container ID bytes (not the serialized protobuf)
    const idSignature = signature || new NeoFsV2Refs.SignatureRFC6979Impl({
      Key: publicKeyBytes(this.config.signer.public()),
      Sign: this.config.signer.sign(containerId.value),
    });

    const body = new ContainerDeleteRequest_BodyImpl({
      ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: containerId.value }),
      Signature: idSignature,
    });
    const metaHeader = this.createMetaHeader();

    const request = new ContainerDeleteRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.delete(request);
    this.checkResponseStatus(response.MetaHeader);
  }

  /**
   * List containers for an owner
   */
  async list(ownerId?: Uint8Array): Promise<ContainerID[]> {
    const body = new ContainerListRequest_BodyImpl({
      OwnerId: ownerId 
        ? new NeoFsV2Refs.OwnerIDImpl({ Value: ownerId })
        : this.getOwnerID(),
    });
    const metaHeader = this.createMetaHeader();

    const request = new ContainerListRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.list(request);
    this.checkResponseStatus(response.MetaHeader);
    return (response.Body?.ContainerIds || []).map(id => ({
      value: id.Value || new Uint8Array(),
    }));
  }

  /**
   * Set extended ACL for a container
   */
  async setExtendedACL(eacl: NeoFsV2Acl.EACLTable, signature?: NeoFsV2Refs.SignatureRFC6979): Promise<void> {
    const body = new SetExtendedACLRequest_BodyImpl({
      Eacl: eacl,
      Signature: signature,
    });
    const metaHeader = this.createMetaHeader();

    const request = new SetExtendedACLRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.setExtendedACL(request);
    this.checkResponseStatus(response.MetaHeader);
  }

  /**
   * Get extended ACL for a container
   */
  async getExtendedACL(containerId: ContainerID): Promise<NeoFsV2Acl.EACLTable | undefined> {
    const body = new GetExtendedACLRequest_BodyImpl({
      ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: containerId.value }),
    });
    const metaHeader = this.createMetaHeader();

    const request = new GetExtendedACLRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.getExtendedACL(request);
    this.checkResponseStatus(response.MetaHeader);
    return response.Body?.Eacl;
  }

  /**
   * Announce used space for containers
   */
  async announceUsedSpace(announcements: Array<{ containerId: ContainerID; usedSpace: bigint; epoch: bigint }>): Promise<void> {
    const body = new AnnounceUsedSpaceRequest_BodyImpl({
      Announcements: announcements.map(a => new AnnounceUsedSpaceRequest_Body_AnnouncementImpl({
        ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: a.containerId.value }),
        UsedSpace: a.usedSpace,
        Epoch: a.epoch,
      })),
    });
    const metaHeader = this.createMetaHeader();

    const request = new AnnounceUsedSpaceRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.announceUsedSpace(request);
    this.checkResponseStatus(response.MetaHeader);
  }

  /**
   * Set container attribute
   */
  async setAttribute(containerId: ContainerID, attribute: string, value: string, validUntil?: bigint): Promise<void> {
    const parameters = new SetAttributeRequest_Body_ParametersImpl({
      ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: containerId.value }),
      Attribute: attribute,
      Value: value,
      ValidUntil: validUntil || 0n,
    });

    const body = new SetAttributeRequest_BodyImpl({ Parameters: parameters });

    const bodyBytes = body.serializeBinary();
    const bodySignature = new NeoFsV2Refs.SignatureImpl({
      Key: publicKeyBytes(this.config.signer.public()),
      Sign: this.config.signer.sign(bodyBytes),
      Scheme: this.config.signer.scheme() as unknown as NeoFsV2Refs.SignatureScheme,
    });

    const request = new SetAttributeRequestImpl({ Body: body, BodySignature: bodySignature });
    const response = await this.serviceClient.setAttribute(request);
    const status = response.Status;
    if (status && status.Code !== 0) {
      const { NeoFSError } = await import('./base-client');
      throw new NeoFSError(status.Code, status.Message || 'Unknown error');
    }
  }

  /**
   * Remove container attribute
   */
  async removeAttribute(containerId: ContainerID, attribute: string, validUntil?: bigint): Promise<void> {
    const parameters = new RemoveAttributeRequest_Body_ParametersImpl({
      ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: containerId.value }),
      Attribute: attribute,
      ValidUntil: validUntil || 0n,
    });

    const body = new RemoveAttributeRequest_BodyImpl({ Parameters: parameters });

    const bodyBytes = body.serializeBinary();
    const bodySignature = new NeoFsV2Refs.SignatureImpl({
      Key: publicKeyBytes(this.config.signer.public()),
      Sign: this.config.signer.sign(bodyBytes),
      Scheme: this.config.signer.scheme() as unknown as NeoFsV2Refs.SignatureScheme,
    });

    const request = new RemoveAttributeRequestImpl({ Body: body, BodySignature: bodySignature });
    const response = await this.serviceClient.removeAttribute(request);
    const status = response.Status;
    if (status && status.Code !== 0) {
      const { NeoFSError } = await import('./base-client');
      throw new NeoFSError(status.Code, status.Message || 'Unknown error');
    }
  }
}
