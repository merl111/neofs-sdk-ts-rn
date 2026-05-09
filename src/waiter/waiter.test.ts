import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { NeoFSError } from '../client/react-native/base-client';
import type { ReactNativeNeoFSClient } from '../client/react-native/client';

import { ConfirmationTimeoutError, Waiter } from './waiter';

function mockClient(parts: {
  container: {
    create: ReturnType<typeof vi.fn>;
    getInfo: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  object: {
    upload: ReturnType<typeof vi.fn>;
    getInfo: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
}): ReactNativeNeoFSClient {
  return {
    container: () => parts.container,
    object: () => parts.object,
  } as unknown as ReactNativeNeoFSClient;
}

describe('Waiter', () => {
  const cid = new Uint8Array([1, 2, 3]);
  const oid = new Uint8Array([9, 8]);

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits until container exists after propagation errors', async () => {
    const container = {
      create: vi.fn().mockResolvedValue(cid),
      getInfo: vi
        .fn()
        .mockRejectedValueOnce(new NeoFSError(3072, 'not found'))
        .mockResolvedValueOnce({ containerId: cid }),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const object = stubsObject();

    const waiter = new Waiter(mockClient({ container, object }), {
      pollInterval: 10,
      timeout: 10_000,
    });

    const p = waiter.containerPut();
    await vi.advanceTimersByTimeAsync(50);
    await p;

    expect(container.create).toHaveBeenCalled();
    expect(container.getInfo.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('times out waiting for container', async () => {
    const container = {
      create: vi.fn().mockResolvedValue(cid),
      getInfo: vi.fn().mockRejectedValue(new NeoFSError(3072, 'missing')),
      remove: vi.fn(),
    };

    const waiter = new Waiter(mockClient({ container, object: stubsObject() }), {
      pollInterval: 100,
      timeout: 500,
    });

    const promise = waiter.containerPut();
    const expectation = expect(promise).rejects.toThrow(ConfirmationTimeoutError);
    await vi.runAllTimersAsync();
    await expectation;
  });

  it('surfaces unexpected NeoFS errors during container polling', async () => {
    const container = {
      create: vi.fn().mockResolvedValue(cid),
      getInfo: vi.fn().mockRejectedValue(new NeoFSError(9999, 'bad')),
      remove: vi.fn(),
    };

    const waiter = new Waiter(mockClient({ container, object: stubsObject() }));

    await expect(waiter.containerPut()).rejects.toThrow(NeoFSError);
  });

  it('confirms container delete when RPC reports not-found', async () => {
    const container = {
      create: vi.fn(),
      getInfo: vi.fn().mockRejectedValue(new NeoFSError(3072, 'gone')),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const waiter = new Waiter(mockClient({ container, object: stubsObject() }), {
      pollInterval: 50,
      timeout: 5000,
    });

    const p = waiter.containerDelete(cid);
    await vi.advanceTimersByTimeAsync(120);
    await p;
    expect(container.remove).toHaveBeenCalledWith(cid);
  });

  it('polls until object HEAD succeeds', async () => {
    const object = {
      upload: vi.fn().mockResolvedValue(oid),
      getInfo: vi
        .fn()
        .mockRejectedValueOnce(new NeoFSError(2049, 'missing'))
        .mockResolvedValueOnce({ objectId: oid }),
      remove: vi.fn(),
    };

    const waiter = new Waiter(mockClient({ container: stubsContainer(), object }), {
      pollInterval: 200,
      timeout: 8000,
    });

    const p = waiter.objectPut({
      containerId: cid,
      payload: new Uint8Array([0xaa]),
      filename: 'f.bin',
    });
    await vi.advanceTimersByTimeAsync(250);
    await p;
    expect(object.upload).toHaveBeenCalled();
  });

  it('objectDelete resolves when object is gone', async () => {
    const object = {
      upload: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
      getInfo: vi
        .fn()
        .mockResolvedValueOnce({ objectId: oid })
        .mockRejectedValueOnce(new NeoFSError(2049, 'gone')),
    };

    const waiter = new Waiter(mockClient({ container: stubsContainer(), object }), {
      pollInterval: 20,
      timeout: 4000,
    });

    const p = waiter.objectDelete(cid, oid);
    await vi.advanceTimersByTimeAsync(50);
    await p;
    expect(object.remove).toHaveBeenCalledWith(cid, oid);
  });

  it('setPollInterval and setTimeout change defaults used by waiter', async () => {
    const container = {
      create: vi.fn().mockResolvedValue(cid),
      getInfo: vi
        .fn()
        .mockRejectedValueOnce(new NeoFSError(3072, 'wait'))
        .mockResolvedValueOnce({ containerId: cid }),
      remove: vi.fn(),
    };

    const waiter = new Waiter(mockClient({ container, object: stubsObject() }));
    waiter.setPollInterval(250);
    waiter.setTimeout(5000);

    const p = waiter.containerPut({});
    await vi.advanceTimersByTimeAsync(260);
    await p;
    expect(container.getInfo.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

function stubsContainer() {
  return {
    create: vi.fn(),
    getInfo: vi.fn(),
    remove: vi.fn(),
  };
}

function stubsObject() {
  return {
    upload: vi.fn(),
    getInfo: vi.fn(),
    remove: vi.fn(),
  };
}
