# Reputation Client

The Reputation Client provides methods for announcing trust values in the NeoFS network's reputation system. This is primarily used by storage nodes to rate each other's reliability.

## Access

```typescript
const reputationClient = client.reputation();
```

## User-Friendly Methods

### announceTrust()

Announce trust values for peers.

```typescript
async announceTrust(epoch: bigint, trusts: Trust[]): Promise<void>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `epoch` | `bigint` | Epoch for which trust is being announced |
| `trusts` | `Trust[]` | Array of trust values |

#### Trust Object

| Property | Type | Description |
|----------|------|-------------|
| `peer` | `Uint8Array` | Public key of the peer being rated |
| `value` | `number` | Trust value from 0.0 (no trust) to 1.0 (full trust) |

#### Example

```typescript
const currentEpoch = await client.netmap().getCurrentEpoch();

await client.reputation().announceTrust(currentEpoch, [
  { peer: node1PublicKey, value: 0.95 },
  { peer: node2PublicKey, value: 0.80 },
  { peer: node3PublicKey, value: 0.60 },
]);

console.log('Trust values announced');
```

## Raw Proto Methods

### announceLocalTrust()

Announce local trust values using raw proto types.

```typescript
async announceLocalTrust(epoch: bigint, trusts: Trust[]): Promise<void>
```

#### Example

```typescript
const trusts = [
  new TrustImpl({
    Peer: new PeerIDImpl({ PublicKey: peerKey }),
    Value: 0.9,
  }),
];

await client.reputation().announceLocalTrust(epoch, trusts);
```

### announceIntermediateResult()

Announce intermediate trust calculation results (for EigenTrust algorithm).

```typescript
async announceIntermediateResult(
  epoch: bigint,
  iteration: number,
  trust: PeerToPeerTrust
): Promise<void>
```

#### Example

```typescript
const peerToPeerTrust = new PeerToPeerTrustImpl({
  TrustingPeer: new PeerIDImpl({ PublicKey: myPublicKey }),
  Trust: new TrustImpl({
    Peer: new PeerIDImpl({ PublicKey: targetPeerKey }),
    Value: 0.85,
  }),
});

await client.reputation().announceIntermediateResult(
  currentEpoch,
  1, // iteration number
  peerToPeerTrust
);
```

## Trust Values

Trust values are floating-point numbers between 0.0 and 1.0:

| Value | Meaning |
|-------|---------|
| 0.0 | No trust / unreliable |
| 0.5 | Neutral / unknown |
| 1.0 | Full trust / highly reliable |

## Reputation System Overview

NeoFS uses the EigenTrust algorithm for decentralized reputation:

1. **Local Trust**: Each node rates peers it interacts with
2. **Aggregation**: Trust values are aggregated across the network
3. **Global Trust**: A global reputation score is computed
4. **Usage**: Reputation affects node selection for storage operations

## Use Cases

### Rate Nodes After Operations

```typescript
async function rateNodeAfterOperation(
  client: ReactNativeNeoFSClient,
  nodePublicKey: Uint8Array,
  success: boolean,
  responseTime: number
): Promise<void> {
  const epoch = await client.netmap().getCurrentEpoch();
  
  // Calculate trust based on performance
  let trust = success ? 0.8 : 0.2;
  
  // Bonus for fast responses
  if (success && responseTime < 100) {
    trust = Math.min(1.0, trust + 0.15);
  }
  
  await client.reputation().announceTrust(epoch, [
    { peer: nodePublicKey, value: trust },
  ]);
}
```

### Batch Trust Announcements

```typescript
interface NodePerformance {
  publicKey: Uint8Array;
  successRate: number;
  avgResponseTime: number;
}

async function announceBatchTrust(
  client: ReactNativeNeoFSClient,
  performances: NodePerformance[]
): Promise<void> {
  const epoch = await client.netmap().getCurrentEpoch();
  
  const trusts = performances.map(perf => {
    // Convert performance metrics to trust value
    const baseTrust = perf.successRate;
    const timeBonus = Math.max(0, (1000 - perf.avgResponseTime) / 2000);
    const trust = Math.min(1.0, baseTrust + timeBonus);
    
    return {
      peer: perf.publicKey,
      value: trust,
    };
  });
  
  await client.reputation().announceTrust(epoch, trusts);
}
```

## Important Notes

1. **Storage Node Feature**: Trust announcements are primarily used by storage nodes, not regular clients
2. **Epoch-Specific**: Trust values are tied to specific epochs
3. **Aggregation**: Individual trust values are aggregated using EigenTrust
4. **Privacy**: Trust announcements are public and verifiable
5. **Rate Limiting**: Excessive announcements may be rate-limited by the network
