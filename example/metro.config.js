const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

const sdkPath = path.resolve(__dirname, '..');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  watchFolders: [
    sdkPath
  ],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(sdkPath, 'node_modules')
    ],
    // Explicitly map local packages
    extraNodeModules: {
      'neofs-sdk-ts-rn': sdkPath,
      'neofs-sdk-ts': sdkPath, // Legacy alias
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
