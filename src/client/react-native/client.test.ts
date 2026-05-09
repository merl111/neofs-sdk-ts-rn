import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createTestClientConfig } from '../../test/test-signer';

const grpcInstances = vi.hoisted(() => [] as GrpcTestInstance[]);

vi.mock('@merl1231/grpc-react-native', () => ({
  GrpcClient: class GrpcClient implements GrpcTestInstance {
    opts: unknown;
    initialize = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    unaryCall = vi.fn();
    serverStreamCall = vi.fn();
    clientStreamCall = vi.fn();

    constructor(opts: unknown) {
      this.opts = opts;
      grpcInstances.push(this);
    }
  },
}));

interface GrpcTestInstance {
  opts: unknown;
  initialize: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  unaryCall: ReturnType<typeof vi.fn>;
  serverStreamCall: ReturnType<typeof vi.fn>;
  clientStreamCall: ReturnType<typeof vi.fn>;
}

import { ReactNativeNeoFSClient } from './client';

function lastGrpc(): GrpcTestInstance {
  const i = grpcInstances.at(-1);
  if (!i) {
    throw new Error('expected GrpcClient constructor to run');
  }
  return i;
}

describe('ReactNativeNeoFSClient', () => {
  beforeEach(() => {
    grpcInstances.length = 0;
    vi.clearAllMocks();
  });

  it('passes TLS and timeout into GrpcClient constructor', async () => {
    const client = new ReactNativeNeoFSClient(
      createTestClientConfig({
        host: 'grpc.example',
        port: 1111,
        useTls: true,
        timeout: 12_000,
      }),
    );

    await client.connect();

    expect(lastGrpc().opts).toEqual({
      host: 'grpc.example',
      port: 1111,
      useTls: true,
      timeout: 12_000,
    });
  });

  it('uses library defaults when optional fields omitted', async () => {
    const client = new ReactNativeNeoFSClient(createTestClientConfig());

    await client.connect();

    expect(lastGrpc().opts).toMatchObject({
      host: '127.0.0.1',
      port: 8080,
      useTls: false,
      timeout: 30000,
    });

    await client.disconnect();
  });

  it('connect wires GrpcClient options and service accessors require connection', async () => {
    const c = new ReactNativeNeoFSClient(createTestClientConfig({ port: 9090 }));
    expect(() => c.object()).toThrow(/connect/i);

    await c.connect();

    const grpc = lastGrpc();
    expect(grpc.opts).toMatchObject({ host: '127.0.0.1', port: 9090 });
    expect(grpc.initialize).toHaveBeenCalledTimes(1);

    expect(c.isConnected()).toBe(true);
    expect(c.object()).toBeDefined();
    expect(c.container()).toBeDefined();

    await c.disconnect();
    expect(grpc.close).toHaveBeenCalled();
    expect(c.isConnected()).toBe(false);
    expect(() => c.netmap()).toThrow(/connect/i);
  });
});
