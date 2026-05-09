import { describe, it, expect } from 'vitest';

import { createTestSigner } from '../test/test-signer';
import { publicReadEACL, Table } from '../eacl';

import { BearerToken } from './token';

describe('BearerToken', () => {
  const owner = new Uint8Array(25).fill(11);
  const user = new Uint8Array(25).fill(22);
  const table = publicReadEACL(new Uint8Array(32));

  it('builds fluent API and signs', () => {
    const signer = createTestSigner();
    const token = new BearerToken()
      .setEACL(table)
      .forUser(user)
      .setIssuer(owner)
      .setLifetime({ iat: 1n, nbf: 1n, exp: 10n })
      .sign(signer);

    expect(token.isSigned).toBe(true);
    expect(token.eaclTable).toBe(table);
    expect(token.targetUser).toEqual(user);
    expect(token.issuer).toEqual(owner);
    expect(token.lifetime).toEqual({ iat: 1n, nbf: 1n, exp: 10n });
    expect(token.verify()).toBe(true);
  });

  it('updates lifetime helpers', () => {
    const token = new BearerToken()
      .setExpiration(5n)
      .setNotBefore(2n)
      .setIssuedAt(1n);

    expect(token.lifetime).toEqual({ exp: 5n, nbf: 2n, iat: 1n });
  });

  it('serialize and deserialize round-trip', () => {
    const signer = createTestSigner();
    const original = new BearerToken()
      .setEACL(table)
      .setIssuer(owner)
      .setLifetime({ iat: 0n, nbf: 0n, exp: 99n })
      .sign(signer);

    const copy = BearerToken.deserialize(original.serialize());
    expect(copy.isSigned).toBe(true);
    expect(copy.targetUser).toBeUndefined();
    expect(copy.eaclTable?.records.length).toBe(table.records.length);
  });

  it('fromProto restores fields', () => {
    const proto = new BearerToken()
      .setEACL(table)
      .forUser(user)
      .setIssuer(owner)
      .setLifetime({ iat: 1n, nbf: 2n, exp: 3n })
      .toProto();

    const rt = BearerToken.fromProto(proto);
    expect(rt.targetUser).toEqual(user);
    expect(rt.issuer).toEqual(owner);
  });

  it('clone duplicates internal state', () => {
    const signer = createTestSigner();
    const a = new BearerToken()
      .setEACL(new Table())
      .setIssuer(owner)
      .sign(signer);

    const b = a.clone();
    expect(b.serialize()).toEqual(a.serialize());
    expect(b.eaclTable).not.toBe(a.eaclTable);
  });

  it('verify returns false when unsigned', () => {
    expect(new BearerToken().verify()).toBe(false);
  });
});
