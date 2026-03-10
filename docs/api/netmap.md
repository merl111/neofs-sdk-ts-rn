# Netmap Client

The Netmap Client provides methods for querying network information, including node status, network configuration, and current epoch.

## Access

```typescript
const netmapClient = client.netmap();
```

## User-Friendly Methods

### getCurrentEpoch()

Get the current network epoch number.

```typescript
async getCurrentEpoch(): Promise<bigint>
```

#### Returns

`Promise<bigint>` - Current epoch number

#### Example

```typescript
const epoch = await client.netmap().getCurrentEpoch();
console.log('Current epoch:', epoch);

// Use epoch for session expiration
const sessionExpiration = epoch + 100n; // Expires in ~100 epochs
```

---

### getNetwork()

Get comprehensive network information.

```typescript
async getNetwork(): Promise<NetworkInfo>
```

#### Returns

`Promise<NetworkInfo>` with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `currentEpoch` | `bigint` | Current epoch number |
| `magicNumber` | `bigint` | Network magic number (identifies the network) |
| `msPerBlock` | `bigint` | Milliseconds per block |
| `config` | `Map<string, Uint8Array>` | Network configuration parameters |

#### Example

```typescript
const network = await client.netmap().getNetwork();

console.log('Current epoch:', network.currentEpoch);
console.log('Network magic:', network.magicNumber);
console.log('Ms per block:', network.msPerBlock);

// Access configuration parameters
for (const [key, value] of network.config) {
  console.log(`${key}: ${Buffer.from(value).toString('hex')}`);
}
```

---

### getLocalNode()

Get information about the node you're connected to.

```typescript
async getLocalNode(): Promise<LocalNodeInfo>
```

#### Returns

`Promise<LocalNodeInfo>` with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `version.major` | `number` | Major version number |
| `version.minor` | `number` | Minor version number |
| `node` | `NodeInfo` | Node information |

#### Example

```typescript
const localNode = await client.netmap().getLocalNode();

console.log('Node version:', `${localNode.version.major}.${localNode.version.minor}`);
console.log('Addresses:', localNode.node.addresses.join(', '));
console.log('State:', localNode.node.state);
console.log('Public key:', Buffer.from(localNode.node.publicKey).toString('hex'));

// Check node attributes
for (const attr of localNode.node.attributes) {
  console.log(`${attr.key}: ${attr.value}`);
}
```

---

### getNodes()

Get information about all nodes in the network.

```typescript
async getNodes(): Promise<NodeInfo[]>
```

#### Returns

`Promise<NodeInfo[]>` - Array of node information

#### Example

```typescript
const nodes = await client.netmap().getNodes();

console.log('Total nodes:', nodes.length);

for (const node of nodes) {
  const stateStr = ['UNSPECIFIED', 'ONLINE', 'OFFLINE', 'MAINTENANCE'][node.state];
  console.log(`Node: ${node.addresses[0]} - ${stateStr}`);
  
  // Find location attribute
  const location = node.attributes.find(a => a.key === 'Location');
  if (location) {
    console.log(`  Location: ${location.value}`);
  }
}

// Count online nodes
const onlineCount = nodes.filter(n => n.state === NodeState.ONLINE).length;
console.log('Online nodes:', onlineCount);
```

## Raw Proto Methods

For advanced use cases, the following raw methods are available:

### localNodeInfo()

```typescript
async localNodeInfo(): Promise<{
  version: Version | undefined;
  nodeInfo: NodeInfo | undefined;
}>
```

### networkInfo()

```typescript
async networkInfo(): Promise<NetworkInfo | undefined>
```

### netmapSnapshot()

```typescript
async netmapSnapshot(): Promise<Netmap | undefined>
```

## Node States

| State | Value | Description |
|-------|-------|-------------|
| `NodeState.UNSPECIFIED` | `0` | State not specified |
| `NodeState.ONLINE` | `1` | Node is online and accepting requests |
| `NodeState.OFFLINE` | `2` | Node is offline |
| `NodeState.MAINTENANCE` | `3` | Node is in maintenance mode |

## Common Node Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| `Capacity` | Storage capacity in bytes | `"1073741824"` |
| `Location` | Geographic location | `"Europe/Berlin"` |
| `Country` | Country code | `"DE"` |
| `City` | City name | `"Berlin"` |
| `Price` | Storage price per GB | `"0.01"` |
| `UN-LOCODE` | UN location code | `"DE BER"` |

## Use Cases

### Health Check

```typescript
async function healthCheck(client: ReactNativeNeoFSClient): Promise<boolean> {
  try {
    const localNode = await client.netmap().getLocalNode();
    return localNode.node.state === NodeState.ONLINE;
  } catch {
    return false;
  }
}
```

### Find Best Nodes

```typescript
async function findNodesByLocation(
  client: ReactNativeNeoFSClient,
  country: string
): Promise<NodeInfo[]> {
  const nodes = await client.netmap().getNodes();
  
  return nodes.filter(node => {
    if (node.state !== NodeState.ONLINE) return false;
    
    const countryAttr = node.attributes.find(a => a.key === 'Country');
    return countryAttr?.value === country;
  });
}

const germanNodes = await findNodesByLocation(client, 'DE');
```

### Monitor Network

```typescript
async function monitorNetwork(client: ReactNativeNeoFSClient) {
  let lastEpoch = 0n;
  
  setInterval(async () => {
    const network = await client.netmap().getNetwork();
    
    if (network.currentEpoch !== lastEpoch) {
      console.log('New epoch:', network.currentEpoch);
      lastEpoch = network.currentEpoch;
    }
  }, 15000); // Check every 15 seconds
}
```
