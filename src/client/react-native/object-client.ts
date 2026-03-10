/**
 * React Native compatible NeoFS Object client.
 */

import { GrpcClient } from 'grpc-react-native';
import { publicKeyBytes, tzHash } from 'neofs-sdk-ts-core/crypto';
import { sha256 } from 'neofs-sdk-ts-core/utils';
import { ObjectID, ContainerID, Address } from 'neofs-sdk-ts-core/types';

import { NeoFsV2Refs } from '../../gen-grpc-react-native/refs/types_types';
import { NeoFsV2Object } from '../../gen-grpc-react-native/object/types_types';
import { ObjectServiceClient } from '../../gen-grpc-react-native/object/service_services';
import {
  GetRequestImpl,
  GetRequest_BodyImpl,
  HeadRequestImpl,
  HeadRequest_BodyImpl,
  DeleteRequestImpl,
  DeleteRequest_BodyImpl,
  SearchRequestImpl,
  SearchRequest_BodyImpl,
  SearchV2RequestImpl,
  SearchV2Request_BodyImpl,
  PutRequestImpl,
  PutRequest_BodyImpl,
  PutRequest_Body_InitImpl,
  GetRangeRequestImpl,
  GetRangeRequest_BodyImpl,
  RangeImpl,
  GetRangeHashRequestImpl,
  GetRangeHashRequest_BodyImpl,
  ReplicateRequestImpl,
} from '../../gen-grpc-react-native/object/service_types';

import { BaseServiceClient } from './base-client';
import {
  ReactNativeClientConfig,
  ObjectAttribute,
  ObjectInfo,
  ObjectData,
  ObjectPutOptions,
  SearchOptions,
  SearchV2Options,
  SearchV2Result,
  ObjectType,
  ChecksumType,
} from './types';

/**
 * React Native compatible NeoFS Object client.
 */
export class ReactNativeObjectClient extends BaseServiceClient {
  private serviceClient: ObjectServiceClient;

  constructor(grpcClient: GrpcClient, config: ReactNativeClientConfig) {
    super(config);
    this.serviceClient = new ObjectServiceClient(grpcClient);
  }

  // ----------------------
  // User-Friendly API
  // ----------------------

  /**
   * Upload an object to NeoFS.
   */
  async upload(options: ObjectPutOptions): Promise<Uint8Array> {
    const attributes: ObjectAttribute[] = [...(options.attributes || [])];

    if (options.filename) {
      attributes.push({ key: 'FileName', value: options.filename });
    }

    if (options.contentType) {
      attributes.push({ key: 'ContentType', value: options.contentType });
    }

    attributes.push({ key: 'Timestamp', value: Math.floor(Date.now() / 1000).toString() });

    const result = await this.put(
      { value: options.containerId },
      options.payload,
      attributes,
      options.chunkSize
    );

    return result.value;
  }

  /**
   * Download an object from NeoFS.
   */
  async download(containerId: Uint8Array, objectId: Uint8Array): Promise<ObjectData> {
    const result = await this.get({
      containerId: { value: containerId },
      objectId: { value: objectId },
    });

    return {
      info: result.header ? this.headerToObjectInfo(result.header, objectId) : {
        objectId,
        containerId,
        ownerId: new Uint8Array(),
        creationEpoch: 0n,
        payloadSize: BigInt(result.payload.length),
        objectType: ObjectType.REGULAR,
        attributes: [],
      },
      payload: result.payload,
    };
  }

  /**
   * Get object metadata without downloading payload.
   */
  async getInfo(containerId: Uint8Array, objectId: Uint8Array): Promise<ObjectInfo | undefined> {
    const header = await this.head({
      containerId: { value: containerId },
      objectId: { value: objectId },
    });

    return header ? this.headerToObjectInfo(header, objectId) : undefined;
  }

  /**
   * Delete an object.
   */
  async remove(containerId: Uint8Array, objectId: Uint8Array): Promise<Uint8Array> {
    const result = await this.delete({
      containerId: { value: containerId },
      objectId: { value: objectId },
    });
    return result.objectId.value;
  }

  /**
   * Search for objects in a container.
   */
  async find(options: SearchOptions): Promise<Uint8Array[]> {
    const filters = (options.filters || []).map(f => ({
      key: f.key,
      value: f.value,
      matchType: f.matchType as number,
    }));

    const results = await this.search({ value: options.containerId }, filters);
    return results.map(r => r.value);
  }

  /**
   * Search for objects with pagination.
   */
  async findPaginated(options: SearchV2Options): Promise<SearchV2Result> {
    const filters = (options.filters || []).map(f => ({
      key: f.key,
      value: f.value,
      matchType: f.matchType as number,
    }));

    const results = await this.searchV2(
      { value: options.containerId },
      filters,
      options.cursor,
      options.limit
    );

    return {
      objects: results.results.map(r => ({
        objectId: r.id.value,
        attributes: r.attributes,
      })),
      cursor: results.cursor,
    };
  }

  /**
   * Download a range of bytes from an object.
   */
  async downloadRange(
    containerId: Uint8Array,
    objectId: Uint8Array,
    offset: bigint,
    length: bigint
  ): Promise<Uint8Array> {
    return this.getRange(
      { containerId: { value: containerId }, objectId: { value: objectId } },
      offset,
      length
    );
  }

  // ----------------------
  // Raw Proto API
  // ----------------------

  /**
   * Get an object by address (server streaming)
   */
  async get(address: Address, raw: boolean = false): Promise<{ header?: NeoFsV2Object.Header; payload: Uint8Array }> {
    const body = new GetRequest_BodyImpl({
      Address: new NeoFsV2Refs.AddressImpl({
        ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: address.containerId.value }),
        ObjectId: new NeoFsV2Refs.ObjectIDImpl({ Value: address.objectId.value }),
      }),
      Raw: raw,
    });
    const metaHeader = this.createMetaHeader();

    const request = new GetRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const chunks: Uint8Array[] = [];
    let header: NeoFsV2Object.Header | undefined = undefined;

    for await (const response of this.serviceClient.get(request)) {
      if (response.Body?.Init) {
        header = response.Body.Init.Header;
      }
      if (response.Body?.Chunk) {
        chunks.push(response.Body.Chunk);
      }
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const payload = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      payload.set(chunk, offset);
      offset += chunk.length;
    }

    return { header, payload };
  }

  /**
   * Put an object (client streaming)
   */
  async put(
    containerId: ContainerID,
    payload: Uint8Array,
    attributes?: ObjectAttribute[],
    chunkSize: number = 1024 * 1024
  ): Promise<ObjectID> {
    // Calculate payload checksum (SHA256)
    const payloadChecksum = sha256(payload);
    
    // Calculate homomorphic hash (Tillich-Zémor)
    const homomorphicHash = tzHash(payload);

    // Create header with both checksums
    const header = new NeoFsV2Object.HeaderImpl({
      ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: containerId.value }),
      OwnerId: this.getOwnerID(),
      PayloadLength: BigInt(payload.length),
      PayloadHash: new NeoFsV2Refs.ChecksumImpl({
        Type: NeoFsV2Refs.ChecksumType.ChecksumType_SHA256,
        Sum: payloadChecksum,
      }),
      HomomorphicHash: new NeoFsV2Refs.ChecksumImpl({
        Type: NeoFsV2Refs.ChecksumType.ChecksumType_TZ,
        Sum: homomorphicHash,
      }),
      ObjectType: NeoFsV2Object.ObjectType.ObjectType_REGULAR,
      Attributes: (attributes || []).map(attr => 
        new NeoFsV2Object.Header_AttributeImpl({ Key: attr.key, Value: attr.value })
      ),
    });

    // Calculate object ID = SHA256(serialized header)
    const headerBytes = header.serializeBinary();
    const objectIdBytes = sha256(headerBytes);
    const objectId = new NeoFsV2Refs.ObjectIDImpl({ Value: objectIdBytes });

    // Sign the object ID (protobuf-serialized form, not raw bytes)
    const objectIdSerialized = objectId.serializeBinary();
    const objectIdSignature = this.config.signer.sign(objectIdSerialized);

    const initBody = new PutRequest_Body_InitImpl({
      ObjectId: objectId,
      Signature: new NeoFsV2Refs.SignatureImpl({
        Key: publicKeyBytes(this.config.signer.public()),
        Sign: objectIdSignature,
        Scheme: this.config.signer.scheme() as unknown as NeoFsV2Refs.SignatureScheme,
      }),
      Header: header,
      CopiesNumber: 0,
    });

    const initRequestBody = new PutRequest_BodyImpl({
      Init: initBody,
    });

    const self = this;
    async function* generateRequests(): AsyncGenerator<PutRequestImpl> {
      const initMetaHeader = self.createMetaHeader();
      yield new PutRequestImpl({
        Body: initRequestBody,
        MetaHeader: initMetaHeader,
        VerifyHeader: self.createVerificationHeader(initRequestBody.serializeBinary(), initMetaHeader),
      });

      for (let offset = 0; offset < payload.length; offset += chunkSize) {
        const chunk = payload.slice(offset, Math.min(offset + chunkSize, payload.length));
        const chunkBody = new PutRequest_BodyImpl({ Chunk: chunk });
        const chunkMetaHeader = self.createMetaHeader();
        yield new PutRequestImpl({
          Body: chunkBody,
          MetaHeader: chunkMetaHeader,
          VerifyHeader: self.createVerificationHeader(chunkBody.serializeBinary(), chunkMetaHeader),
        });
      }
    }

    const response = await this.serviceClient.put(generateRequests());
    this.checkResponseStatus(response.MetaHeader);
    return { value: response.Body?.ObjectId?.Value || new Uint8Array() };
  }

  /**
   * Get object head (metadata only)
   */
  async head(address: Address, raw: boolean = false): Promise<NeoFsV2Object.Header | undefined> {
    const body = new HeadRequest_BodyImpl({
      Address: new NeoFsV2Refs.AddressImpl({
        ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: address.containerId.value }),
        ObjectId: new NeoFsV2Refs.ObjectIDImpl({ Value: address.objectId.value }),
      }),
      Raw: raw,
    });
    const metaHeader = this.createMetaHeader();

    const request = new HeadRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.head(request);
    return response.Body?.Header?.Header;
  }

  /**
   * Delete an object
   */
  async delete(address: Address): Promise<Address> {
    const body = new DeleteRequest_BodyImpl({
      Address: new NeoFsV2Refs.AddressImpl({
        ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: address.containerId.value }),
        ObjectId: new NeoFsV2Refs.ObjectIDImpl({ Value: address.objectId.value }),
      }),
    });
    const metaHeader = this.createMetaHeader();

    const request = new DeleteRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.delete(request);
    
    return {
      containerId: { value: response.Body?.Tombstone?.ContainerId?.Value || new Uint8Array() },
      objectId: { value: response.Body?.Tombstone?.ObjectId?.Value || new Uint8Array() },
    };
  }

  /**
   * Search for objects (server streaming)
   */
  async search(containerId: ContainerID, filters?: Array<{ key: string; value: string; matchType: number }>): Promise<ObjectID[]> {
    const body = new SearchRequest_BodyImpl({
      ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: containerId.value }),
      Version: 1,
      Filters: (filters || []).map(f => new NeoFsV2Object.SearchFilterImpl({
        Key: f.key,
        Value: f.value,
        MatchType: f.matchType,
      })),
    });
    const metaHeader = this.createMetaHeader();

    const request = new SearchRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const objectIds: ObjectID[] = [];

    for await (const response of this.serviceClient.search(request)) {
      if (response.Body?.IdList) {
        for (const id of response.Body.IdList) {
          objectIds.push({ value: id.Value || new Uint8Array() });
        }
      }
    }

    return objectIds;
  }

  /**
   * Search V2 for objects (unary, paginated)
   */
  async searchV2(
    containerId: ContainerID,
    filters?: Array<{ key: string; value: string; matchType: number }>,
    cursor?: string,
    count?: number
  ): Promise<{ results: Array<{ id: ObjectID; attributes: string[] }>; cursor: string }> {
    const body = new SearchV2Request_BodyImpl({
      ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: containerId.value }),
      Version: 1,
      Filters: (filters || []).map(f => new NeoFsV2Object.SearchFilterImpl({
        Key: f.key,
        Value: f.value,
        MatchType: f.matchType,
      })),
      Cursor: cursor || '',
      Count: count || 100,
    });
    const metaHeader = this.createMetaHeader();

    const request = new SearchV2RequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.searchV2(request);

    return {
      results: (response.Body?.Result || []).map(r => ({
        id: { value: r.Id?.Value || new Uint8Array() },
        attributes: r.Attributes || [],
      })),
      cursor: response.Body?.Cursor || '',
    };
  }

  /**
   * Get a range of object data (server streaming)
   */
  async getRange(address: Address, offset: bigint, length: bigint, raw: boolean = false): Promise<Uint8Array> {
    const body = new GetRangeRequest_BodyImpl({
      Address: new NeoFsV2Refs.AddressImpl({
        ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: address.containerId.value }),
        ObjectId: new NeoFsV2Refs.ObjectIDImpl({ Value: address.objectId.value }),
      }),
      Range: new RangeImpl({ Offset: offset, Length: length }),
      Raw: raw,
    });
    const metaHeader = this.createMetaHeader();

    const request = new GetRangeRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const chunks: Uint8Array[] = [];

    for await (const response of this.serviceClient.getRange(request)) {
      if (response.Body?.Chunk) {
        chunks.push(response.Body.Chunk);
      }
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let resultOffset = 0;
    for (const chunk of chunks) {
      result.set(chunk, resultOffset);
      resultOffset += chunk.length;
    }

    return result;
  }

  /**
   * Get hash of object range
   */
  async getRangeHash(
    address: Address,
    ranges: Array<{ offset: bigint; length: bigint }>,
    salt?: Uint8Array,
    checksumType: ChecksumType = ChecksumType.SHA256
  ): Promise<Uint8Array[]> {
    const body = new GetRangeHashRequest_BodyImpl({
      Address: new NeoFsV2Refs.AddressImpl({
        ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: address.containerId.value }),
        ObjectId: new NeoFsV2Refs.ObjectIDImpl({ Value: address.objectId.value }),
      }),
      Ranges: ranges.map(r => new RangeImpl({ Offset: r.offset, Length: r.length })),
      Salt: salt || new Uint8Array(),
      Type: checksumType as number,
    });
    const metaHeader = this.createMetaHeader();

    const request = new GetRangeHashRequestImpl({
      Body: body,
      MetaHeader: metaHeader,
      VerifyHeader: this.createVerificationHeader(body.serializeBinary(), metaHeader),
    });

    const response = await this.serviceClient.getRangeHash(request);
    return response.Body?.HashList || [];
  }

  /**
   * Replicate object to another node
   */
  async replicate(object: NeoFsV2Object.Object, signature: NeoFsV2Refs.Signature): Promise<{ status: number }> {
    const request = new ReplicateRequestImpl({ Object: object, Signature: signature });
    const response = await this.serviceClient.replicate(request);
    return { status: response.Status?.Code || 0 };
  }
}
