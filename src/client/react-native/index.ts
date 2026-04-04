/**
 * React Native compatible NeoFS client exports.
 */

// Main client
export { ReactNativeNeoFSClient } from './client';

// Service clients
export { ReactNativeObjectClient } from './object-client';
export { ReactNativeContainerClient } from './container-client';
export { ReactNativeAccountingClient } from './accounting-client';
export { ReactNativeNetmapClient } from './netmap-client';
export { ReactNativeSessionClient, ContainerSessionContext_Verb } from './session-client';
export { ReactNativeReputationClient } from './reputation-client';

// Error class and request options
export { NeoFSError, type RequestOptions } from './base-client';

// Types and enums
// NOTE: MatchType, ChecksumType, ObjectType are exported from core via the main index.
export {
  // Enums
  BasicACL,
  NodeState,
  // Configuration
  type ReactNativeClientConfig,
  // Container types
  type ContainerCreateOptions,
  type ContainerInfo,
  // Object types
  type ObjectPutOptions,
  type ObjectAttribute,
  type ObjectInfo,
  type ObjectData,
  // Search types
  type SearchOptions,
  type SearchV2Options,
  type SearchFilter,
  type SearchResult,
  type SearchV2Result,
  // Network types
  type NodeInfo,
  type NetworkInfo,
  type LocalNodeInfo,
  // Other types
  type Balance,
  type SessionToken,
  type Trust,
} from './types';
