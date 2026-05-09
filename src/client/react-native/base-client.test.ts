import { describe, it, expect } from 'vitest';

import { NeoFsV2Refs } from '../../gen-grpc-react-native/refs/types_types';
import { NeoFsV2Object } from '../../gen-grpc-react-native/object/types_types';
import { NeoFsV2Container } from '../../gen-grpc-react-native/container/types_types';
import { NeoFsV2Netmap } from '../../gen-grpc-react-native/netmap/types_types';
import { NeoFsV2Session } from '../../gen-grpc-react-native/session/types_types';
import { NeoFsV2Status } from '../../gen-grpc-react-native/status/types_types';
import { NeoFsV2Acl } from '../../gen-grpc-react-native/acl/types_types';
import { BearerToken } from '../../bearer/token';
import { createTestClientConfig } from '../../test/test-signer';

import {
  BaseServiceClient,
  NeoFSError,
  type RequestOptions,
} from './base-client';
import type { ReactNativeClientConfig } from './types';

class BaseClientHarness extends BaseServiceClient {
  constructor(config: ReactNativeClientConfig) {
    super(config);
  }

  public meta(options?: RequestOptions): NeoFsV2Session.RequestMetaHeaderImpl {
    return this.createMetaHeader(options);
  }

  public verify(
    bodyBytes: Uint8Array,
    meta: NeoFsV2Session.RequestMetaHeaderImpl,
  ): NeoFsV2Session.RequestVerificationHeaderImpl {
    return this.createVerificationHeader(bodyBytes, meta);
  }

  public owner(): NeoFsV2Refs.OwnerIDImpl {
    return this.getOwnerID();
  }

  public toObjectInfo(
    header: NeoFsV2Object.Header,
    objectId?: Uint8Array,
  ) {
    return this.headerToObjectInfo(header, objectId);
  }

  public toContainerInfo(
    container: NeoFsV2Container.Container,
    containerId?: Uint8Array,
  ) {
    return this.containerToInfo(container, containerId);
  }

  public policyString(policy?: NeoFsV2Netmap.PlacementPolicy): string | undefined {
    return this.policyToString(policy);
  }

  public checkMeta(meta?: NeoFsV2Session.ResponseMetaHeader): void {
    this.checkResponseStatus(meta);
  }
}

describe('NeoFSError', () => {
  it('exposes code and status message', () => {
    const err = new NeoFSError(42, 'broken');
    expect(err.name).toBe('NeoFSError');
    expect(err.code).toBe(42);
    expect(err.statusMessage).toBe('broken');
    expect(String(err.message)).toContain('42');
  });
});

describe('BaseServiceClient', () => {
  const cfg = createTestClientConfig();

  it('builds meta header with version and ttl', () => {
    const h = new BaseClientHarness(cfg);
    const meta = h.meta();
    expect(meta.Version?.Major).toBe(2);
    expect(meta.Version?.Minor).toBe(22);
    expect(meta.Ttl).toBe(2);
  });

  it('attaches bearer token from Uint8Array', () => {
    const h = new BaseClientHarness(cfg);
    const serialized = new BearerToken()
      .setIssuer(new Uint8Array(25).fill(3))
      .serialize();
    const meta = h.meta({ bearerToken: serialized });
    expect(meta.BearerToken).toBeDefined();
  });

  it('attaches bearer token object without deserializing', () => {
    const h = new BaseClientHarness(cfg);
    const token = new NeoFsV2Acl.BearerTokenImpl({
      Body: new NeoFsV2Acl.BearerToken_BodyImpl({}),
    });
    const meta = h.meta({ bearerToken: token });
    expect(meta.BearerToken).toBe(token);
  });

  it('attaches session token when provided', () => {
    const h = new BaseClientHarness(cfg);
    const st = new NeoFsV2Session.SessionTokenImpl({
      Body: new NeoFsV2Session.SessionToken_BodyImpl({ Id: new Uint8Array([1, 2]) }),
    });
    const meta = h.meta({ sessionToken: st });
    expect(meta.SessionToken).toBe(st);
  });

  it('builds verification header with three signatures', () => {
    const h = new BaseClientHarness(cfg);
    const body = new TextEncoder().encode('payload');
    const meta = h.meta();
    const vh = h.verify(body, meta);
    expect(vh.BodySignature?.Sign?.length).toBeGreaterThan(0);
    expect(vh.MetaSignature?.Sign?.length).toBeGreaterThan(0);
    expect(vh.OriginSignature?.Sign?.length).toBeGreaterThan(0);
  });

  it('derives owner id from signer', () => {
    const h = new BaseClientHarness(cfg);
    const oid = h.owner();
    expect(oid.Value.length).toBe(25);
  });

  it('maps object header to ObjectInfo', () => {
    const h = new BaseClientHarness(cfg);
    const cid = new Uint8Array(32).fill(9);
    const oid = new Uint8Array(32).fill(8);
    const header = new NeoFsV2Object.HeaderImpl({
      ContainerId: new NeoFsV2Refs.ContainerIDImpl({ Value: cid }),
      OwnerId: new NeoFsV2Refs.OwnerIDImpl({ Value: new Uint8Array(25).fill(1) }),
      CreationEpoch: 7n,
      PayloadLength: 100n,
      ObjectType: 0,
      Attributes: [
        new NeoFsV2Object.Header_AttributeImpl({ Key: 'k', Value: 'v' }),
      ],
    });
    const info = h.toObjectInfo(header, oid);
    expect(info.objectId).toBe(oid);
    expect(info.containerId).toEqual(cid);
    expect(info.creationEpoch).toBe(7n);
    expect(info.payloadSize).toBe(100n);
    expect(info.attributes).toEqual([{ key: 'k', value: 'v' }]);
  });

  it('maps container proto to ContainerInfo including name and timestamp', () => {
    const h = new BaseClientHarness(cfg);
    const tsSec = Math.floor(Date.now() / 1000);
    const cid = new Uint8Array(32).fill(2);
    const container = new NeoFsV2Container.ContainerImpl({
      OwnerId: new NeoFsV2Refs.OwnerIDImpl({ Value: new Uint8Array(25).fill(4) }),
      Nonce: new Uint8Array(16),
      BasicAcl: 0xabcd,
      Attributes: [
        new NeoFsV2Container.Container_AttributeImpl({
          Key: 'Name',
          Value: 'my-bucket',
        }),
        new NeoFsV2Container.Container_AttributeImpl({
          Key: 'Timestamp',
          Value: String(tsSec),
        }),
      ],
      PlacementPolicy: new NeoFsV2Netmap.PlacementPolicyImpl({
        Replicas: [new NeoFsV2Netmap.ReplicaImpl({ Count: 2 })],
      }),
    });
    const info = h.toContainerInfo(container, cid);
    expect(info.name).toBe('my-bucket');
    expect(info.basicAcl).toBe(0xabcd);
    expect(info.createdAt?.getTime()).toBe(tsSec * 1000);
    expect(info.placementPolicy).toBe('REP 2');
  });

  it('returns undefined placement string whenReplicas missing', () => {
    const h = new BaseClientHarness(cfg);
    expect(h.policyString(undefined)).toBeUndefined();
    expect(h.policyString(new NeoFsV2Netmap.PlacementPolicyImpl({}))).toBeUndefined();
  });

  it('throws NeoFSError on non-zero response status', () => {
    const h = new BaseClientHarness(cfg);
    const meta = new NeoFsV2Session.ResponseMetaHeaderImpl({
      Epoch: 1n,
      Ttl: 1,
      Status: new NeoFsV2Status.StatusImpl({ Code: 2049, Message: 'missing' }),
    });
    expect(() => h.checkMeta(meta)).toThrow(NeoFSError);
  });

  it('accepts missing or zero status', () => {
    const h = new BaseClientHarness(cfg);
    expect(() => h.checkMeta(undefined)).not.toThrow();
    const meta = new NeoFsV2Session.ResponseMetaHeaderImpl({
      Epoch: 1n,
      Ttl: 1,
      Status: new NeoFsV2Status.StatusImpl({ Code: 0 }),
    });
    expect(() => h.checkMeta(meta)).not.toThrow();
  });
});
