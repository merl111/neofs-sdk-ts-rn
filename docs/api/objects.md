# Object Client

The Object Client provides methods for uploading, downloading, searching, and deleting objects in NeoFS containers.

## Access

```typescript
const objectClient = client.object();
```

## User-Friendly Methods

### upload()

Upload an object to a container.

```typescript
async upload(options: ObjectPutOptions): Promise<Uint8Array>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options.containerId` | `Uint8Array` | Yes | Target container ID |
| `options.payload` | `Uint8Array` | Yes | Object data |
| `options.filename` | `string` | No | Adds `FileName` attribute |
| `options.contentType` | `string` | No | Adds `ContentType` attribute |
| `options.attributes` | `ObjectAttribute[]` | No | Custom attributes |
| `options.chunkSize` | `number` | No | Upload chunk size (default: 1MB) |

#### Returns

`Promise<Uint8Array>` - The object ID

#### Example

```typescript
// Simple upload
const objectId = await client.object().upload({
  containerId,
  payload: new TextEncoder().encode('Hello, World!'),
});

// Upload with metadata
const objectId = await client.object().upload({
  containerId,
  payload: imageBuffer,
  filename: 'photo.jpg',
  contentType: 'image/jpeg',
  attributes: [
    { key: 'Album', value: 'Vacation 2024' },
    { key: 'Location', value: 'Paris' },
  ],
});
```

---

### download()

Download an object with its metadata.

```typescript
async download(containerId: Uint8Array, objectId: Uint8Array): Promise<ObjectData>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `containerId` | `Uint8Array` | Container ID |
| `objectId` | `Uint8Array` | Object ID |

#### Returns

`Promise<ObjectData>` - Object with `info` (metadata) and `payload` (data)

#### Example

```typescript
const { info, payload } = await client.object().download(containerId, objectId);

console.log('Size:', info.payloadSize);
console.log('Type:', info.objectType);
console.log('Attributes:', info.attributes);
console.log('Content:', new TextDecoder().decode(payload));
```

---

### getInfo()

Get object metadata without downloading the payload.

```typescript
async getInfo(containerId: Uint8Array, objectId: Uint8Array): Promise<ObjectInfo | undefined>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `containerId` | `Uint8Array` | Container ID |
| `objectId` | `Uint8Array` | Object ID |

#### Returns

`Promise<ObjectInfo | undefined>` - Object metadata or undefined if not found

#### Example

```typescript
const info = await client.object().getInfo(containerId, objectId);

if (info) {
  console.log('Object ID:', info.objectId);
  console.log('Size:', info.payloadSize);
  console.log('Created at epoch:', info.creationEpoch);
  
  const filename = info.attributes.find(a => a.key === 'FileName');
  console.log('Filename:', filename?.value);
}
```

---

### remove()

Delete an object from a container.

```typescript
async remove(containerId: Uint8Array, objectId: Uint8Array): Promise<Uint8Array>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `containerId` | `Uint8Array` | Container ID |
| `objectId` | `Uint8Array` | Object ID to delete |

#### Returns

`Promise<Uint8Array>` - Tombstone object ID

#### Example

```typescript
const tombstoneId = await client.object().remove(containerId, objectId);
console.log('Object deleted, tombstone:', tombstoneId);
```

---

### find()

Search for objects in a container.

```typescript
async find(options: SearchOptions): Promise<Uint8Array[]>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options.containerId` | `Uint8Array` | Yes | Container to search |
| `options.filters` | `SearchFilter[]` | No | Search filters |

#### Returns

`Promise<Uint8Array[]>` - Array of matching object IDs

#### Example

```typescript
import { MatchType } from 'neofs-sdk-ts';

// Find all objects
const allObjects = await client.object().find({
  containerId,
});

// Find by attribute
const pdfs = await client.object().find({
  containerId,
  filters: [
    { key: 'ContentType', value: 'application/pdf', matchType: MatchType.STRING_EQUAL },
  ],
});

// Find with prefix match
const docs = await client.object().find({
  containerId,
  filters: [
    { key: 'FileName', value: 'report_', matchType: MatchType.COMMON_PREFIX },
  ],
});
```

---

### findPaginated()

Search for objects with pagination support.

```typescript
async findPaginated(options: SearchV2Options): Promise<SearchV2Result>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options.containerId` | `Uint8Array` | Yes | Container to search |
| `options.filters` | `SearchFilter[]` | No | Search filters |
| `options.cursor` | `string` | No | Pagination cursor |
| `options.limit` | `number` | No | Max results per page |
| `options.attributes` | `string[]` | No | Attributes to return |

#### Returns

`Promise<SearchV2Result>` - Results with `objects` array and `cursor` for next page

#### Example

```typescript
// First page
const page1 = await client.object().findPaginated({
  containerId,
  limit: 50,
});

console.log('Found:', page1.objects.length);

// Next page (if cursor is not empty)
if (page1.cursor) {
  const page2 = await client.object().findPaginated({
    containerId,
    cursor: page1.cursor,
    limit: 50,
  });
}

// Iterate all pages
async function* getAllObjects(containerId: Uint8Array) {
  let cursor: string | undefined;
  
  do {
    const result = await client.object().findPaginated({
      containerId,
      cursor,
      limit: 100,
    });
    
    for (const obj of result.objects) {
      yield obj;
    }
    
    cursor = result.cursor;
  } while (cursor);
}
```

---

### downloadRange()

Download a specific byte range from an object.

```typescript
async downloadRange(
  containerId: Uint8Array,
  objectId: Uint8Array,
  offset: bigint,
  length: bigint
): Promise<Uint8Array>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `containerId` | `Uint8Array` | Container ID |
| `objectId` | `Uint8Array` | Object ID |
| `offset` | `bigint` | Start byte offset |
| `length` | `bigint` | Number of bytes to read |

#### Returns

`Promise<Uint8Array>` - Requested byte range

#### Example

```typescript
// Read first 1KB
const header = await client.object().downloadRange(
  containerId,
  objectId,
  0n,
  1024n
);

// Read bytes 1000-2000
const chunk = await client.object().downloadRange(
  containerId,
  objectId,
  1000n,
  1000n
);
```

## Raw Proto Methods

For advanced use cases, the following raw methods are available:

### get()

```typescript
async get(address: Address, raw?: boolean): Promise<{ header?: Header; payload: Uint8Array }>
```

### put()

```typescript
async put(
  containerId: ContainerID,
  payload: Uint8Array,
  attributes?: ObjectAttribute[],
  chunkSize?: number
): Promise<ObjectID>
```

### head()

```typescript
async head(address: Address, raw?: boolean): Promise<Header | undefined>
```

### delete()

```typescript
async delete(address: Address): Promise<Address>
```

### search()

```typescript
async search(
  containerId: ContainerID,
  filters?: Array<{ key: string; value: string; matchType: number }>
): Promise<ObjectID[]>
```

### getRangeHash()

```typescript
async getRangeHash(
  address: Address,
  ranges: Array<{ offset: bigint; length: bigint }>,
  salt?: Uint8Array,
  checksumType?: ChecksumType
): Promise<Uint8Array[]>
```

### replicate()

```typescript
async replicate(object: Object, signature: Signature): Promise<{ status: number }>
```

## Search Filters

| MatchType | Description | Example |
|-----------|-------------|---------|
| `STRING_EQUAL` | Exact string match | `FileName = "report.pdf"` |
| `STRING_NOT_EQUAL` | String does not match | `Status != "deleted"` |
| `NOT_PRESENT` | Attribute does not exist | Key not set |
| `COMMON_PREFIX` | String starts with | `FileName ^= "report_"` |
| `NUM_GT` | Numeric greater than | `Size > 1000` |
| `NUM_GE` | Numeric greater or equal | `Size >= 1000` |
| `NUM_LT` | Numeric less than | `Size < 1000` |
| `NUM_LE` | Numeric less or equal | `Size <= 1000` |
