# NeoFS TypeScript SDK for React Native

A React Native TypeScript SDK for [NeoFS](https://fs.neo.org/) - a decentralized, distributed object storage network.

## Features

- **React Native Compatible**: Works seamlessly with React Native via `grpc-react-native`
- **User-Friendly API**: Simple, intuitive methods for common operations
- **Full NeoFS Support**: Containers, objects, sessions, EACL, bearer tokens
- **Type Safety**: Complete TypeScript definitions
- **Cross-Platform**: Works on both iOS and Android

## Installation

```bash
npm install neofs-sdk-ts-react-native grpc-react-native
```

### iOS Setup

```bash
cd ios && pod install
```

### Android Setup

No additional setup required.

## Quick Start

```typescript
import { ReactNativeNeoFSClient, BasicACL, ECDSASigner } from 'neofs-sdk-ts-react-native';

// Create a signer from your private key
const signer = ECDSASigner.fromHex(privateKeyHex);

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

} finally {
  await client.disconnect();
}
```

## API Overview

### Client Initialization

```typescript
import { ReactNativeNeoFSClient, ECDSASigner } from 'neofs-sdk-ts-react-native';

// From hex private key
const signer = ECDSASigner.fromHex('your-private-key-hex');

// Or generate a new key pair
const signer = ECDSASigner.generate();

const client = new ReactNativeNeoFSClient({
  host: 'grpc.testnet.neofs.io',
  port: 8082,
  signer,
  useTls: false,      // Optional: use TLS
  timeout: 30000,     // Optional: request timeout
});

await client.connect();
```

### Container Operations

```typescript
import { BasicACL } from 'neofs-sdk-ts-react-native';

// Create a container
const containerId = await client.container().create({
  name: 'my-files',
  basicAcl: BasicACL.PUBLIC_READ,
  placementPolicy: 'REP 2',
  attributes: [
    { key: 'Project', value: 'MyApp' },
  ],
});

// Get container info
const info = await client.container().getInfo(containerId);
console.log('Name:', info?.name);
console.log('ACL:', info?.basicAcl.toString(16));

// List all containers
const containers = await client.container().listWithInfo();

// Delete a container
await client.container().remove(containerId);
```

### Object Operations

```typescript
// Upload an object
const objectId = await client.object().upload({
  containerId,
  payload: imageBuffer,
  filename: 'photo.jpg',
  contentType: 'image/jpeg',
  attributes: [
    { key: 'Album', value: 'Vacation 2024' },
  ],
});

// Download an object
const { info, payload } = await client.object().download(containerId, objectId);

// Get metadata only
const info = await client.object().getInfo(containerId, objectId);

// Delete an object
await client.object().remove(containerId, objectId);

// Search objects
import { MatchType } from 'neofs-sdk-ts-react-native';

const objectIds = await client.object().find({
  containerId,
  filters: [
    { key: 'ContentType', value: 'image/', matchType: MatchType.COMMON_PREFIX },
  ],
});

// Paginated search
const { objects, cursor } = await client.object().findPaginated({
  containerId,
  limit: 50,
});
```

### Network Information

```typescript
// Get current epoch
const epoch = await client.netmap().getCurrentEpoch();

// Get network info
const network = await client.netmap().getNetwork();
console.log('Magic:', network.magicNumber);

// Get all nodes
const nodes = await client.netmap().getNodes();
```

### Accounting

```typescript
const balance = await client.accounting().getBalance();
console.log(`Balance: ${balance.value} (precision: ${balance.precision})`);
```

### Session Management

```typescript
const currentEpoch = await client.netmap().getCurrentEpoch();
const session = await client.session().createSession(currentEpoch + 100n);
console.log('Session ID:', session.id);
```

### EACL (Extended Access Control)

```typescript
import { Table, Target, Record, Operation, publicReadEACL } from 'neofs-sdk-ts-react-native';

// Quick preset
const eacl = publicReadEACL(containerId);

// Custom rules
const customEacl = new Table(containerId)
  .allowRead([Target.others()])
  .denyWrite([Target.others()])
  .allow(Operation.PUT, [Target.userId(friendId)]);
```

### Bearer Tokens

```typescript
import { BearerToken, publicReadEACL } from 'neofs-sdk-ts-react-native';

const token = new BearerToken()
  .setEACL(publicReadEACL(containerId))
  .forUser(friendUserId)
  .setIssuer(myUserId)
  .setLifetime({
    iat: currentEpoch,
    nbf: currentEpoch,
    exp: currentEpoch + 100n,
  })
  .sign(signer);

const tokenBytes = token.serialize();
```

### Waiter (Async Confirmation)

```typescript
import { Waiter } from 'neofs-sdk-ts-react-native';

const waiter = new Waiter(client);

// Create container and wait for it to exist
const containerId = await waiter.containerPut({
  name: 'my-container',
  basicAcl: BasicACL.PUBLIC_READ,
});

// Upload object and wait for confirmation
const objectId = await waiter.objectPut({
  containerId,
  payload: data,
});
```

## BasicACL Presets

| Preset | Value | Description |
|--------|-------|-------------|
| `BasicACL.PRIVATE` | `0x1C8C8CCC` | Only owner has access |
| `BasicACL.PUBLIC_READ` | `0x1FBF8CFF` | Anyone can read, owner can write |
| `BasicACL.PUBLIC_READ_WRITE` | `0x1FBFBFFF` | Anyone can read and write |
| `BasicACL.PUBLIC_APPEND` | `0x1FBF9FFF` | Anyone can read/append, owner can delete |

## Search MatchTypes

| Type | Value | Description |
|------|-------|-------------|
| `STRING_EQUAL` | `0` | Exact string match |
| `STRING_NOT_EQUAL` | `1` | String does not match |
| `NOT_PRESENT` | `2` | Attribute not present |
| `COMMON_PREFIX` | `3` | String starts with |
| `NUM_GT` | `4` | Numeric greater than |
| `NUM_GE` | `5` | Numeric greater or equal |
| `NUM_LT` | `6` | Numeric less than |
| `NUM_LE` | `7` | Numeric less or equal |

## Error Handling

```typescript
try {
  const data = await client.object().download(containerId, objectId);
} catch (error) {
  if (error.message.includes('NOT_FOUND')) {
    console.log('Object not found');
  } else if (error.message.includes('ACCESS_DENIED')) {
    console.log('Permission denied');
  } else {
    throw error;
  }
}
```

## Configuration

```typescript
interface ReactNativeClientConfig {
  /** gRPC host (without port) */
  host: string;
  
  /** gRPC port */
  port: number;
  
  /** Signer for authentication */
  signer: Signer;
  
  /** Use TLS (default: false) */
  useTls?: boolean;
  
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}
```

## Example App

See the [example](./example) directory for a complete React Native app:

```bash
cd example
npm install
npx react-native run-ios
# or
npx react-native run-android
```

## Architecture

```
src/
├── client/
│   └── react-native/        # Client implementation
│       ├── client.ts        # Main client
│       ├── object-client.ts
│       ├── container-client.ts
│       ├── netmap-client.ts
│       ├── accounting-client.ts
│       ├── session-client.ts
│       └── reputation-client.ts
├── eacl/                    # Extended ACL
├── bearer/                  # Bearer tokens
├── waiter/                  # Async confirmation
└── gen-grpc-react-native/   # Generated protobuf types
```

## Crypto Package

```typescript
import { ECDSASigner, ECDSASignerRFC6979 } from 'neofs-sdk-ts-react-native';

// ECDSA with SHA-512 (FIPS 186-3)
const signer = ECDSASigner.generate();

// Deterministic ECDSA with SHA-256 (RFC 6979)
const signerRFC = ECDSASignerRFC6979.generate();

// Sign data
const signature = signer.sign(data);

// Get public key
const publicKey = signer.public();

// Get user ID (owner ID)
const userId = signer.userId();
```

## Development

```bash
# Build
npm run build

# Run tests
npm test

# Generate protobuf types
npm run generate:all

# Lint
npm run lint

# Format
npm run format
```

## Troubleshooting

### iOS Build Issues

If you encounter build issues on iOS:

```bash
cd ios
pod deintegrate
pod install
```

### Android Connection Issues

Ensure your `AndroidManifest.xml` has internet permission:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

For local development, you may need to add:

```xml
<application
  android:usesCleartextTraffic="true"
  ...>
```

## License

Apache 2.0 - see [LICENSE](../LICENSE) for details.
