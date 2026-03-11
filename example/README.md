# React Native gRPC Integration Test App

A React Native app for testing the `@merl1231/grpc-react-native` package with real-world gRPC servers.

## Overview

This app tests gRPC functionality against **grpcb.in**, a public gRPC test server similar to HTTPBin.

### Test Server: grpcb.in

- **Plaintext (no TLS)**: `grpc://grpcb.in:9000` (used in tests)
- **With TLS**: `grpc://grpcb.in:9001`
- **Website**: https://grpcb.in/

## Features Tested

- **Unary Calls**: Simple request-response pattern
- **Server Streaming**: Server sends multiple responses
- **Client Streaming**: Client sends multiple requests
- **Bidirectional Streaming**: Both sides stream
- **Metadata/Headers**: Custom headers in requests and responses
- **Timeout/Deadline**: Call timeout handling
- **Error Handling**: Network errors and invalid calls
- **Binary Serialization**: Protocol Buffer encoding/decoding

## Project Structure

```
rntest/
├── proto/                          # Protocol Buffer definitions
│   ├── hello.proto                # Hello service (4 streaming patterns)
│   └── grpcbin.proto              # Test service utilities
├── src/
│   ├── generated/                 # Generated TypeScript (from proto)
│   │   ├── hello_types.ts
│   │   ├── hello_services.ts
│   │   ├── grpcbin_types.ts
│   │   └── grpcbin_services.ts
│   └── GrpcIntegrationTests.tsx  # Visual test UI component
├── __tests__/
│   ├── grpc.integration.test.ts  # Jest integration tests
│   └── integration.setup.js       # Jest setup with RN mocks
├── App.tsx                        # Main app (shows test UI)
└── GRPC_TESTS.md                  # Detailed test documentation
```

## Running the App

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Metro Bundler

```bash
npm start
```

### 3. Run on Android

```bash
npm run android
```

### 4. Run on iOS

```bash
cd ios && pod install && cd ..
npm run ios
```

The app will display a test interface with a "Run All Tests" button.

## Running Jest Integration Tests

```bash
# Run integration tests (requires RN mocks, not actual native modules)
npm run test:integration

# Run all tests
npm test
```

**Note**: The Jest integration tests use mocks. For real gRPC testing, run the actual app on a device/emulator.

## Development

### Regenerate Protocol Buffers

If you modify `.proto` files:

```bash
npm run generate:proto
```

This generates TypeScript types and service clients from proto definitions.

### Adding New Services

1. Create a `.proto` file in `proto/`
2. Run `npm run generate:proto`
3. Import generated client in your code
4. Use it with `GrpcClient`

Example:

```typescript
import { GrpcClient } from '@merl1231/grpc-react-native';
import { GreeterClient } from './generated/hello_services';
import { HelloRequestImpl } from './generated/hello_types';

const grpcClient = new GrpcClient({
  host: 'grpcb.in',
  port: 9000,
  useTls: false,
});

await grpcClient.initialize();
const greeter = new GreeterClient(grpcClient);

const request = new HelloRequestImpl({ name: 'World' });
const response = await greeter.sayHello(request);

console.log('Response:', response.data);
await grpcClient.close();
```

## Available Test Services

### hello.Greeter

- **SayHello** - Unary call  
  Request: `{ name: string }`  
  Response: `{ message: string }`

- **LotsOfReplies** - Server streaming  
  Sends multiple greeting responses

- **LotsOfGreetings** - Client streaming  
  Accepts multiple greeting requests

- **BidiHello** - Bidirectional streaming  
  Both client and server stream messages

### grpcbin.GRPCBin

- **Empty** - Returns empty response
- **DummyUnary** - Simple test call
- **HeadersUnary** - Returns headers

## Test Results

When running the visual tests in the app, you'll see:

- ⏸️ **Pending**: Test not run yet
- ⏳ **Running**: Test in progress
- ✅ **Success**: Test passed
- ❌ **Failed**: Test failed

Each test shows:
- Test name
- Status indicator
- Result message
- Duration in milliseconds

## Troubleshooting

### "Connection refused" errors

- Check internet connectivity
- Verify grpcb.in is online: `curl grpcb.in`
- Check firewall settings

### Native module not found

```bash
# Reinstall native modules
cd ios && pod install && cd ..
# or
cd android && ./gradlew clean && cd ..

# Reinstall npm packages
rm -rf node_modules && npm install
```

### Build errors

```bash
# Clean and rebuild
cd android
./gradlew clean
./gradlew build
cd ..

# For iOS
cd ios
pod deintegrate
pod install
cd ..
```

## Architecture

### gRPC Client Layer

1. **GrpcClient** (TypeScript) - High-level client API
2. **Native Modules** (Kotlin/Swift) - Platform-specific gRPC implementation
3. **gRPC Libraries** - grpc-java (Android) / grpc-swift (iOS)

### Generated Code

The `protoc-gen-grpc-react-native` plugin generates:
- Type-safe TypeScript interfaces
- Binary serialization methods (`serializeBinary`, `deserializeBinary`)
- Service client classes with async/streaming support

## Links

- grpcb.in: https://grpcb.in/
- grpc-react-native: `../../grpc-react-native/`
- gRPC Documentation: https://grpc.io/docs/
