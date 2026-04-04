// Re-export from core (crypto, user, types, utils)
export * from '@axlabs/neofs-sdk-ts-core';

// Export React Native specific clients (ObjectAttribute comes from core; omit duplicate)
export {
  ReactNativeNeoFSClient,
  ReactNativeObjectClient,
  ReactNativeContainerClient,
  ReactNativeAccountingClient,
  ReactNativeNetmapClient,
  ReactNativeSessionClient,
  ReactNativeReputationClient,
  BasicACL,
  NodeState,
  ContainerSessionContext_Verb,
  type ReactNativeClientConfig,
  type ContainerCreateOptions,
  type ContainerInfo,
  type ObjectPutOptions,
  type ObjectInfo,
  type ObjectData,
  type SearchOptions,
  type SearchV2Options,
  type SearchFilter,
  type SearchResult,
  type SearchV2Result,
  type NodeInfo,
  type NetworkInfo,
  type LocalNodeInfo,
  type Balance,
  type SessionToken,
  type Trust,
} from './client';

// Export platform-specific modules (eacl, bearer, waiter) that depend on generated types
export * from './eacl';
export * from './bearer';
export * from './waiter';

// Generated gRPC types for React Native (use these in React Native projects)
export * as grpcTypes from './gen-grpc-react-native';
