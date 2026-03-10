# Types Reference

This document lists all types, interfaces, and enums exported by the NeoFS TypeScript SDK.

## Enums

### BasicACL

Access control presets for containers.

```typescript
enum BasicACL {
  /** Private container - only owner has full access */
  PRIVATE = 0x1C8C8CCC,
  
  /** Public read - anyone can read, only owner can write */
  PUBLIC_READ = 0x1FBF8CFF,
  
  /** Public read-write - anyone can read and write */
  PUBLIC_READ_WRITE = 0x1FBFBFFF,
  
  /** Public append - anyone can read and append, only owner can delete */
  PUBLIC_APPEND = 0x1FBF9FFF,
}
```

### MatchType

Search filter match types.

```typescript
enum MatchType {
  /** Exact string match */
  STRING_EQUAL = 0,
  
  /** String does not match */
  STRING_NOT_EQUAL = 1,
  
  /** Attribute key not present */
  NOT_PRESENT = 2,
  
  /** String starts with value */
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
```

### ChecksumType

Hash/checksum algorithms.

```typescript
enum ChecksumType {
  UNKNOWN = 0,
  
  /** Tillich-Zémor homomorphic hash */
  TZ = 1,
  
  /** SHA-256 */
  SHA256 = 2,
}
```

### ObjectType

Types of objects in NeoFS.

```typescript
enum ObjectType {
  /** Regular data object */
  REGULAR = 0,
  
  /** Tombstone marking deleted object */
  TOMBSTONE = 1,
  
  /** Storage group for object linking */
  STORAGE_GROUP = 2,
  
  /** Lock object preventing deletion */
  LOCK = 3,
  
  /** Link object for large object parts */
  LINK = 4,
}
```

### NodeState

Storage node states.

```typescript
enum NodeState {
  UNSPECIFIED = 0,
  
  /** Node is online and accepting requests */
  ONLINE = 1,
  
  /** Node is offline */
  OFFLINE = 2,
  
  /** Node is in maintenance mode */
  MAINTENANCE = 3,
}
```

## Configuration Interfaces

### ReactNativeClientConfig

Configuration for the NeoFS client.

```typescript
interface ReactNativeClientConfig {
  /** gRPC host (without port) */
  host: string;
  
  /** gRPC port */
  port: number;
  
  /** Use TLS (default: false) */
  useTls?: boolean;
  
  /** Signer for authentication */
  signer: Signer;
  
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}
```

## Object Types

### ObjectAttribute

Key-value attribute for objects and containers.

```typescript
interface ObjectAttribute {
  key: string;
  value: string;
}
```

### ObjectInfo

Object metadata.

```typescript
interface ObjectInfo {
  /** Object ID (32 bytes) */
  objectId: Uint8Array;
  
  /** Container ID (32 bytes) */
  containerId: Uint8Array;
  
  /** Owner ID (25 bytes) */
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
```

### ObjectData

Object with metadata and payload.

```typescript
interface ObjectData {
  /** Object metadata */
  info: ObjectInfo;
  
  /** Object payload */
  payload: Uint8Array;
}
```

### ObjectPutOptions

Options for uploading objects.

```typescript
interface ObjectPutOptions {
  /** Container to upload to */
  containerId: Uint8Array;
  
  /** Object payload */
  payload: Uint8Array;
  
  /** Object attributes */
  attributes?: ObjectAttribute[];
  
  /** Filename (adds FileName attribute) */
  filename?: string;
  
  /** Content type (adds ContentType attribute) */
  contentType?: string;
  
  /** Chunk size for streaming (default: 1MB) */
  chunkSize?: number;
}
```

## Container Types

### ContainerInfo

Container metadata.

```typescript
interface ContainerInfo {
  /** Container ID (32 bytes) */
  containerId: Uint8Array;
  
  /** Owner ID (25 bytes) */
  ownerId: Uint8Array;
  
  /** Basic ACL value */
  basicAcl: number;
  
  /** Container attributes */
  attributes: ObjectAttribute[];
  
  /** Container name (from Name attribute) */
  name?: string;
  
  /** Creation timestamp (from Timestamp attribute) */
  createdAt?: Date;
  
  /** Placement policy description */
  placementPolicy?: string;
}
```

### ContainerCreateOptions

Options for creating containers.

```typescript
interface ContainerCreateOptions {
  /** Basic ACL preset or custom value */
  basicAcl?: BasicACL | number;
  
  /** Placement policy (e.g., "REP 2 IN X CBF 3 SELECT 2 FROM * AS X") */
  placementPolicy?: string;
  
  /** Container attributes (key-value pairs) */
  attributes?: ObjectAttribute[];
  
  /** Container name (adds Name attribute) */
  name?: string;
  
  /** Nonce for container (random 16 bytes if not provided) */
  nonce?: Uint8Array;
}
```

## Search Types

### SearchFilter

Filter for object searches.

```typescript
interface SearchFilter {
  /** Attribute key to match */
  key: string;
  
  /** Value to match */
  value: string;
  
  /** Match type */
  matchType: MatchType;
}
```

### SearchOptions

Options for searching objects.

```typescript
interface SearchOptions {
  /** Container to search in */
  containerId: Uint8Array;
  
  /** Filters to apply */
  filters?: SearchFilter[];
}
```

### SearchV2Options

Options for paginated searches.

```typescript
interface SearchV2Options extends SearchOptions {
  /** Cursor for pagination */
  cursor?: string;
  
  /** Maximum results to return */
  limit?: number;
  
  /** Attributes to return with results */
  attributes?: string[];
}
```

### SearchResult

Search result item.

```typescript
interface SearchResult {
  /** Object ID */
  objectId: Uint8Array;
  
  /** Requested attributes */
  attributes?: string[];
}
```

### SearchV2Result

Paginated search results.

```typescript
interface SearchV2Result {
  /** Found objects */
  objects: SearchResult[];
  
  /** Cursor for next page (empty if no more results) */
  cursor: string;
}
```

## Network Types

### NodeInfo

Storage node information.

```typescript
interface NodeInfo {
  /** Node public key */
  publicKey: Uint8Array;
  
  /** Node addresses (e.g., ["grpc://1.2.3.4:8080"]) */
  addresses: string[];
  
  /** Node state */
  state: NodeState;
  
  /** Node attributes */
  attributes: ObjectAttribute[];
}
```

### NetworkInfo

Network configuration.

```typescript
interface NetworkInfo {
  /** Current epoch */
  currentEpoch: bigint;
  
  /** Network magic number (identifies the network) */
  magicNumber: bigint;
  
  /** Milliseconds per block */
  msPerBlock: bigint;
  
  /** Network configuration parameters */
  config: Map<string, Uint8Array>;
}
```

### LocalNodeInfo

Local node information.

```typescript
interface LocalNodeInfo {
  /** Node version */
  version: { major: number; minor: number };
  
  /** Node info */
  node: NodeInfo;
}
```

## Other Types

### Balance

Account balance.

```typescript
interface Balance {
  /** Balance in smallest units */
  value: bigint;
  
  /** Decimal precision */
  precision: number;
}
```

### SessionToken

Session token for delegated access.

```typescript
interface SessionToken {
  /** Unique session identifier */
  id: Uint8Array;
  
  /** Public key for the session */
  sessionKey: Uint8Array;
}
```

### Trust

Trust value for reputation system.

```typescript
interface Trust {
  /** Peer public key */
  peer: Uint8Array;
  
  /** Trust value (0.0 to 1.0) */
  value: number;
}
```

## Import Example

```typescript
import {
  // Main client
  ReactNativeNeoFSClient,
  
  // Enums
  BasicACL,
  MatchType,
  ChecksumType,
  ObjectType,
  NodeState,
  
  // Types
  type ReactNativeClientConfig,
  type ObjectAttribute,
  type ObjectInfo,
  type ObjectData,
  type ObjectPutOptions,
  type ContainerInfo,
  type ContainerCreateOptions,
  type SearchFilter,
  type SearchOptions,
  type SearchV2Options,
  type SearchResult,
  type SearchV2Result,
  type NodeInfo,
  type NetworkInfo,
  type LocalNodeInfo,
  type Balance,
  type SessionToken,
  type Trust,
} from 'neofs-sdk-ts';
```
