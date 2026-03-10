/**
 * Main React Native NeoFS client.
 */

import { GrpcClient } from 'grpc-react-native';

import { ReactNativeClientConfig } from './types';
import { ReactNativeObjectClient } from './object-client';
import { ReactNativeContainerClient } from './container-client';
import { ReactNativeAccountingClient } from './accounting-client';
import { ReactNativeNetmapClient } from './netmap-client';
import { ReactNativeSessionClient } from './session-client';
import { ReactNativeReputationClient } from './reputation-client';

/**
 * Main React Native NeoFS client.
 * 
 * @example
 * ```typescript
 * const client = new ReactNativeNeoFSClient({
 *   host: 'grpc.testnet.neofs.io',
 *   port: 8082,
 *   signer: mySigner,
 * });
 * 
 * await client.connect();
 * 
 * // Create a container
 * const containerId = await client.container().create({
 *   name: 'my-files',
 *   basicAcl: BasicACL.PUBLIC_READ,
 * });
 * 
 * // Upload an object
 * const objectId = await client.object().upload({
 *   containerId,
 *   payload: new TextEncoder().encode('Hello, NeoFS!'),
 *   filename: 'hello.txt',
 * });
 * 
 * // Download the object
 * const { info, payload } = await client.object().download(containerId, objectId);
 * console.log(new TextDecoder().decode(payload));
 * 
 * await client.disconnect();
 * ```
 */
export class ReactNativeNeoFSClient {
  private grpcClient: GrpcClient | null = null;
  private config: ReactNativeClientConfig;
  private _object: ReactNativeObjectClient | null = null;
  private _container: ReactNativeContainerClient | null = null;
  private _accounting: ReactNativeAccountingClient | null = null;
  private _netmap: ReactNativeNetmapClient | null = null;
  private _session: ReactNativeSessionClient | null = null;
  private _reputation: ReactNativeReputationClient | null = null;

  constructor(config: ReactNativeClientConfig) {
    this.config = {
      useTls: false,
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Connect to the NeoFS network.
   */
  async connect(): Promise<void> {
    // Create GrpcClient with the host/port configuration
    this.grpcClient = new GrpcClient({
      host: this.config.host,
      port: this.config.port,
      useTls: this.config.useTls,
      timeout: this.config.timeout,
    });
    
    // Initialize the channel
    await this.grpcClient.initialize();
    
    // Create service clients after connection
    this._object = new ReactNativeObjectClient(this.grpcClient, this.config);
    this._container = new ReactNativeContainerClient(this.grpcClient, this.config);
    this._accounting = new ReactNativeAccountingClient(this.grpcClient, this.config);
    this._netmap = new ReactNativeNetmapClient(this.grpcClient, this.config);
    this._session = new ReactNativeSessionClient(this.grpcClient, this.config);
    this._reputation = new ReactNativeReputationClient(this.grpcClient, this.config);
  }

  /**
   * Disconnect from the NeoFS network.
   */
  async disconnect(): Promise<void> {
    if (this.grpcClient) {
      await this.grpcClient.close();
      this.grpcClient = null;
    }
  }
  
  private ensureConnected(): void {
    if (!this.grpcClient) {
      throw new Error('Not connected. Call connect() first.');
    }
  }

  /** Get the object client for uploading, downloading, and managing objects. */
  object(): ReactNativeObjectClient {
    this.ensureConnected();
    return this._object!;
  }

  /** Get the container client for creating and managing containers. */
  container(): ReactNativeContainerClient {
    this.ensureConnected();
    return this._container!;
  }

  /** Get the accounting client for checking balances. */
  accounting(): ReactNativeAccountingClient {
    this.ensureConnected();
    return this._accounting!;
  }

  /** Get the netmap client for network information. */
  netmap(): ReactNativeNetmapClient {
    this.ensureConnected();
    return this._netmap!;
  }

  /** Get the session client for managing sessions. */
  session(): ReactNativeSessionClient {
    this.ensureConnected();
    return this._session!;
  }

  /** Get the reputation client for trust management. */
  reputation(): ReactNativeReputationClient {
    this.ensureConnected();
    return this._reputation!;
  }
  
  /** Check if the client is connected. */
  isConnected(): boolean {
    return this.grpcClient !== null;
  }
}
