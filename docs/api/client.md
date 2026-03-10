# ReactNativeNeoFSClient

The main client for interacting with the NeoFS network. This client manages the gRPC connection and provides access to all service clients.

## Constructor

```typescript
new ReactNativeNeoFSClient(config: ReactNativeClientConfig)
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config.host` | `string` | Yes | gRPC host address (without port) |
| `config.port` | `number` | Yes | gRPC port number |
| `config.signer` | `Signer` | Yes | Signer for request authentication |
| `config.useTls` | `boolean` | No | Enable TLS (default: `false`) |
| `config.timeout` | `number` | No | Request timeout in ms (default: `30000`) |

### Example

```typescript
import { ReactNativeNeoFSClient } from 'neofs-sdk-ts';

const client = new ReactNativeNeoFSClient({
  host: 'grpc.testnet.neofs.io',
  port: 8082,
  signer: mySigner,
  useTls: false,
  timeout: 60000,
});
```

## Methods

### connect()

Establishes a connection to the NeoFS network.

```typescript
async connect(): Promise<void>
```

**Example:**

```typescript
await client.connect();
console.log('Connected to NeoFS');
```

---

### disconnect()

Closes the connection to the NeoFS network.

```typescript
async disconnect(): Promise<void>
```

**Example:**

```typescript
await client.disconnect();
console.log('Disconnected from NeoFS');
```

---

### object()

Returns the object client for managing objects.

```typescript
object(): ReactNativeObjectClient
```

**Example:**

```typescript
const objectClient = client.object();
const objectId = await objectClient.upload({ containerId, payload });
```

See: [Object Client API](./objects.md)

---

### container()

Returns the container client for managing containers.

```typescript
container(): ReactNativeContainerClient
```

**Example:**

```typescript
const containerClient = client.container();
const containerId = await containerClient.create({ name: 'my-files' });
```

See: [Container Client API](./containers.md)

---

### netmap()

Returns the netmap client for network information.

```typescript
netmap(): ReactNativeNetmapClient
```

**Example:**

```typescript
const netmapClient = client.netmap();
const epoch = await netmapClient.getCurrentEpoch();
```

See: [Netmap Client API](./netmap.md)

---

### accounting()

Returns the accounting client for balance queries.

```typescript
accounting(): ReactNativeAccountingClient
```

**Example:**

```typescript
const accountingClient = client.accounting();
const balance = await accountingClient.getBalance();
```

See: [Accounting Client API](./accounting.md)

---

### session()

Returns the session client for session management.

```typescript
session(): ReactNativeSessionClient
```

**Example:**

```typescript
const sessionClient = client.session();
const token = await sessionClient.createSession(expirationEpoch);
```

See: [Session Client API](./sessions.md)

---

### reputation()

Returns the reputation client for trust management.

```typescript
reputation(): ReactNativeReputationClient
```

**Example:**

```typescript
const reputationClient = client.reputation();
await reputationClient.announceTrust(epoch, trusts);
```

See: [Reputation Client API](./reputation.md)

## Complete Example

```typescript
import { ReactNativeNeoFSClient, BasicACL } from 'neofs-sdk-ts';

async function main() {
  const client = new ReactNativeNeoFSClient({
    host: 'grpc.testnet.neofs.io',
    port: 8082,
    signer: mySigner,
  });

  await client.connect();

  try {
    // Check network status
    const epoch = await client.netmap().getCurrentEpoch();
    console.log('Current epoch:', epoch);

    // Check balance
    const balance = await client.accounting().getBalance();
    console.log('Balance:', balance.value);

    // Create a container
    const containerId = await client.container().create({
      name: 'documents',
      basicAcl: BasicACL.PUBLIC_READ,
    });

    // Upload an object
    const objectId = await client.object().upload({
      containerId,
      payload: new TextEncoder().encode('Hello!'),
      filename: 'hello.txt',
    });

    // Download the object
    const { payload } = await client.object().download(containerId, objectId);
    console.log('Content:', new TextDecoder().decode(payload));

  } finally {
    await client.disconnect();
  }
}
```
