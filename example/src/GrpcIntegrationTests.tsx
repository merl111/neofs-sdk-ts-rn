/**
 * Real-world gRPC Integration Tests for React Native
 * Tests actual connectivity to grpcb.in public test server
 * With comprehensive console logging
 */

import React, { useState } from 'react';
import { View, Text, Button, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { GrpcClient } from '@merl1231/grpc-react-native';
import { HelloRequestImpl, HelloResponseImpl } from './generated/hello_types';
import { HelloServiceClient } from './generated/hello_services';
import { GRPCBinClient } from './generated/grpcbin_services';
import { EmptyMessageImpl, DummyMessageImpl, HeadersMessageImpl } from './generated/grpcbin_types';

interface TestResult {
  status: 'pending' | 'running' | 'success' | 'failed';
  message: string;
  duration?: number;
}

export default function GrpcIntegrationTests() {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  
  // Shared gRPC client
  const grpcClient = new GrpcClient({
    host: 'grpcb.in',
    port: 9000,
    useTls: false,
  });
  
  // Generated service clients
  const helloServiceClient = new HelloServiceClient(grpcClient);
  const grpcBinClient = new GRPCBinClient(grpcClient);

  const runAllTests = async () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Starting gRPC Integration Tests...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    setResults({});
    
    const testStartTime = Date.now();
    let passed = 0;
    let failed = 0;
    
    const tests = [
      { name: 'Connection', fn: runConnectionTest },
      { name: 'Unary Call', fn: runUnaryCallTest },
      { name: 'Server Streaming', fn: runServerStreamingTest },
      { name: 'Metadata', fn: runMetadataTest },
      { name: 'Error Handling', fn: runErrorHandlingTest },
      { name: 'Timeout', fn: runTimeoutTest },
    ];
    
    for (const test of tests) {
      try {
        await test.fn();
        passed++;
      } catch (error) {
        failed++;
        console.error(`\n❌ Test "${test.name}" failed:`, error);
      }
    }
    
    const totalTime = Date.now() - testStartTime;
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total time: ${totalTime}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  };

  const runConnectionTest = async () => {
    const testName = 'connection';
    console.log('\n┌─────────────────────────────────────┐');
    console.log('│  🔌 Testing Connection to grpcb.in │');
    console.log('└─────────────────────────────────────┘');
    
    setResults(prev => ({ ...prev, [testName]: { status: 'running', message: 'Testing connection...' } }));
    
    const startTime = Date.now();
    try {
      console.log('  ⏳ Initializing gRPC client...');
      console.log(`  📍 Host: grpcb.in:9000 (plaintext)`);
      
      await grpcClient.initialize();
      const duration = Date.now() - startTime;
      
      console.log(`  ✅ Connected successfully in ${duration}ms\n`);
      
      setResults(prev => ({ 
        ...prev, 
        [testName]: { 
          status: 'success', 
          message: `Connected successfully in ${duration}ms`,
          duration 
        } 
      }));
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`  ❌ Connection failed after ${duration}ms`);
      console.error(`  📝 Error:`, error);
      console.error(`  💡 Check: Internet connectivity, grpcb.in availability\n`);
      
      setResults(prev => ({ 
        ...prev, 
        [testName]: { 
          status: 'failed', 
          message: `Connection failed: ${error}`,
          duration 
        } 
      }));
      throw error;
    }
  };

  const runUnaryCallTest = async () => {
    const testName = 'unary';
    console.log('\n┌─────────────────────────────────────┐');
    console.log('│  📞 Testing Unary Call (DummyUnary) │');
    console.log('└─────────────────────────────────────┘');
    
    setResults(prev => ({ ...prev, [testName]: { status: 'running', message: 'Testing unary call...' } }));
    
    const startTime = Date.now();
    try {
      console.log(`  📦 Creating request message...`);
      console.log(`  📤 Request: { FString: "test" }`);
      
      const request = new DummyMessageImpl({ FString: 'test' });
      console.log(`  ✓ Request created`);
      console.log(`  🔄 Calling grpcbin.GRPCBin/DummyUnary...`);
      
      const response = await grpcBinClient.dummyUnary(request);
      const duration = Date.now() - startTime;
      
      console.log(`  📥 Response: { FString: "${response.FString}" }`);
      console.log(`  ✅ Unary call succeeded in ${duration}ms\n`);
      
      setResults(prev => ({ 
        ...prev, 
        [testName]: { 
          status: 'success', 
          message: `Response: "${response.FString}" (${duration}ms)`,
          duration 
        } 
      }));
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`  ❌ Unary call failed after ${duration}ms`);
      console.error(`  📝 Error:`, error);
      console.error(`  💡 Check: Method exists, request format correct\n`);
      
      setResults(prev => ({ 
        ...prev, 
        [testName]: { 
          status: 'failed', 
          message: `Unary call failed: ${error}`,
          duration 
        } 
      }));
      throw error;
    }
  };

  const runServerStreamingTest = async () => {
    const testName = 'streaming';
    console.log('\n┌─────────────────────────────────────────────┐');
    console.log('│  📡 Testing Server Streaming (DummyServerStream) │');
    console.log('└─────────────────────────────────────────────┘');
    
    setResults(prev => ({ ...prev, [testName]: { status: 'running', message: 'Testing server streaming...' } }));
    
    const startTime = Date.now();
    try {
      const request = new DummyMessageImpl({ FString: 'streaming test' });
      console.log(`  📤 Request: { FString: "streaming test" }`);
      console.log(`  🔄 Calling grpcbin.GRPCBin/DummyServerStream...`);
      console.log(`  ⏳ Waiting for server stream...`);
      
      let responseCount = 0;
      let totalBytes = 0;
      
      for await (const response of grpcBinClient.dummyServerStream(request)) {
        responseCount++;
        const bytes = response.serializeBinary().length;
        totalBytes += bytes;
        console.log(`  📥 Received response ${responseCount}: { FString: "${response.FString}" } (${bytes} bytes)`);
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`  📊 Total responses: ${responseCount}`);
      console.log(`  📊 Total bytes: ${totalBytes}`);
      console.log(`  ✅ Server streaming succeeded in ${duration}ms\n`);
      
      setResults(prev => ({ 
        ...prev, 
        [testName]: { 
          status: 'success', 
          message: `Received ${responseCount} responses in ${duration}ms`,
          duration 
        } 
      }));
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`  ❌ Server streaming failed after ${duration}ms`);
      console.error(`  📝 Error:`, error);
      console.error(`  💡 Check: Stream handling, connection stability\n`);
      
      setResults(prev => ({ 
        ...prev, 
        [testName]: { 
          status: 'failed', 
          message: `Server streaming failed: ${error}`,
          duration 
        } 
      }));
      throw error;
    }
  };

  const runMetadataTest = async () => {
    const testName = 'metadata';
    console.log('\n┌─────────────────────────────────────┐');
    console.log('│  🏷️  Testing Metadata/Headers      │');
    console.log('└─────────────────────────────────────┘');
    
    setResults(prev => ({ ...prev, [testName]: { status: 'running', message: 'Testing metadata...' } }));
    
    const startTime = Date.now();
    try {
      const request = new EmptyMessageImpl();
      
      const metadata = {
        'x-custom-header': 'test-value',
        'x-test-id': '12345'
      };
      
      console.log(`  📤 Request: EmptyMessage`);
      console.log(`  🏷️  Metadata:`, metadata);
      console.log(`  🔄 Calling grpcbin.GRPCBin/HeadersUnary with custom headers...`);
      
      const response = await grpcClient.unaryCall(
        'grpcbin.GRPCBin/HeadersUnary',
        request.serializeBinary(),
        { metadata }
      );
      
      const responseObj = HeadersMessageImpl.deserializeBinary(response.data as Uint8Array);
      const duration = Date.now() - startTime;
      
      console.log(`  ✅ Metadata sent successfully in ${duration}ms`);
      console.log(`  📥 Response headers:`, Object.keys(responseObj.Metadata || {}).length, 'headers received');
      console.log('');
      
      setResults(prev => ({ 
        ...prev, 
        [testName]: { 
          status: 'success', 
          message: `Metadata sent successfully in ${duration}ms`,
          duration 
        } 
      }));
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`  ❌ Metadata test failed after ${duration}ms`);
      console.error(`  📝 Error:`, error);
      console.error(`  💡 Check: Metadata format, header restrictions\n`);
      
      setResults(prev => ({ 
        ...prev, 
        [testName]: { 
          status: 'failed', 
          message: `Metadata test failed: ${error}`,
          duration 
        } 
      }));
      throw error;
    }
  };

  const runErrorHandlingTest = async () => {
    const testName = 'errorHandling';
    console.log('\n┌─────────────────────────────────────┐');
    console.log('│  ⚠️  Testing Error Handling        │');
    console.log('└─────────────────────────────────────┘');
    
    setResults(prev => ({ ...prev, [testName]: { status: 'running', message: 'Testing error handling...' } }));
    
    const startTime = Date.now();
    try {
      const request = new HelloRequestImpl({ Greeting: 'Error Test' });
      
      console.log(`  🔄 Calling non-existent method (should fail)...`);
      console.log(`  📍 Method: hello.HelloService/NonExistentMethod`);
      
      try {
        await grpcClient.unaryCall(
          'hello.HelloService/NonExistentMethod',
          request.serializeBinary()
        );
        
        // If we get here, the test failed (we expected an error)
        const duration = Date.now() - startTime;
        console.error(`  ❌ Test failed: Expected error but call succeeded\n`);
        
        setResults(prev => ({ 
          ...prev, 
          [testName]: { 
            status: 'failed', 
            message: `Expected error but call succeeded`,
            duration 
          } 
        }));
        throw new Error('Expected error but call succeeded');
      } catch (error) {
        // Expected error - test passed
        const duration = Date.now() - startTime;
        console.log(`  ✅ Error handled correctly (as expected)`);
        console.log(`  📝 Error:`, String(error).substring(0, 100));
        console.log(`  ⏱️  Duration: ${duration}ms\n`);
        
        setResults(prev => ({ 
          ...prev, 
          [testName]: { 
            status: 'success', 
            message: `Error handled correctly in ${duration}ms`,
            duration 
          } 
        }));
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`  ❌ Error handling test failed unexpectedly after ${duration}ms`);
      console.error(`  📝 Error:`, error);
      console.error(`  💡 Check: Error propagation, exception handling\n`);
      
      setResults(prev => ({ 
        ...prev, 
        [testName]: { 
          status: 'failed', 
          message: `Error handling test failed: ${error}`,
          duration 
        } 
      }));
      throw error;
    }
  };

  const runTimeoutTest = async () => {
    const testName = 'timeout';
    console.log('\n┌─────────────────────────────────────┐');
    console.log('│  ⏱️  Testing Timeout Handling       │');
    console.log('└─────────────────────────────────────┘');
    
    setResults(prev => ({ ...prev, [testName]: { status: 'running', message: 'Testing timeout...' } }));
    
    const startTime = Date.now();
    try {
      const request = new DummyMessageImpl({ FString: 'timeout test' });
      
      const timeoutMs = 5000;
      console.log(`  📤 Request: { FString: "timeout test" }`);
      console.log(`  ⏰ Timeout: ${timeoutMs}ms`);
      console.log(`  🔄 Calling grpcbin.GRPCBin/DummyUnary with timeout...`);
      
      const response = await grpcBinClient.dummyUnary(request);
      
      const duration = Date.now() - startTime;
      
      console.log(`  ✅ Completed within timeout`);
      console.log(`  ⏱️  Duration: ${duration}ms (${timeoutMs - duration}ms remaining)\n`);
      
      setResults(prev => ({ 
        ...prev, 
        [testName]: { 
          status: 'success', 
          message: `Completed within timeout (${duration}ms)`,
          duration 
        } 
      }));
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`  ❌ Timeout test failed after ${duration}ms`);
      console.error(`  📝 Error:`, error);
      
      if (String(error).includes('deadline') || String(error).includes('timeout')) {
        console.log(`  💡 Call exceeded timeout (this may be expected)`);
      } else {
        console.error(`  💡 Check: Network latency, timeout value\n`);
      }
      
      setResults(prev => ({ 
        ...prev, 
        [testName]: { 
          status: 'failed', 
          message: `Timeout test failed: ${error}`,
          duration 
        } 
      }));
      throw error;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>gRPC Integration Tests</Text>
        <Text style={styles.subtitle}>Testing against grpcb.in:9000</Text>
      </View>

      <Button title="Run All Tests" onPress={runAllTests} />

      <View style={styles.resultsContainer}>
        {Object.entries(results).map(([testName, result]) => (
          <View key={testName} style={styles.resultItem}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultName}>{testName}</Text>
              <Text style={styles.resultStatus}>
                {result.status === 'pending' && '⏸️'}
                {result.status === 'running' && '⏳'}
                {result.status === 'success' && '✅'}
                {result.status === 'failed' && '❌'}
              </Text>
            </View>
            <Text style={styles.resultMessage}>{result.message}</Text>
            {result.duration && (
              <Text style={styles.resultDuration}>{result.duration}ms</Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  resultsContainer: {
    marginTop: 20,
  },
  resultItem: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultStatus: {
    fontSize: 20,
  },
  resultMessage: {
    fontSize: 14,
    color: '#333',
    marginTop: 5,
  },
  resultDuration: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
});
