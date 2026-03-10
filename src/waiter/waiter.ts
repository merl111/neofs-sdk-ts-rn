/**
 * Waiter provides synchronous wrappers for asynchronous NeoFS operations.
 * 
 * After sending a request (like creating a container), NeoFS operations are
 * asynchronous - the data needs to propagate through the network. The waiter
 * polls the network until the operation is confirmed.
 */

import { ReactNativeNeoFSClient, ContainerCreateOptions, ObjectPutOptions } from '../client';
import { NeoFSError } from '../client/react-native/base-client';

/**
 * Default interval between confirmation checks (in milliseconds).
 */
export const DEFAULT_POLL_INTERVAL = 1000;

/**
 * Error thrown when a confirmation timeout occurs.
 * Note: This doesn't necessarily mean the operation failed - the request
 * was sent successfully, but confirmation timed out.
 */
export class ConfirmationTimeoutError extends Error {
  constructor(operation: string) {
    super(`Confirmation timeout for operation: ${operation}`);
    this.name = 'ConfirmationTimeoutError';
  }
}

/**
 * Options for waiter operations.
 */
export interface WaiterOptions {
  /**
   * Interval between confirmation checks in milliseconds.
   * @default 1000
   */
  pollInterval?: number;
  
  /**
   * Maximum time to wait for confirmation in milliseconds.
   * @default 30000
   */
  timeout?: number;
}

/**
 * Result from a poll check function.
 */
type PollResult = 
  | { status: 'success' }
  | { status: 'retry' }
  | { status: 'error'; error: Error };

/**
 * Internal poll function that repeatedly checks until success or timeout.
 * 
 * The check function should return:
 * - { status: 'success' } when the operation is confirmed
 * - { status: 'retry' } when we should keep polling (e.g., "not found" which is expected)
 * - { status: 'error', error } when a real error occurs that should stop polling
 */
async function poll(
  check: () => Promise<PollResult>,
  pollInterval: number,
  timeout: number,
  operation: string
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await check();
    
    switch (result.status) {
      case 'success':
        return;
      case 'error':
        throw result.error;
      case 'retry':
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        break;
    }
  }
  
  throw new ConfirmationTimeoutError(operation);
}

/**
 * Waiter provides synchronous alternatives to asynchronous NeoFS operations.
 * 
 * Example:
 * ```typescript
 * const waiter = new Waiter(client);
 * 
 * // Create container and wait for it to be available
 * const containerId = await waiter.containerPut({ name: 'my-container' });
 * 
 * // Container is now confirmed to exist
 * const info = await client.container().getInfo(containerId);
 * ```
 */
export class Waiter {
  private client: ReactNativeNeoFSClient;
  private defaultPollInterval: number;
  private defaultTimeout: number;

  constructor(
    client: ReactNativeNeoFSClient,
    options?: WaiterOptions
  ) {
    this.client = client;
    this.defaultPollInterval = options?.pollInterval ?? DEFAULT_POLL_INTERVAL;
    this.defaultTimeout = options?.timeout ?? 30000;
  }

  /**
   * Set the default poll interval.
   */
  setPollInterval(interval: number): void {
    this.defaultPollInterval = interval;
  }

  /**
   * Set the default timeout.
   */
  setTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * Create a container and wait until it's confirmed to exist.
   * 
   * @param options - Container creation options
   * @param waiterOptions - Waiter-specific options
   * @returns The container ID (as bytes) once confirmed
   */
  async containerPut(
    options?: ContainerCreateOptions,
    waiterOptions?: WaiterOptions
  ): Promise<Uint8Array> {
    const containerId = await this.client.container().create(options);

    const pollInterval = waiterOptions?.pollInterval ?? this.defaultPollInterval;
    const timeout = waiterOptions?.timeout ?? this.defaultTimeout;

    await poll(
      async (): Promise<PollResult> => {
        try {
          const info = await this.client.container().getInfo(containerId);
          return info !== undefined 
            ? { status: 'success' } 
            : { status: 'retry' };
        } catch (error) {
          if (error instanceof NeoFSError && error.code === 3072) {
            // Container not found - keep polling (expected during propagation)
            return { status: 'retry' };
          }
          // Real error - stop polling and report
          return { status: 'error', error: error as Error };
        }
      },
      pollInterval,
      timeout,
      'containerPut'
    );

    return containerId;
  }

  /**
   * Delete a container and wait until it's confirmed to be gone.
   * 
   * @param containerId - The container ID (as bytes) to delete
   * @param waiterOptions - Waiter-specific options
   */
  async containerDelete(
    containerId: Uint8Array,
    waiterOptions?: WaiterOptions
  ): Promise<void> {
    await this.client.container().remove(containerId);

    const pollInterval = waiterOptions?.pollInterval ?? this.defaultPollInterval;
    const timeout = waiterOptions?.timeout ?? this.defaultTimeout;

    await poll(
      async (): Promise<PollResult> => {
        try {
          const info = await this.client.container().getInfo(containerId);
          // Container still exists - keep polling
          return info === undefined 
            ? { status: 'success' } 
            : { status: 'retry' };
        } catch (error) {
          if (error instanceof NeoFSError && error.code === 3072) {
            // Container not found - success!
            return { status: 'success' };
          }
          // Real error - stop polling and report
          return { status: 'error', error: error as Error };
        }
      },
      pollInterval,
      timeout,
      'containerDelete'
    );
  }

  /**
   * Upload an object and wait until it's confirmed to exist.
   * 
   * @param options - Object upload options
   * @param waiterOptions - Waiter-specific options
   * @returns The object ID (as bytes) once confirmed
   */
  async objectPut(
    options: ObjectPutOptions,
    waiterOptions?: WaiterOptions
  ): Promise<Uint8Array> {
    const objectId = await this.client.object().upload(options);

    const pollInterval = waiterOptions?.pollInterval ?? this.defaultPollInterval;
    const timeout = waiterOptions?.timeout ?? this.defaultTimeout;

    await poll(
      async (): Promise<PollResult> => {
        try {
          // Try to HEAD the object to confirm it exists
          const info = await this.client.object().getInfo(options.containerId, objectId);
          return info !== undefined 
            ? { status: 'success' } 
            : { status: 'retry' };
        } catch (error) {
          if (error instanceof NeoFSError && error.code === 2049) {
            // Object not found - keep polling (expected during propagation)
            return { status: 'retry' };
          }
          // Real error - stop polling and report
          return { status: 'error', error: error as Error };
        }
      },
      pollInterval,
      timeout,
      'objectPut'
    );

    return objectId;
  }

  /**
   * Delete an object and wait until it's confirmed to be gone.
   * 
   * @param containerId - The container ID (as bytes)
   * @param objectId - The object ID (as bytes) to delete
   * @param waiterOptions - Waiter-specific options
   */
  async objectDelete(
    containerId: Uint8Array,
    objectId: Uint8Array,
    waiterOptions?: WaiterOptions
  ): Promise<void> {
    await this.client.object().remove(containerId, objectId);

    const pollInterval = waiterOptions?.pollInterval ?? this.defaultPollInterval;
    const timeout = waiterOptions?.timeout ?? this.defaultTimeout;

    await poll(
      async (): Promise<PollResult> => {
        try {
          const info = await this.client.object().getInfo(containerId, objectId);
          // Object still exists - keep polling
          return info === undefined 
            ? { status: 'success' } 
            : { status: 'retry' };
        } catch (error) {
          if (error instanceof NeoFSError && error.code === 2049) {
            // Object not found - success!
            return { status: 'success' };
          }
          // Real error - stop polling and report
          return { status: 'error', error: error as Error };
        }
      },
      pollInterval,
      timeout,
      'objectDelete'
    );
  }
}
