const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

const sdkPath = path.resolve(__dirname, '..');
const corePath = path.resolve(__dirname, '../../neofs-sdk-ts-core');
const grpcPath = path.resolve(__dirname, '../../../grpc-react-native/grpc-react-native');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  watchFolders: [
    sdkPath,
    corePath,
    grpcPath,
  ],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(sdkPath, 'node_modules'),
      path.resolve(corePath, 'node_modules'),
      path.resolve(grpcPath, 'node_modules'),
    ],
    // Explicitly map local packages
    extraNodeModules: {
      'neofs-sdk-ts-react-native': sdkPath,
      'neofs-sdk-ts': sdkPath, // Legacy alias
      'neofs-sdk-ts-core': corePath,
      'grpc-react-native': grpcPath,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
