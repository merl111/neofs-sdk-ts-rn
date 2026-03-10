# Accounting Client

The Accounting Client provides methods for querying account balances in the NeoFS network.

## Access

```typescript
const accountingClient = client.accounting();
```

## Methods

### getBalance()

Get the balance for an account.

```typescript
async getBalance(ownerId?: Uint8Array): Promise<Balance>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ownerId` | `Uint8Array` | No | Owner ID to query (defaults to current signer) |

#### Returns

`Promise<Balance>` with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `value` | `bigint` | Balance in smallest units |
| `precision` | `number` | Decimal precision |

#### Example

```typescript
// Get own balance
const balance = await client.accounting().getBalance();
console.log('Balance:', balance.value);
console.log('Precision:', balance.precision);

// Calculate human-readable balance
const divisor = BigInt(10 ** balance.precision);
const wholeUnits = balance.value / divisor;
const fractional = balance.value % divisor;
console.log(`Balance: ${wholeUnits}.${fractional.toString().padStart(balance.precision, '0')}`);
```

#### Querying Other Accounts

```typescript
// Query another account's balance
const otherOwnerId = new Uint8Array([...]); // 25-byte owner ID
const otherBalance = await client.accounting().getBalance(otherOwnerId);
```

## Raw Proto Method

### balance()

The raw method with the same signature as `getBalance()`:

```typescript
async balance(ownerId?: Uint8Array): Promise<Balance>
```

## Balance Precision

The balance is returned as a `bigint` value with a specified precision. To convert to a decimal:

```typescript
function formatBalance(balance: Balance): string {
  const { value, precision } = balance;
  
  if (precision === 0) {
    return value.toString();
  }
  
  const divisor = BigInt(10 ** precision);
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;
  
  return `${wholePart}.${fractionalPart.toString().padStart(precision, '0')}`;
}

const balance = await client.accounting().getBalance();
console.log('Formatted balance:', formatBalance(balance));
```

## Use Cases

### Check Sufficient Balance

```typescript
async function hasMinimumBalance(
  client: ReactNativeNeoFSClient,
  minimumValue: bigint
): Promise<boolean> {
  const balance = await client.accounting().getBalance();
  return balance.value >= minimumValue;
}

if (await hasMinimumBalance(client, 1000000n)) {
  console.log('Sufficient balance for operation');
} else {
  console.log('Insufficient balance');
}
```

### Monitor Balance Changes

```typescript
async function monitorBalance(client: ReactNativeNeoFSClient) {
  let lastBalance = 0n;
  
  setInterval(async () => {
    const { value } = await client.accounting().getBalance();
    
    if (value !== lastBalance) {
      const change = value - lastBalance;
      const changeStr = change > 0 ? `+${change}` : change.toString();
      console.log(`Balance changed: ${changeStr} (now: ${value})`);
      lastBalance = value;
    }
  }, 60000); // Check every minute
}
```
