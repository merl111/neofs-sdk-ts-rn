/**
 * User-friendly type definitions for the React Native NeoFS client.
 */

import { Signer } from '@axlabs/neofs-sdk-ts-core/crypto';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the React Native NeoFS client.
 */
export interface ReactNativeClientConfig {
  /** gRPC host (without port) */
  host: string;
  /** gRPC port */
  port: number;
  /** Use TLS */
  useTls?: boolean;
  /** Signer for authentication */
  signer: Signer;
  /** Request timeout in milliseconds */
  timeout?: number;
}

// ============================================================================
// Enums
// ============================================================================

/**
 * Basic ACL presets for containers.
 */
export enum BasicACL {
  /** Private container - only owner has full access */
  PRIVATE = 0x1C8C8CCC,
  /** Public read - anyone can read, only owner can write */
  PUBLIC_READ = 0x1FBF8CFF,
  /** Public read-write - anyone can read and write */
  PUBLIC_READ_WRITE = 0x1FBFBFFF,
  /** Public append - anyone can read and append, only owner can delete */
  PUBLIC_APPEND = 0x1FBF9FFF,
}

/**
 * Search filter match types.
 */
export enum MatchType {
  /** String equality */
  STRING_EQUAL = 0,
  /** String not equal */
  STRING_NOT_EQUAL = 1,
  /** Key not present */
  NOT_PRESENT = 2,
  /** Common prefix */
  COMMON_PREFIX = 3,
  /** Numeric greater than */
  NUM_GT = 4,
  /** Numeric greater than or equal */
  NUM_GE = 5,
  /** Numeric less than */
  NUM_LT = 6,
  /** Numeric less than or equal */
  NUM_LE = 7,
}

/**
 * Checksum types.
 */
export enum ChecksumType {
  UNKNOWN = 0,
  /** Tillich-Zémor homomorphic hash */
  TZ = 1,
  /** SHA-256 */
  SHA256 = 2,
}

/**
 * Object type.
 */
export enum ObjectType {
  REGULAR = 0,
  TOMBSTONE = 1,
  STORAGE_GROUP = 2,
  LOCK = 3,
  LINK = 4,
}

/**
 * Node state.
 */
export enum NodeState {
  UNSPECIFIED = 0,
  ONLINE = 1,
  OFFLINE = 2,
  MAINTENANCE = 3,
}

// ============================================================================
// Data Interfaces
// ============================================================================

/**
 * Object attribute.
 */
export interface ObjectAttribute {
  key: string;
  value: string;
}

/**
 * Object header information (user-friendly).
 */
export interface ObjectInfo {
  /** Object ID */
  objectId: Uint8Array;
  /** Container ID */
  containerId: Uint8Array;
  /** Owner ID */
  ownerId: Uint8Array;
  /** Creation epoch */
  creationEpoch: bigint;
  /** Payload size in bytes */
  payloadSize: bigint;
  /** Payload checksum (SHA-256) */
  payloadChecksum?: Uint8Array;
  /** Object type */
  objectType: ObjectType;
  /** Object attributes */
  attributes: ObjectAttribute[];
  /** Parent object ID (for split objects) */
  parentId?: Uint8Array;
  /** Split ID (for split objects) */
  splitId?: Uint8Array;
}

/**
 * Object with payload.
 */
export interface ObjectData {
  /** Object metadata */
  info: ObjectInfo;
  /** Object payload */
  payload: Uint8Array;
}

/**
 * Container information (user-friendly).
 */
export interface ContainerInfo {
  /** Container ID */
  containerId: Uint8Array;
  /** Owner ID */
  ownerId: Uint8Array;
  /** Basic ACL value */
  basicAcl: number;
  /** Container attributes */
  attributes: ObjectAttribute[];
  /** Container name (from attributes) */
  name?: string;
  /** Creation timestamp (from attributes) */
  createdAt?: Date;
  /** Placement policy description */
  placementPolicy?: string;
}

/**
 * Container creation options.
 */
export interface ContainerCreateOptions {
  /** Basic ACL preset or custom value */
  basicAcl?: BasicACL | number;
  /** Placement policy (e.g., "REP 2 IN X CBF 3 SELECT 2 FROM * AS X") */
  placementPolicy?: string;
  /** Container attributes (key-value pairs) */
  attributes?: ObjectAttribute[];
  /** Container name (convenience, adds Name attribute) */
  name?: string;
  /** Nonce for container (random 16 bytes if not provided) */
  nonce?: Uint8Array;
}

/**
 * Object upload options.
 */
export interface ObjectPutOptions {
  /** Container to upload to */
  containerId: Uint8Array;
  /** Object payload */
  payload: Uint8Array;
  /** Object attributes */
  attributes?: ObjectAttribute[];
  /** Filename (convenience, adds FileName attribute) */
  filename?: string;
  /** Content type (convenience, adds ContentType attribute) */
  contentType?: string;
  /** Chunk size for streaming (default 1MB) */
  chunkSize?: number;
}

/**
 * Search filter for objects.
 */
export interface SearchFilter {
  /** Attribute key to match */
  key: string;
  /** Value to match */
  value: string;
  /** Match type */
  matchType: MatchType;
}

/**
 * Search options.
 */
export interface SearchOptions {
  /** Container to search in */
  containerId: Uint8Array;
  /** Filters to apply */
  filters?: SearchFilter[];
}

/**
 * Paginated search options.
 */
export interface SearchV2Options extends SearchOptions {
  /** Cursor for pagination */
  cursor?: string;
  /** Maximum results to return */
  limit?: number;
  /** Attributes to return with results */
  attributes?: string[];
}

/**
 * Search result item.
 */
export interface SearchResult {
  /** Object ID */
  objectId: Uint8Array;
  /** Requested attributes */
  attributes?: string[];
}

/**
 * Paginated search results.
 */
export interface SearchV2Result {
  /** Found objects */
  objects: SearchResult[];
  /** Cursor for next page (empty if no more results) */
  cursor: string;
}

/**
 * Network node information.
 */
export interface NodeInfo {
  /** Node public key */
  publicKey: Uint8Array;
  /** Node addresses */
  addresses: string[];
  /** Node state */
  state: NodeState;
  /** Node attributes */
  attributes: ObjectAttribute[];
}

/**
 * Network information.
 */
export interface NetworkInfo {
  /** Current epoch */
  currentEpoch: bigint;
  /** Magic number (network ID) */
  magicNumber: bigint;
  /** Milliseconds per block */
  msPerBlock: bigint;
  /** Network configuration parameters */
  config: Map<string, Uint8Array>;
}

/**
 * Local node information.
 */
export interface LocalNodeInfo {
  /** Node version */
  version: { major: number; minor: number };
  /** Node info */
  node: NodeInfo;
}

/**
 * Balance information.
 */
export interface Balance {
  /** Balance value (in smallest units) */
  value: bigint;
  /** Decimal precision */
  precision: number;
}

/**
 * Session token.
 */
export interface SessionToken {
  /** Session ID */
  id: Uint8Array;
  /** Session public key */
  sessionKey: Uint8Array;
}

/**
 * Trust value for reputation.
 */
export interface Trust {
  /** Peer public key */
  peer: Uint8Array;
  /** Trust value (0.0 to 1.0) */
  value: number;
}
