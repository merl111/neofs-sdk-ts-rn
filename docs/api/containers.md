# Container Client

The Container Client provides methods for creating, listing, and managing containers in NeoFS.

## Access

```typescript
const containerClient = client.container();
```

## User-Friendly Methods

### create()

Create a new container.

```typescript
async create(options?: ContainerCreateOptions): Promise<Uint8Array>
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `options.name` | `string` | No | - | Container name (adds Name attribute) |
| `options.basicAcl` | `BasicACL \| number` | No | `PRIVATE` | Access control |
| `options.placementPolicy` | `string` | No | `"REP 2"` | Replica placement policy |
| `options.attributes` | `ObjectAttribute[]` | No | `[]` | Custom attributes |
| `options.nonce` | `Uint8Array` | No | Random | 16-byte nonce |

#### Returns

`Promise<Uint8Array>` - The container ID

#### Example

```typescript
import { BasicACL } from 'neofs-sdk-ts';

// Create a private container
const containerId = await client.container().create({
  name: 'my-private-files',
});

// Create a public read container
const containerId = await client.container().create({
  name: 'public-assets',
  basicAcl: BasicACL.PUBLIC_READ,
  placementPolicy: 'REP 3',
});

// Create with custom attributes
const containerId = await client.container().create({
  name: 'project-docs',
  basicAcl: BasicACL.PUBLIC_READ,
  attributes: [
    { key: 'Project', value: 'NeoFS SDK' },
    { key: 'Environment', value: 'production' },
  ],
});
```

---

### getInfo()

Get container information.

```typescript
async getInfo(containerId: Uint8Array): Promise<ContainerInfo | undefined>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `containerId` | `Uint8Array` | Container ID |

#### Returns

`Promise<ContainerInfo | undefined>` - Container info or undefined if not found

#### Example

```typescript
const info = await client.container().getInfo(containerId);

if (info) {
  console.log('Name:', info.name);
  console.log('Owner:', info.ownerId);
  console.log('Basic ACL:', info.basicAcl.toString(16));
  console.log('Created:', info.createdAt);
  console.log('Policy:', info.placementPolicy);
  console.log('Attributes:', info.attributes);
}
```

---

### remove()

Delete a container.

```typescript
async remove(containerId: Uint8Array): Promise<void>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `containerId` | `Uint8Array` | Container ID to delete |

#### Example

```typescript
await client.container().remove(containerId);
console.log('Container deleted');
```

> **Note:** A container can only be deleted if it's empty (contains no objects).

---

### listAll()

List all container IDs owned by the current user.

```typescript
async listAll(): Promise<Uint8Array[]>
```

#### Returns

`Promise<Uint8Array[]>` - Array of container IDs

#### Example

```typescript
const containerIds = await client.container().listAll();
console.log('Found', containerIds.length, 'containers');

for (const id of containerIds) {
  console.log('Container:', Buffer.from(id).toString('hex'));
}
```

---

### listWithInfo()

List all containers with full information.

```typescript
async listWithInfo(): Promise<ContainerInfo[]>
```

#### Returns

`Promise<ContainerInfo[]>` - Array of container info objects

#### Example

```typescript
const containers = await client.container().listWithInfo();

for (const container of containers) {
  console.log(`${container.name || 'Unnamed'}`);
  console.log(`  ID: ${Buffer.from(container.containerId).toString('hex')}`);
  console.log(`  ACL: ${container.basicAcl.toString(16)}`);
  console.log(`  Policy: ${container.placementPolicy}`);
  console.log('');
}
```

## Raw Proto Methods

For advanced use cases, the following raw methods are available:

### put()

```typescript
async put(container: Container, signature?: SignatureRFC6979): Promise<ContainerID>
```

### get()

```typescript
async get(containerId: ContainerID): Promise<Container | undefined>
```

### delete()

```typescript
async delete(containerId: ContainerID, signature?: SignatureRFC6979): Promise<void>
```

### list()

```typescript
async list(ownerId?: Uint8Array): Promise<ContainerID[]>
```

### setExtendedACL()

```typescript
async setExtendedACL(eacl: EACLTable, signature?: SignatureRFC6979): Promise<void>
```

### getExtendedACL()

```typescript
async getExtendedACL(containerId: ContainerID): Promise<EACLTable | undefined>
```

### setAttribute()

```typescript
async setAttribute(
  containerId: ContainerID,
  attribute: string,
  value: string,
  validUntil?: bigint
): Promise<void>
```

### removeAttribute()

```typescript
async removeAttribute(
  containerId: ContainerID,
  attribute: string,
  validUntil?: bigint
): Promise<void>
```

### announceUsedSpace()

```typescript
async announceUsedSpace(
  announcements: Array<{ containerId: ContainerID; usedSpace: bigint; epoch: bigint }>
): Promise<void>
```

## Basic ACL Presets

| Preset | Value | Description |
|--------|-------|-------------|
| `BasicACL.PRIVATE` | `0x1C8C8CCC` | Only owner has full access |
| `BasicACL.PUBLIC_READ` | `0x1FBF8CFF` | Anyone can read, only owner can write |
| `BasicACL.PUBLIC_READ_WRITE` | `0x1FBFBFFF` | Anyone can read and write |
| `BasicACL.PUBLIC_APPEND` | `0x1FBF9FFF` | Anyone can read/append, only owner can delete |

### Custom ACL Values

For fine-grained access control, you can provide a custom ACL value:

```typescript
// Custom ACL: owner full access, others read-only, no bearer tokens
const containerId = await client.container().create({
  name: 'custom-acl',
  basicAcl: 0x0FBFBFFF,
});
```

See the [NeoFS specification](https://docs.neofs.io/) for details on ACL bit fields.

## Placement Policies

Placement policies define how objects are replicated across the network.

### Simple Replication

```typescript
// Store 2 copies
const containerId = await client.container().create({
  placementPolicy: 'REP 2',
});

// Store 3 copies
const containerId = await client.container().create({
  placementPolicy: 'REP 3',
});
```

### Advanced Policies

For complex placement requirements (geo-distribution, specific node selection), use the raw `put()` method with a fully constructed `PlacementPolicy` object.

```typescript
// Example: Require copies in different countries
const policy = new PlacementPolicyImpl({
  Replicas: [
    new ReplicaImpl({ Count: 2, Selector: 'EU' }),
    new ReplicaImpl({ Count: 1, Selector: 'US' }),
  ],
  Selectors: [
    new SelectorImpl({ Name: 'EU', Count: 2, Filter: 'EU_NODES' }),
    new SelectorImpl({ Name: 'US', Count: 1, Filter: 'US_NODES' }),
  ],
  Filters: [
    new FilterImpl({ Name: 'EU_NODES', Key: 'Country', Value: 'EU', Op: FilterOperation.EQ }),
    new FilterImpl({ Name: 'US_NODES', Key: 'Country', Value: 'US', Op: FilterOperation.EQ }),
  ],
});
```
