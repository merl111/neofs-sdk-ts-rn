/**
 * Integration tests for @merl1231/grpc-react-native
 * These tests connect to the public grpcb.in test server
 * 
 * NOTE: These tests require network connectivity and the grpcb.in service to be available
 * Run these tests on a real device or emulator, not in CI/CD
 */

/// <reference types="jest" />

import { GrpcClient, GrpcStatusCode } from '@merl1231/grpc-react-native';
import { HelloServiceClient } from '../src/generated/hello_services';
import { HelloRequestImpl } from '../src/generated/hello_types';
import { GRPCBinClient } from '../src/generated/grpcbin_services';
import { EmptyMessageImpl } from '../src/generated/grpcbin_types';

// Use a longer timeout for network operations
jest.setTimeout(30000);

describe('gRPC Integration Tests - grpcb.in', () => {
  const GRPC_HOST = 'grpcb.in';
  const GRPC_PORT = 9000; // Plaintext port
  const USE_TLS = false;

  describe('Connection Tests', () => {
    it('should connect to grpcb.in', async () => {
      const client = new GrpcClient({
        host: GRPC_HOST,
        port: GRPC_PORT,
        useTls: USE_TLS,
      });

      await expect(client.initialize()).resolves.not.toThrow();
      await client.close();
    });

    it('should create and close channel multiple times', async () => {
      const client = new GrpcClient({
        host: GRPC_HOST,
        port: GRPC_PORT,
        useTls: USE_TLS,
      });

      await client.initialize();
      await client.close();
      
      // Should be able to reinitialize
      await client.initialize();
      await client.close();
    });
  });

  describe('Unary Call Tests', () => {
    let grpcClient: GrpcClient;
    let helloServiceClient: HelloServiceClient;

    beforeEach(async () => {
      grpcClient = new GrpcClient({
        host: GRPC_HOST,
        port: GRPC_PORT,
        useTls: USE_TLS,
      });
      await grpcClient.initialize();
      helloServiceClient = new HelloServiceClient(grpcClient);
    });

    afterEach(async () => {
      await grpcClient.close();
    });

    it('should make a successful unary call to SayHello', async () => {
      const request = new HelloRequestImpl({ name: 'React Native' });
      const response = await helloServiceClient.sayHello(request);

      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
      // The response should contain our greeting
      console.log('SayHello response:', response);
    });

    it('should make multiple unary calls', async () => {
      const names = ['Alice', 'Bob', 'Charlie'];
      
      for (const name of names) {
        const request = new HelloRequestImpl({ name });
        const response = await helloServiceClient.sayHello(request);
        expect(response).toBeDefined();
        console.log(`Greeting for ${name}:`, response.data);
      }
    });

    it('should handle empty name in request', async () => {
      const request = new HelloRequestImpl({ name: '' });
      const response = await helloServiceClient.sayHello(request);
      
      expect(response).toBeDefined();
      console.log('Empty name response:', response);
    });
  });

  describe('Server Streaming Tests', () => {
    let grpcClient: GrpcClient;
    let helloServiceClient: HelloServiceClient;

    beforeEach(async () => {
      grpcClient = new GrpcClient({
        host: GRPC_HOST,
        port: GRPC_PORT,
        useTls: USE_TLS,
      });
      await grpcClient.initialize();
      helloServiceClient = new HelloServiceClient(grpcClient);
    });

    afterEach(async () => {
      await grpcClient.close();
    });

    it('should receive server streaming responses', async () => {
      const request = new HelloRequestImpl({ name: 'StreamTest' });
      const responses: any[] = [];

      for await (const response of helloServiceClient.lotsOfReplies(request)) {
        responses.push(response);
        if (response.done) {
          break;
        }
        console.log('Received streaming response:', response.data);
      }

      expect(responses.length).toBeGreaterThan(0);
      expect(responses[responses.length - 1].done).toBe(true);
    }, 15000); // Longer timeout for streaming

    it('should handle stream with multiple messages', async () => {
      const request = new HelloRequestImpl({ name: 'MultiStream' });
      let dataCount = 0;
      let doneReceived = false;

      for await (const response of helloServiceClient.lotsOfReplies(request)) {
        if (response.done) {
          doneReceived = true;
          break;
        }
        dataCount++;
      }

      expect(dataCount).toBeGreaterThanOrEqual(0);
      expect(doneReceived).toBe(true);
    }, 15000);
  });

  describe('Metadata Tests', () => {
    let grpcClient: GrpcClient;
    let helloServiceClient: HelloServiceClient;

    beforeEach(async () => {
      grpcClient = new GrpcClient({
        host: GRPC_HOST,
        port: GRPC_PORT,
        useTls: USE_TLS,
      });
      await grpcClient.initialize();
      helloServiceClient = new HelloServiceClient(grpcClient);
    });

    afterEach(async () => {
      await grpcClient.close();
    });

    it('should send custom metadata with request', async () => {
      const request = new HelloRequestImpl({ name: 'MetadataTest' });
      
      // Note: Metadata support in generated clients coming soon
      // For now, use the raw client for metadata
      const response = await grpcClient.unaryCall(
        'hello.Greeter/SayHello',
        request.serializeBinary(),
        {
          metadata: {
            'x-custom-header': 'custom-value',
            'x-request-id': 'test-123',
            'x-client-version': '1.0.0',
          },
        }
      );

      expect(response).toBeDefined();
      console.log('Response with metadata:', response);
    });

    it('should receive metadata in response', async () => {
      const request = new HelloRequestImpl({ name: 'MetadataResponse' });
      const response = await helloServiceClient.sayHello(request);

      // Check if we received any metadata back
      if (response.metadata) {
        console.log('Response metadata keys:', Object.keys(response.metadata));
        expect(typeof response.metadata).toBe('object');
      }
    });
  });

  describe('Error Handling Tests', () => {
    let grpcClient: GrpcClient;

    beforeEach(async () => {
      grpcClient = new GrpcClient({
        host: GRPC_HOST,
        port: GRPC_PORT,
        useTls: USE_TLS,
      });
      await grpcClient.initialize();
    });

    afterEach(async () => {
      await grpcClient.close();
    });

    it('should handle invalid method gracefully', async () => {
      await expect(
        grpcClient.unaryCall(
          'hello.Greeter/NonExistentMethod',
          new Uint8Array([1, 2, 3])
        )
      ).rejects.toThrow();
    });

    it('should handle connection to invalid host', async () => {
      const badClient = new GrpcClient({
        host: 'invalid-host-that-does-not-exist.com',
        port: 9000,
        useTls: false,
      });

      await expect(badClient.initialize()).rejects.toThrow();
    }, 10000);
  });

  describe('Timeout Tests', () => {
    let grpcClient: GrpcClient;
    let helloServiceClient: HelloServiceClient;

    beforeEach(async () => {
      grpcClient = new GrpcClient({
        host: GRPC_HOST,
        port: GRPC_PORT,
        useTls: USE_TLS,
        defaultDeadline: 5000,
      });
      await grpcClient.initialize();
      helloServiceClient = new HelloServiceClient(grpcClient);
    });

    afterEach(async () => {
      await grpcClient.close();
    });

    it('should complete call within timeout', async () => {
      const request = new HelloRequestImpl({ name: 'QuickTest' });
      const startTime = Date.now();
      
      // Use raw client for timeout support
      const response = await grpcClient.unaryCall(
        'hello.Greeter/SayHello',
        request.serializeBinary(),
        {
          timeout: 5000,
        }
      );

      const duration = Date.now() - startTime;
      expect(response).toBeDefined();
      expect(duration).toBeLessThan(5000);
      console.log(`Call completed in ${duration}ms`);
    });
  });

  describe('Binary Serialization Tests', () => {
    it('should correctly serialize and deserialize messages', () => {
      const request = new HelloRequestImpl({ name: 'SerializationTest' });
      
      // Serialize to binary
      const binary = request.serializeBinary();
      expect(binary).toBeInstanceOf(Uint8Array);
      expect(binary.length).toBeGreaterThan(0);
      
      // Deserialize back
      const deserialized = HelloRequestImpl.deserializeBinary(binary);
      expect(deserialized.name).toBe('SerializationTest');
    });

    it('should handle empty messages', () => {
      const empty = new EmptyMessageImpl({});
      const binary = empty.serializeBinary();
      expect(binary).toBeInstanceOf(Uint8Array);
      
      const deserialized = EmptyMessageImpl.deserializeBinary(binary);
      expect(deserialized).toBeDefined();
    });
  });
});
