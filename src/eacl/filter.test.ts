import { describe, it, expect } from 'vitest';

import {
  Action,
  HeaderType,
  Match,
  ObjectFilters,
  Operation,
  Role,
} from './enums';
import {
  allowUsersEACL,
  privateEACL,
  publicEACL,
  publicReadEACL,
  Table,
} from './table';

import { Filter } from './filter';
import { Record } from './record';
import { Target } from './target';

describe('Filter', () => {
  it('stores constructor fields', () => {
    const f = new Filter(HeaderType.OBJECT, 'k', Match.STRING_EQUAL, 'v');
    expect(f.headerType).toBe(HeaderType.OBJECT);
    expect(f.key).toBe('k');
    expect(f.match).toBe(Match.STRING_EQUAL);
    expect(f.value).toBe('v');
  });

  it('supports static factories', () => {
    const f1 = Filter.objectAttribute('a', Match.NOT_PRESENT, '');
    expect(f1.headerType).toBe(HeaderType.OBJECT);

    const f2 = Filter.requestHeader('x', Match.STRING_EQUAL, 'y');
    expect(f2.headerType).toBe(HeaderType.REQUEST);

    const f3 = Filter.serviceHeader('s', Match.STRING_EQUAL, 'z');
    expect(f3.headerType).toBe(HeaderType.SERVICE);

    expect(Filter.objectId('oid').value).toBe('oid');
    expect(Filter.containerId('cid').value).toBe('cid');
    expect(Filter.ownerId('own').value).toBe('own');
    expect(Filter.creationEpoch(Match.NUM_GE, 3n).value).toBe('3');
    expect(Filter.payloadSize(Match.NUM_LT, 10n).value).toBe('10');

    expect(ObjectFilters.OBJECT_ID).toContain('objectID');
  });

  it('clone is independent copy', () => {
    const a = Filter.objectAttribute('k', Match.STRING_EQUAL, 'v');
    const b = a.clone();
    expect(b).not.toBe(a);
    expect(b.key).toBe(a.key);
  });
});

describe('Target', () => {
  it('covers role factories', () => {
    expect(Target.user().role).toBe(Role.USER);
    expect(Target.others().role).toBe(Role.OTHERS);
    expect(Target.system().role).toBe(Role.SYSTEM);

    const uid = new Uint8Array(25).fill(1);
    expect(Target.users([uid]).subjects).toHaveLength(1);
    expect(Target.userId(uid).subjects[0]).toEqual(uid);

    const pk33 = new Uint8Array(33).fill(2);
    expect(Target.publicKey(pk33).subjects[0]).toEqual(pk33);
    expect(Target.publicKeys([pk33]).subjects).toHaveLength(1);
  });

  it('clone deep-copies subjects', () => {
    const t = Target.users([new Uint8Array([1])]);
    const c = t.clone();
    c.subjects[0]![0] = 9;
    expect(t.subjects[0]![0]).toBe(1);
  });
});

describe('Record', () => {
  it('static helpers set action and operation', () => {
    const t = Target.others();
    const r = Record.allowGet([t]);
    expect(r.action).toBe(Action.ALLOW);
    expect(r.operation).toBe(Operation.GET);

    const r2 = Record.denyPut([t]);
    expect(r2.action).toBe(Action.DENY);
    expect(r2.operation).toBe(Operation.PUT);

    expect(Record.allowSearch([t]).operation).toBe(Operation.SEARCH);
    expect(Record.denyDelete([t]).operation).toBe(Operation.DELETE);
    expect(Record.allowRange([t]).operation).toBe(Operation.RANGE);
    expect(Record.denyRange([t]).operation).toBe(Operation.RANGE);
  });

  it('clone deep-copies targets and filters', () => {
    const r = Record.allow(
      Operation.PUT,
      [Target.users([new Uint8Array([1])])],
      [Filter.objectAttribute('FileName', Match.STRING_EQUAL, 'x.bin')],
    );
    const c = r.clone();
    expect(c).not.toBe(r);
    expect(c.targets[0]).not.toBe(r.targets[0]);
  });
});

describe('Table', () => {
  it('fluent allow/deny and bulk helpers add records', () => {
    const t = Target.others();
    const table = new Table(new Uint8Array(16))
      .setVersion(2, 19)
      .allow(Operation.GET, [t])
      .deny(Operation.PUT, [t]);

    expect(table.version).toEqual({ major: 2, minor: 19 });
    expect(table.records.map(r => r.operation)).toContain(Operation.GET);

    table.allowAll([t]);
    table.denyRead([t]);
    table.allowWrite([t]);
    table.denyWrite([t]);

    expect(table.records.length).toBeGreaterThan(3);
  });

  it('serializes round-trip preserving container id', () => {
    const cid = new Uint8Array(32).fill(5);
    const original = publicReadEACL(cid);
    original.addRecords([Record.allowHead([Target.others()])]);

    const round = Table.deserialize(original.serialize());
    expect(round.containerId).toEqual(cid);
    expect(round.records.length).toBe(original.records.length);
  });

  it('preset factories produce expected DENY shapes', () => {
    const pub = publicEACL(undefined);
    const priv = privateEACL(undefined);
    expect(pub.records.some(r => r.action === Action.ALLOW)).toBe(true);
    expect(priv.records.some(r => r.action === Action.DENY)).toBe(true);

    const u1 = new Uint8Array(25).fill(1);
    const u2 = new Uint8Array(25).fill(2);
    const users = allowUsersEACL([u1, u2]);
    expect(users.records.some(r => r.targets.some(x => x.subjects.length))).toBe(true);
  });

  it('clone is independent copy', () => {
    const t = publicReadEACL();
    const c = t.clone();
    expect(c).not.toBe(t);
    c.addRecord(Record.allowHead([Target.user()]));
    expect(t.records.length).toBeLessThan(c.records.length);
  });
});
