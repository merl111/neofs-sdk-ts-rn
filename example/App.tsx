/**
 * NeoFS SDK Example App for React Native
 *
 * @format
 */

import React, { useState } from 'react';
import { StatusBar, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import NeoFSExample from './src/NeoFSExample';
import GrpcIntegrationTests from './src/GrpcIntegrationTests';

type Tab = 'neofs' | 'grpc';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('neofs');

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'neofs' && styles.activeTab]}
          onPress={() => setActiveTab('neofs')}
        >
          <Text style={[styles.tabText, activeTab === 'neofs' && styles.activeTabText]}>
            NeoFS SDK
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'grpc' && styles.activeTab]}
          onPress={() => setActiveTab('grpc')}
        >
          <Text style={[styles.tabText, activeTab === 'grpc' && styles.activeTabText]}>
            gRPC Tests
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'neofs' ? <NeoFSExample /> : <GrpcIntegrationTests />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007bff',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#007bff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});

export default App;
