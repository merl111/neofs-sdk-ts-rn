/**
 * Waiter module provides synchronous alternatives to asynchronous NeoFS operations.
 * 
 * After operations like container creation or object upload, NeoFS needs time to
 * propagate data through the network. The Waiter polls until operations are confirmed.
 * 
 * @example
 * ```typescript
 * import { ReactNativeNeoFSClient, Waiter } from 'neofs-sdk-ts-react-native';
 * 
 * const client = new ReactNativeNeoFSClient({ endpoint: 'grpc://...' });
 * const waiter = new Waiter(client);
 * 
 * // Create container and wait for confirmation
 * const containerId = await waiter.containerPut({ name: 'my-container' });
 * 
 * // Upload object and wait for confirmation
 * const objectId = await waiter.objectPut(containerId, payload);
 * ```
 */

export {
  Waiter,
  WaiterOptions,
  DEFAULT_POLL_INTERVAL,
  ConfirmationTimeoutError,
} from './waiter';
