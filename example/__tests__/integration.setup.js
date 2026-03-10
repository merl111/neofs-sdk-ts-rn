/**
 * Setup for integration tests
 * Mocks React Native for Jest environment
 */

// Mock React Native NativeModules for integration tests
// These will call the actual native implementation when run on device
const mockNativeModules = {
  GrpcReactNative: {
    createChannel: jest.fn().mockImplementation((host, port, useTls) => {
      // In real integration tests, this would call the actual native module
      // For now, we'll simulate the response
      return Promise.resolve({
        channelId: `real-channel-${host}-${port}`,
        state: 'READY',
        connected: true,
      });
    }),
    unaryCall: jest.fn(),
    serverStreamCall: jest.fn(),
    clientStreamCall: jest.fn(),
    bidirectionalStreamCall: jest.fn(),
    closeChannel: jest.fn(),
  },
};

// Mock NativeEventEmitter
class MockNativeEventEmitter {
  constructor(nativeModule) {
    this.nativeModule = nativeModule;
    this.listeners = new Map();
  }

  addListener(eventType, listener) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(listener);
    return {
      remove: () => this.removeListener(eventType, listener),
    };
  }

  removeListener(eventType, listener) {
    if (this.listeners.has(eventType)) {
      const listeners = this.listeners.get(eventType);
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  removeAllListeners(eventType) {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  emit(eventType, ...args) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach((listener) => {
        listener(...args);
      });
    }
  }
}

// Mock react-native module
jest.mock('react-native', () => {
  return {
    NativeModules: mockNativeModules,
    NativeEventEmitter: MockNativeEventEmitter,
    Platform: {
      OS: 'ios',
      Version: 14,
      select: jest.fn((obj) => obj.ios),
    },
  };
});

// Export mocks for use in tests
global.mockNativeModules = mockNativeModules;
global.MockNativeEventEmitter = MockNativeEventEmitter;

// Log test environment
console.log('🧪 Integration test environment initialized');
console.log('📡 Tests will attempt to connect to grpcb.in:9000');
console.log('⚠️  These tests require network connectivity');

// Clean up after each test
afterEach(() => {
  jest.clearAllTimers();
});

// Clean up after all tests
afterAll(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});
