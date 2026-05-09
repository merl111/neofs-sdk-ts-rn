import { createSigner, type Signer } from '@axlabs/neofs-sdk-ts-core/crypto';

import type { ReactNativeClientConfig } from '../client/react-native/types';

/** Deterministic test private key (32-byte hex). Do not use in production. */
const TEST_PRIVATE_KEY_HEX = '0x' + '01'.repeat(32);

export function createTestSigner(): Signer {
  return createSigner(TEST_PRIVATE_KEY_HEX);
}

export function createTestClientConfig(
  overrides: Partial<Omit<ReactNativeClientConfig, 'signer'>> = {},
): ReactNativeClientConfig {
  return {
    host: '127.0.0.1',
    port: 8080,
    signer: createTestSigner(),
    ...overrides,
  };
}
