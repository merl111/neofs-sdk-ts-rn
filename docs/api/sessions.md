# Session Client

The Session Client provides methods for creating session tokens in NeoFS. Session tokens are used for delegated access and can be attached to requests for authorized operations.

## Access

```typescript
const sessionClient = client.session();
```

## Methods

### createSession()

Create a new session token.

```typescript
async createSession(expirationEpoch: bigint): Promise<SessionToken>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `expirationEpoch` | `bigint` | Epoch when the session expires |

#### Returns

`Promise<SessionToken>` with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `id` | `Uint8Array` | Unique session identifier |
| `sessionKey` | `Uint8Array` | Public key for the session |

#### Example

```typescript
// Get current epoch
const currentEpoch = await client.netmap().getCurrentEpoch();

// Create a session that expires in 100 epochs
const session = await client.session().createSession(currentEpoch + 100n);

console.log('Session ID:', Buffer.from(session.id).toString('hex'));
console.log('Session Key:', Buffer.from(session.sessionKey).toString('hex'));
```

## Raw Proto Method

### create()

The raw method with the same functionality:

```typescript
async create(expiration: bigint): Promise<SessionToken>
```

## Session Token Lifecycle

1. **Creation**: Client requests a session from a storage node
2. **Usage**: Session token is attached to requests for authorization
3. **Expiration**: Session becomes invalid after the expiration epoch
4. **Renewal**: Client must create a new session before expiration

## Use Cases

### Create Session for Batch Operations

```typescript
async function createOperationSession(
  client: ReactNativeNeoFSClient,
  durationEpochs: bigint = 10n
): Promise<SessionToken> {
  const currentEpoch = await client.netmap().getCurrentEpoch();
  const expirationEpoch = currentEpoch + durationEpochs;
  
  return client.session().createSession(expirationEpoch);
}

// Create a short-lived session for a batch operation
const session = await createOperationSession(client, 5n);
```

### Session Pool

```typescript
class SessionPool {
  private client: ReactNativeNeoFSClient;
  private session: SessionToken | null = null;
  private expirationEpoch: bigint = 0n;
  private sessionDuration: bigint;

  constructor(client: ReactNativeNeoFSClient, sessionDuration: bigint = 100n) {
    this.client = client;
    this.sessionDuration = sessionDuration;
  }

  async getSession(): Promise<SessionToken> {
    const currentEpoch = await this.client.netmap().getCurrentEpoch();
    
    // Renew session if expired or will expire soon
    if (!this.session || currentEpoch >= this.expirationEpoch - 5n) {
      this.expirationEpoch = currentEpoch + this.sessionDuration;
      this.session = await this.client.session().createSession(this.expirationEpoch);
    }
    
    return this.session;
  }
}

// Usage
const sessionPool = new SessionPool(client);
const session = await sessionPool.getSession();
```

### Calculate Expiration Time

```typescript
async function getSessionExpirationTime(
  client: ReactNativeNeoFSClient,
  expirationEpoch: bigint
): Promise<Date> {
  const network = await client.netmap().getNetwork();
  const currentEpoch = network.currentEpoch;
  const msPerBlock = network.msPerBlock;
  
  // Estimate: assume ~1 block per epoch (simplified)
  const epochsRemaining = expirationEpoch - currentEpoch;
  const msRemaining = epochsRemaining * msPerBlock;
  
  return new Date(Date.now() + Number(msRemaining));
}

const session = await client.session().createSession(currentEpoch + 100n);
const expiresAt = await getSessionExpirationTime(client, currentEpoch + 100n);
console.log('Session expires at:', expiresAt.toISOString());
```

## Best Practices

1. **Set appropriate expiration**: Use short-lived sessions for security, long-lived for convenience
2. **Handle expiration gracefully**: Catch errors and renew sessions when they expire
3. **Reuse sessions**: Don't create a new session for every request
4. **Clean up**: Let sessions expire naturally; no explicit cleanup needed

## Session vs Bearer Tokens

| Feature | Session Token | Bearer Token |
|---------|---------------|--------------|
| Created by | Storage node | User (self-signed) |
| Purpose | Delegated operations | Access control override |
| Scope | All operations | Specific operations |
| Requires network | Yes (creation) | No |
