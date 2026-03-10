# NeoFS TypeScript SDK Documentation

A React Native compatible TypeScript SDK for interacting with the NeoFS decentralized storage network.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Examples](#examples)

## Installation

```bash
npm install neofs-sdk-ts grpc-react-native
```

## Quick Start

```typescript
import { ReactNativeNeoFSClient, BasicACL } from 'neofs-sdk-ts';
import { createSigner } from 'neofs-sdk-ts/crypto';

// Create a signer from your private key
const signer = createSigner(privateKeyHex);

// Initialize the client
const client = new ReactNativeNeoFSClient({
  host: 'grpc.testnet.neofs.io',
  port: 8082,
  signer,
});

// Connect to the network
await client.connect();

try {
  // Create a container
  const containerId = await client.container().create({
    name: 'my-files',
    basicAcl: BasicACL.PUBLIC_READ,
    placementPolicy: 'REP 3',
  });

  // Upload a file
  const objectId = await client.object().upload({
    containerId,
    payload: new TextEncoder().encode('Hello, NeoFS!'),
    filename: 'hello.txt',
    contentType: 'text/plain',
  });

  console.log('Uploaded object:', objectId);

  // Download the file
  const { info, payload } = await client.object().download(containerId, objectId);
  console.log('Content:', new TextDecoder().decode(payload));
  console.log('Attributes:', info.attributes);

} finally {
  await client.disconnect();
}
```

## API Reference

### Core Client

- [ReactNativeNeoFSClient](./api/client.md) - Main client for connecting to NeoFS

### Service Clients

- [Object Client](./api/objects.md) - Upload, download, search, and delete objects
- [Container Client](./api/containers.md) - Create and manage containers
- [Netmap Client](./api/netmap.md) - Network and node information
- [Accounting Client](./api/accounting.md) - Balance queries
- [Session Client](./api/sessions.md) - Session token management
- [Reputation Client](./api/reputation.md) - Trust management

### Types Reference

- [Types and Enums](./types.md) - All type definitions

## Examples

### Upload and Download Files

```typescript
// Upload a file with metadata
const objectId = await client.object().upload({
  containerId,
  payload: fileBuffer,
  filename: 'document.pdf',
  contentType: 'application/pdf',
  attributes: [
    { key: 'Author', value: 'John Doe' },
    { key: 'Department', value: 'Engineering' },
  ],
});

// Download with metadata
const { info, payload } = await client.object().download(containerId, objectId);
console.log('File size:', info.payloadSize);
console.log('Created at epoch:', info.creationEpoch);
```

### Search Objects

```typescript
import { MatchType } from 'neofs-sdk-ts';

// Find all PDFs
const pdfIds = await client.object().find({
  containerId,
  filters: [
    { key: 'ContentType', value: 'application/pdf', matchType: MatchType.STRING_EQUAL },
  ],
});

// Paginated search
const { objects, cursor } = await client.object().findPaginated({
  containerId,
  filters: [
    { key: 'FileName', value: 'doc', matchType: MatchType.COMMON_PREFIX },
  ],
  limit: 50,
});

// Get next page
const nextPage = await client.object().findPaginated({
  containerId,
  cursor,
  limit: 50,
});
```

### List Containers

```typescript
// List all container IDs
const containerIds = await client.container().listAll();

// List with full details
const containers = await client.container().listWithInfo();
for (const container of containers) {
  console.log(`${container.name}: ${container.basicAcl.toString(16)}`);
}
```

### Check Network Status

```typescript
// Get current epoch
const epoch = await client.netmap().getCurrentEpoch();
console.log('Current epoch:', epoch);

// Get network info
const network = await client.netmap().getNetwork();
console.log('Network magic:', network.magicNumber);

// Get all nodes
const nodes = await client.netmap().getNodes();
for (const node of nodes) {
  console.log(`Node: ${node.addresses.join(', ')} - ${node.state}`);
}
```

### Check Balance

```typescript
const balance = await client.accounting().getBalance();
console.log(`Balance: ${balance.value} (precision: ${balance.precision})`);
```

## Error Handling

```typescript
try {
  const data = await client.object().download(containerId, objectId);
} catch (error) {
  if (error.message.includes('NOT_FOUND')) {
    console.log('Object does not exist');
  } else if (error.message.includes('ACCESS_DENIED')) {
    console.log('Access denied - check your permissions');
  } else {
    throw error;
  }
}
```

## Configuration Options

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
