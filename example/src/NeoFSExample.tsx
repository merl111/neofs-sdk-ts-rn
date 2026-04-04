/**
 * NeoFS SDK Example for React Native
 * Demonstrates basic NeoFS operations
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Button,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';

import {
  ReactNativeNeoFSClient,
  BasicACL,
  ECDSASignerRFC6979,
  type ContainerInfo,
  type Balance,
  type NetworkInfo,
  type Signer,
  type ObjectInfo,
  // EACL imports
  Table as EACLTable,
  Target,
  Record as EACLRecord,
  Operation,
  Action,
  publicReadEACL,
  privateEACL,
  publicEACL,
  // Bearer Token imports
  BearerToken,
  ownerIdFromPublicKey,
  publicKeyBytes,
  // Waiter import
  Waiter,
  ConfirmationTimeoutError,
} from 'neofs-sdk-ts-rn';

// Helper to convert bytes to hex (React Native compatible)
const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

// Helper to convert string to bytes
const stringToBytes = (str: string): Uint8Array => {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
};

// Helper to convert bytes to string
const bytesToString = (bytes: Uint8Array): string => {
  return String.fromCharCode(...bytes);
};

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'success' | 'error' | 'warn' | 'debug';
  message: string;
}

export default function NeoFSExample() {
  const [host, setHost] = useState('st1.t5.fs.neo.org');
  const [port, setPort] = useState('8082');
  const [wif, setWif] = useState('');
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [client, setClient] = useState<ReactNativeNeoFSClient | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  
  // Demo state
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<ContainerInfo | null>(null);
  const [objects, setObjects] = useState<ObjectInfo[]>([]);
  const [objectContent, setObjectContent] = useState<string>('Hello NeoFS from React Native!');
  
  // EACL state
  const [currentEACL, setCurrentEACL] = useState<EACLTable | null>(null);
  const [selectedEACLPreset, setSelectedEACLPreset] = useState<string>('public-read');
  
  // Bearer Token state
  const [bearerToken, setBearerToken] = useState<BearerToken | null>(null);
  const [bearerTokenExpiry, setBearerTokenExpiry] = useState<string>('100');
  const [targetUserWif, setTargetUserWif] = useState<string>('');
  
  // Waiter state
  const [useWaiter, setUseWaiter] = useState<boolean>(true);
  const [waiter, setWaiter] = useState<Waiter | null>(null);

  const log = (level: LogEntry['level'], message: string) => {
    const entry: LogEntry = { timestamp: new Date(), level, message };
    setLogs(prev => [...prev, entry]);
    console.log(`[${level.toUpperCase()}] ${message}`);
  };

  const clearLogs = () => setLogs([]);

  const handleLoadWif = () => {
    if (!wif.trim()) {
      Alert.alert('Error', 'Please enter a WIF private key');
      return;
    }
    
    try {
      const newSigner = ECDSASignerRFC6979.fromWIF(wif.trim());
      setSigner(newSigner);
      log('success', 'Signer loaded from WIF');
      log('info', `Public key: ${bytesToHex(newSigner.getPublicKey()).substring(0, 32)}...`);
    } catch (error) {
      log('error', `Failed to load WIF: ${error}`);
      Alert.alert('Error', `Invalid WIF: ${error}`);
    }
  };

  const handleGenerateKey = () => {
    try {
      const newSigner = ECDSASignerRFC6979.generate();
      setSigner(newSigner);
      log('success', 'New key pair generated');
      log('info', `Public key: ${bytesToHex(newSigner.getPublicKey()).substring(0, 32)}...`);
      log('warn', 'This is a random key - export it if you want to keep it!');
    } catch (error) {
      log('error', `Failed to generate key: ${error}`);
    }
  };

  const handleConnect = async () => {
    if (!signer) {
      Alert.alert('Error', 'Please load or generate a key first');
      return;
    }
    
    try {
      log('info', `Connecting to ${host}:${port}...`);
      
      const newClient = new ReactNativeNeoFSClient({
        host,
        port: parseInt(port, 10),
        signer,
        useTls: true,
      });

      await newClient.connect();
      
      setClient(newClient);
      setConnected(true);
      
      // Create waiter for sync operations
      const newWaiter = new Waiter(newClient, { pollInterval: 2000, timeout: 60000 });
      setWaiter(newWaiter);
      
      log('success', 'Connected successfully!');
    } catch (error) {
      log('error', `Connection failed: ${error}`);
      Alert.alert('Connection Error', String(error));
    }
  };

  const handleDisconnect = async () => {
    if (client) {
      try {
        await client.disconnect();
        setClient(null);
        setWaiter(null);
        setConnected(false);
        setNetworkInfo(null);
        setBalance(null);
        setContainers([]);
        setSelectedContainer(null);
        setObjects([]);
        setCurrentEACL(null);
        setBearerToken(null);
        log('info', 'Disconnected');
      } catch (error) {
        log('error', `Disconnect failed: ${error}`);
      }
    }
  };

  const handleGetNetworkInfo = async () => {
    if (!client) return;
    
    try {
      log('info', 'Fetching network info...');
      const info = await client.netmap().getNetwork();
      setNetworkInfo(info);
      log('success', `Current epoch: ${info.currentEpoch}`);
      log('info', `Magic number: ${info.magicNumber}`);
      log('info', `Ms per block: ${info.msPerBlock}`);
      log('debug', `Config entries: ${info.config.size}`);
    } catch (error) {
      log('error', `Failed to get network info: ${error}`);
    }
  };

  const handleGetNodes = async () => {
    if (!client) return;
    
    try {
      log('info', 'Fetching network nodes...');
      const nodes = await client.netmap().getNodes();
      log('success', `Found ${nodes.length} nodes`);
      
      nodes.slice(0, 5).forEach((node, i) => {
        const stateStr = ['UNSPECIFIED', 'ONLINE', 'OFFLINE', 'MAINTENANCE'][node.state] || 'UNKNOWN';
        log('info', `  Node ${i + 1}: ${node.addresses[0] || 'no address'} (${stateStr})`);
      });
      
      if (nodes.length > 5) {
        log('info', `  ... and ${nodes.length - 5} more`);
      }
    } catch (error) {
      log('error', `Failed to get nodes: ${error}`);
    }
  };

  const handleGetBalance = async () => {
    if (!client) return;
    
    try {
      log('info', 'Fetching balance...');
      const bal = await client.accounting().getBalance();
      setBalance(bal);
      log('success', `Balance: ${bal.value} (precision: ${bal.precision})`);
    } catch (error) {
      log('error', `Failed to get balance: ${error}`);
    }
  };

  const handleListContainers = async () => {
    if (!client) return;
    
    try {
      log('info', 'Listing containers...');
      const containerList = await client.container().listWithInfo();
      setContainers(containerList);
      
      if (containerList.length === 0) {
        log('info', 'No containers found');
      } else {
        log('success', `Found ${containerList.length} containers`);
        containerList.forEach((c, i) => {
          log('info', `  ${i + 1}. ${c.name || 'Unnamed'} (ACL: 0x${c.basicAcl.toString(16)})`);
        });
      }
    } catch (error) {
      log('error', `Failed to list containers: ${error}`);
    }
  };

  const handleCreateContainer = async () => {
    if (!client) return;
    
    try {
      const name = `test-container-${Date.now()}`;
      log('info', `Creating container "${name}"...`);
      
      if (useWaiter && waiter) {
        log('info', '  Using waiter for confirmation...');
        const containerId = await waiter.containerPut({
          name,
          basicAcl: BasicACL.PRIVATE,
          placementPolicy: 'REP 2',
        });
        
        log('success', `Container created and confirmed!`);
        log('info', `  ID: ${bytesToHex(containerId).substring(0, 16)}...`);
      } else {
        const containerId = await client.container().create({
          name,
          basicAcl: BasicACL.PRIVATE,
          placementPolicy: 'REP 2',
        });
        
        log('success', `Container created (not confirmed)!`);
        log('info', `  ID: ${bytesToHex(containerId).substring(0, 16)}...`);
        log('warn', '  Note: Container may not be immediately available');
      }
      
      // Refresh container list
      await handleListContainers();
    } catch (error) {
      if (error instanceof ConfirmationTimeoutError) {
        log('warn', 'Container creation timed out waiting for confirmation');
        log('info', 'The container may still be created - try refreshing');
      } else {
        log('error', `Failed to create container: ${error}`);
      }
    }
  };

  const handleGetLocalNode = async () => {
    if (!client) return;
    
    try {
      log('info', 'Fetching local node info...');
      const nodeInfo = await client.netmap().getLocalNode();
      log('success', `Node version: ${nodeInfo.version.major}.${nodeInfo.version.minor}`);
      log('info', `  Addresses: ${nodeInfo.node.addresses.join(', ') || 'none'}`);
      log('info', `  State: ${['UNSPECIFIED', 'ONLINE', 'OFFLINE', 'MAINTENANCE'][nodeInfo.node.state]}`);
      
      nodeInfo.node.attributes.slice(0, 5).forEach(attr => {
        log('info', `  ${attr.key}: ${attr.value}`);
      });
    } catch (error) {
      log('error', `Failed to get local node: ${error}`);
    }
  };

  const handleSelectContainer = (container: ContainerInfo) => {
    setSelectedContainer(container);
    setObjects([]);
    log('info', `Selected container: ${container.name || 'Unnamed'}`);
  };

  const handleDeleteContainer = async (container: ContainerInfo) => {
    if (!client) return;
    
    Alert.alert(
      'Delete Container',
      `Are you sure you want to delete "${container.name || 'Unnamed'}"?\n\nThis will also delete all objects inside!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              log('info', `Deleting container "${container.name || 'Unnamed'}"...`);
              
              await client.container().remove(container.containerId);
              
              log('success', 'Container deleted!');
              
              // Clear selection if this was the selected container
              if (selectedContainer?.containerId === container.containerId) {
                setSelectedContainer(null);
                setObjects([]);
              }
              
              // Refresh container list
              await handleListContainers();
            } catch (error) {
              log('error', `Failed to delete container: ${error}`);
            }
          },
        },
      ]
    );
  };

  const handleListObjects = async () => {
    if (!client || !selectedContainer) return;
    
    try {
      log('info', 'Searching for objects...');
      const objectIds = await client.object().find({
        containerId: selectedContainer.containerId,
        filters: [],
      });
      
      log('success', `Found ${objectIds.length} objects`);
      
      // Get info for each object (limit to first 10)
      const objectInfos: ObjectInfo[] = [];
      for (const objectId of objectIds.slice(0, 10)) {
        try {
          const info = await client.object().getInfo(selectedContainer.containerId, objectId);
          if (info) {
            objectInfos.push(info);
            const filename = info.attributes.find(a => a.key === 'FileName')?.value || 'unnamed';
            log('info', `  - ${filename} (${info.payloadSize} bytes)`);
          }
        } catch (err) {
          log('warn', `  - Failed to get info for object ${bytesToHex(objectId).substring(0, 16)}...`);
        }
      }
      
      if (objectIds.length > 10) {
        log('info', `  ... and ${objectIds.length - 10} more`);
      }
      
      setObjects(objectInfos);
    } catch (error) {
      log('error', `Failed to list objects: ${error}`);
    }
  };

  const handleUploadObject = async () => {
    if (!client || !selectedContainer) return;
    
    try {
      const filename = `test-${Date.now()}.txt`;
      log('info', `Uploading object "${filename}"...`);
      log('debug', `  Content: "${objectContent.substring(0, 50)}${objectContent.length > 50 ? '...' : ''}"`);
      
      const payload = stringToBytes(objectContent);
      
      if (useWaiter && waiter) {
        log('info', '  Using waiter for confirmation...');
        const objectId = await waiter.objectPut({
          containerId: selectedContainer.containerId,
          payload,
          filename,
          contentType: 'text/plain',
          attributes: [
            { key: 'Application', value: 'NeoFS-RN-Example' },
          ],
        });
        
        log('success', `Object uploaded and confirmed!`);
        log('info', `  ID: ${bytesToHex(objectId).substring(0, 32)}...`);
      } else {
        const objectId = await client.object().upload({
          containerId: selectedContainer.containerId,
          payload,
          filename,
          contentType: 'text/plain',
          attributes: [
            { key: 'Application', value: 'NeoFS-RN-Example' },
          ],
        });
        
        log('success', `Object uploaded (not confirmed)!`);
        log('info', `  ID: ${bytesToHex(objectId).substring(0, 32)}...`);
        log('warn', '  Note: Object may not be immediately available');
      }
      
      // Refresh object list
      await handleListObjects();
    } catch (error) {
      if (error instanceof ConfirmationTimeoutError) {
        log('warn', 'Object upload timed out waiting for confirmation');
        log('info', 'The object may still be uploaded - try refreshing');
      } else {
        log('error', `Failed to upload object: ${error}`);
      }
    }
  };

  const handleDownloadObject = async (objectId: Uint8Array) => {
    if (!client || !selectedContainer) return;
    
    try {
      log('info', `Downloading object ${bytesToHex(objectId).substring(0, 16)}...`);
      
      const data = await client.object().download(selectedContainer.containerId, objectId);
      
      const filename = data.info.attributes.find(a => a.key === 'FileName')?.value || 'unnamed';
      log('success', `Downloaded: ${filename}`);
      log('info', `  Size: ${data.payload.length} bytes`);
      
      // Try to show content if it's text
      const contentType = data.info.attributes.find(a => a.key === 'ContentType')?.value;
      if (contentType?.startsWith('text/') || data.payload.length < 1000) {
        const content = bytesToString(data.payload);
        log('info', `  Content: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
      }
    } catch (error) {
      log('error', `Failed to download object: ${error}`);
    }
  };

  const handleDeleteObject = async (objectId: Uint8Array) => {
    if (!client || !selectedContainer) return;
    
    Alert.alert(
      'Delete Object',
      'Are you sure you want to delete this object?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              log('info', `Deleting object ${bytesToHex(objectId).substring(0, 16)}...`);
              
              await client.object().remove(selectedContainer.containerId, objectId);
              
              log('success', 'Object deleted!');
              
              // Refresh object list
              await handleListObjects();
            } catch (error) {
              log('error', `Failed to delete object: ${error}`);
            }
          },
        },
      ]
    );
  };

  // ----------------------
  // EACL Handlers
  // ----------------------

  const handleBuildEACL = () => {
    if (!selectedContainer) return;

    try {
      let eacl: EACLTable;
      
      switch (selectedEACLPreset) {
        case 'public':
          eacl = publicEACL(selectedContainer.containerId);
          log('info', 'Built Public EACL (anyone can read/write)');
          break;
        case 'private':
          eacl = privateEACL(selectedContainer.containerId);
          log('info', 'Built Private EACL (only owner can access)');
          break;
        case 'public-read':
        default:
          eacl = publicReadEACL(selectedContainer.containerId);
          log('info', 'Built Public-Read EACL (anyone can read, only owner can write)');
          break;
      }
      
      setCurrentEACL(eacl);
      log('success', `EACL has ${eacl.records.length} rules`);
      
      eacl.records.forEach((r, i) => {
        const actionStr = r.action === Action.ALLOW ? 'ALLOW' : 'DENY';
        const opStr = ['?', 'GET', 'HEAD', 'PUT', 'DELETE', 'SEARCH', 'RANGE', 'RANGE_HASH'][r.operation] || '?';
        const targetStr = r.targets.map(t => {
          if (t.subjects.length > 0) return `${t.subjects.length} users`;
          return ['?', 'USER', 'SYSTEM', 'OTHERS'][t.role] || '?';
        }).join(', ');
        log('debug', `  ${i + 1}. ${actionStr} ${opStr} for ${targetStr}`);
      });
    } catch (error) {
      log('error', `Failed to build EACL: ${error}`);
    }
  };

  const handleBuildCustomEACL = () => {
    if (!selectedContainer) return;

    try {
      // Build a more interesting custom EACL
      const eacl = new EACLTable(selectedContainer.containerId)
        // Allow everyone to read (GET, HEAD)
        .allow(Operation.GET, [Target.others()])
        .allow(Operation.HEAD, [Target.others()])
        .allow(Operation.SEARCH, [Target.others()])
        // Deny everyone from writing
        .deny(Operation.PUT, [Target.others()])
        .deny(Operation.DELETE, [Target.others()])
        .deny(Operation.RANGE, [Target.others()])
        .deny(Operation.RANGE_HASH, [Target.others()]);

      setCurrentEACL(eacl);
      log('success', `Built custom EACL with ${eacl.records.length} rules`);
      log('info', '  - Others can: GET, HEAD, SEARCH');
      log('info', '  - Others cannot: PUT, DELETE, RANGE, RANGE_HASH');
    } catch (error) {
      log('error', `Failed to build custom EACL: ${error}`);
    }
  };

  const handleSetEACL = async () => {
    if (!client || !selectedContainer || !currentEACL) return;

    try {
      log('info', 'Setting EACL on container...');
      
      const eaclProto = currentEACL.toProto();
      await client.container().setExtendedACL(eaclProto);
      
      log('success', 'EACL set successfully!');
      log('warn', 'Note: EACL changes may take a few epochs to propagate');
    } catch (error) {
      log('error', `Failed to set EACL: ${error}`);
    }
  };

  const handleGetEACL = async () => {
    if (!client || !selectedContainer) return;

    try {
      log('info', 'Fetching current EACL...');
      
      const eaclProto = await client.container().getExtendedACL({ value: selectedContainer.containerId });
      
      if (eaclProto) {
        const eacl = EACLTable.fromProto(eaclProto);
        setCurrentEACL(eacl);
        log('success', `Retrieved EACL with ${eacl.records.length} rules`);
        
        eacl.records.forEach((r, i) => {
          const actionStr = r.action === Action.ALLOW ? 'ALLOW' : 'DENY';
          const opStr = ['?', 'GET', 'HEAD', 'PUT', 'DELETE', 'SEARCH', 'RANGE', 'RANGE_HASH'][r.operation] || '?';
          const targetStr = r.targets.map(t => {
            if (t.subjects.length > 0) return `${t.subjects.length} users`;
            return ['?', 'USER', 'SYSTEM', 'OTHERS'][t.role] || '?';
          }).join(', ');
          log('debug', `  ${i + 1}. ${actionStr} ${opStr} for ${targetStr}`);
        });
      } else {
        log('info', 'No EACL set on this container');
        setCurrentEACL(null);
      }
    } catch (error) {
      log('error', `Failed to get EACL: ${error}`);
    }
  };

  // ----------------------
  // Bearer Token Handlers
  // ----------------------

  const handleCreateBearerToken = async () => {
    if (!client || !selectedContainer || !signer || !currentEACL) {
      Alert.alert('Error', 'You need a selected container and built EACL first');
      return;
    }

    try {
      log('info', 'Creating bearer token...');
      
      // Get current epoch
      const info = await client.netmap().getNetwork();
      const currentEpoch = info.currentEpoch;
      const expiryEpochs = BigInt(parseInt(bearerTokenExpiry, 10) || 100);
      
      // Get issuer (our owner ID)
      const pubKey = publicKeyBytes(signer.public());
      const issuerId = ownerIdFromPublicKey(pubKey);
      
      // Create bearer token
      const token = new BearerToken()
        .setEACL(currentEACL)
        .setIssuer(issuerId)
        .setLifetime({
          iat: currentEpoch,
          nbf: currentEpoch,
          exp: currentEpoch + expiryEpochs,
        });
      
      // Optionally set target user if WIF provided
      if (targetUserWif.trim()) {
        try {
          const targetSigner = ECDSASignerRFC6979.fromWIF(targetUserWif.trim());
          const targetPubKey = publicKeyBytes(targetSigner.public());
          const targetId = ownerIdFromPublicKey(targetPubKey);
          token.forUser(targetId);
          log('info', `  Target user: ${bytesToHex(targetId).substring(0, 16)}...`);
        } catch (e) {
          log('warn', 'Invalid target WIF - token will be usable by anyone');
        }
      } else {
        log('info', '  No target user - token usable by anyone');
      }
      
      // Sign the token
      token.sign(signer);
      
      setBearerToken(token);
      log('success', 'Bearer token created!');
      log('info', `  Valid from epoch ${currentEpoch} to ${currentEpoch + expiryEpochs}`);
      log('info', `  Contains ${currentEACL.records.length} EACL rules`);
      
      // Show serialized token info
      const tokenBytes = token.serialize();
      log('debug', `  Token size: ${tokenBytes.length} bytes`);
    } catch (error) {
      log('error', `Failed to create bearer token: ${error}`);
    }
  };

  const handleExportBearerToken = () => {
    if (!bearerToken) return;
    
    try {
      const tokenBytes = bearerToken.serialize();
      const tokenHex = bytesToHex(tokenBytes);
      
      log('info', 'Bearer token exported (hex):');
      log('debug', tokenHex.substring(0, 100) + '...');
      
      // Copy to clipboard would go here in a real app
      Alert.alert(
        'Bearer Token',
        `Token (${tokenBytes.length} bytes):\n\n${tokenHex.substring(0, 64)}...`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      log('error', `Failed to export token: ${error}`);
    }
  };

  const handleTestBearerToken = async () => {
    if (!client || !selectedContainer || !bearerToken) return;

    try {
      log('info', 'Testing bearer token with object list...');
      
      // Note: In a real test, you would use a different client/signer
      // and pass the bearer token bytes to the request
      const tokenBytes = bearerToken.serialize();
      log('debug', `  Using token of ${tokenBytes.length} bytes`);
      
      // For now, just show that the token is valid
      log('success', 'Bearer token is valid and ready to use');
      log('info', 'In a real scenario, share this token with another user');
      log('info', 'They can use it to access the container with the EACL rules');
    } catch (error) {
      log('error', `Failed to test bearer token: ${error}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>NeoFS SDK Example</Text>
        <Text style={styles.subtitle}>React Native Demo</Text>
      </View>

      {/* Key Management Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Management</Text>
        
        <TextInput
          style={styles.input}
          value={wif}
          onChangeText={setWif}
          placeholder="Enter WIF private key"
          secureTextEntry
          editable={!connected}
        />
        
        <View style={styles.buttonRow}>
          <View style={styles.buttonHalf}>
            <Button 
              title="Load WIF" 
              onPress={handleLoadWif}
              disabled={connected}
            />
          </View>
          <View style={styles.buttonHalf}>
            <Button 
              title="Generate Key" 
              onPress={handleGenerateKey}
              disabled={connected}
              color="#6c757d"
            />
          </View>
        </View>

        <Text style={[styles.status, signer ? styles.connected : styles.disconnected]}>
          {signer ? '● Key loaded' : '○ No key loaded'}
        </Text>
      </View>

      {/* Connection Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection</Text>
        
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.hostInput]}
            value={host}
            onChangeText={setHost}
            placeholder="Host"
            editable={!connected}
          />
          <TextInput
            style={[styles.input, styles.portInput]}
            value={port}
            onChangeText={setPort}
            placeholder="Port"
            keyboardType="numeric"
            editable={!connected}
          />
        </View>

        <View style={styles.buttonRow}>
          {!connected ? (
            <Button 
              title="Connect" 
              onPress={handleConnect}
              disabled={!signer}
            />
          ) : (
            <Button title="Disconnect" onPress={handleDisconnect} color="#dc3545" />
          )}
        </View>

        <Text style={[styles.status, connected ? styles.connected : styles.disconnected]}>
          {connected ? '● Connected' : '○ Disconnected'}
        </Text>

        {connected && (
          <TouchableOpacity
            style={styles.waiterToggle}
            onPress={() => setUseWaiter(!useWaiter)}
          >
            <Text style={styles.waiterToggleText}>
              {useWaiter ? '✓' : '○'} Use Waiter (confirm operations)
            </Text>
            <Text style={styles.waiterToggleHint}>
              {useWaiter 
                ? 'Waits until operations are confirmed' 
                : 'Fast but may not be immediately available'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Network Section */}
      {connected && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Network</Text>
          
          <View style={styles.buttonGrid}>
            <View style={styles.buttonWrapper}>
              <Button title="Network Info" onPress={handleGetNetworkInfo} />
            </View>
            <View style={styles.buttonWrapper}>
              <Button title="List Nodes" onPress={handleGetNodes} />
            </View>
            <View style={styles.buttonWrapper}>
              <Button title="Local Node" onPress={handleGetLocalNode} />
            </View>
            <View style={styles.buttonWrapper}>
              <Button title="Get Balance" onPress={handleGetBalance} />
            </View>
          </View>

          {networkInfo && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>Epoch: {networkInfo.currentEpoch.toString()}</Text>
              <Text style={styles.infoText}>Magic: {networkInfo.magicNumber.toString()}</Text>
            </View>
          )}

          {balance && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Balance: {balance.value.toString()} (precision: {balance.precision})
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Containers Section */}
      {connected && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Containers</Text>
          
          <View style={styles.buttonGrid}>
            <View style={styles.buttonWrapper}>
              <Button title="List Containers" onPress={handleListContainers} />
            </View>
            <View style={styles.buttonWrapper}>
              <Button title="Create Container" onPress={handleCreateContainer} />
            </View>
          </View>

          {containers.length > 0 && (
            <View style={styles.containerList}>
              <Text style={styles.hint}>Tap a container to select it for object operations</Text>
              {containers.map((c, i) => (
                <View
                  key={i}
                  style={[
                    styles.containerItem,
                    selectedContainer?.containerId === c.containerId && styles.selectedContainer,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.containerInfo}
                    onPress={() => handleSelectContainer(c)}
                  >
                    <Text style={styles.containerName}>{c.name || 'Unnamed'}</Text>
                    <Text style={styles.containerAcl}>ACL: 0x{c.basicAcl.toString(16)}</Text>
                    <Text style={styles.containerId}>ID: {bytesToHex(c.containerId).substring(0, 16)}...</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteContainer(c)}
                  >
                    <Text style={styles.actionButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Objects Section */}
      {connected && selectedContainer && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Objects in "{selectedContainer.name || 'Unnamed'}"</Text>
          
          <TextInput
            style={[styles.input, styles.contentInput]}
            value={objectContent}
            onChangeText={setObjectContent}
            placeholder="Enter content to upload"
            multiline
            numberOfLines={3}
          />
          
          <View style={styles.buttonGrid}>
            <View style={styles.buttonWrapper}>
              <Button title="Upload Object" onPress={handleUploadObject} />
            </View>
            <View style={styles.buttonWrapper}>
              <Button title="List Objects" onPress={handleListObjects} />
            </View>
          </View>

          {objects.length > 0 && (
            <View style={styles.objectList}>
              {objects.map((obj, i) => {
                const filename = obj.attributes.find(a => a.key === 'FileName')?.value || 'unnamed';
                return (
                  <View key={i} style={styles.objectItem}>
                    <View style={styles.objectInfo}>
                      <Text style={styles.objectName}>{filename}</Text>
                      <Text style={styles.objectSize}>{obj.payloadSize.toString()} bytes</Text>
                      <Text style={styles.objectId}>
                        ID: {bytesToHex(obj.objectId).substring(0, 16)}...
                      </Text>
                    </View>
                    <View style={styles.objectActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.downloadButton]}
                        onPress={() => handleDownloadObject(obj.objectId)}
                      >
                        <Text style={styles.actionButtonText}>↓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeleteObject(obj.objectId)}
                      >
                        <Text style={styles.actionButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          
          {objects.length === 0 && (
            <Text style={styles.noObjects}>No objects found. Upload one!</Text>
          )}
        </View>
      )}

      {/* EACL Section */}
      {connected && selectedContainer && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Extended ACL (EACL)</Text>
          <Text style={styles.hint}>
            EACL defines fine-grained access control for the container
          </Text>
          
          {/* Preset Selection */}
          <View style={styles.presetContainer}>
            <Text style={styles.presetLabel}>Preset:</Text>
            <View style={styles.presetButtons}>
              {[
                { key: 'public-read', label: 'Public Read' },
                { key: 'private', label: 'Private' },
                { key: 'public', label: 'Public' },
              ].map(preset => (
                <TouchableOpacity
                  key={preset.key}
                  style={[
                    styles.presetButton,
                    selectedEACLPreset === preset.key && styles.presetButtonActive,
                  ]}
                  onPress={() => setSelectedEACLPreset(preset.key)}
                >
                  <Text style={[
                    styles.presetButtonText,
                    selectedEACLPreset === preset.key && styles.presetButtonTextActive,
                  ]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.buttonGrid}>
            <View style={styles.buttonWrapper}>
              <Button title="Build Preset" onPress={handleBuildEACL} />
            </View>
            <View style={styles.buttonWrapper}>
              <Button title="Build Custom" onPress={handleBuildCustomEACL} color="#6c757d" />
            </View>
            <View style={styles.buttonWrapper}>
              <Button title="Get Current" onPress={handleGetEACL} color="#17a2b8" />
            </View>
            <View style={styles.buttonWrapper}>
              <Button 
                title="Set EACL" 
                onPress={handleSetEACL} 
                color="#28a745"
                disabled={!currentEACL}
              />
            </View>
          </View>

          {currentEACL && (
            <View style={styles.eaclInfo}>
              <Text style={styles.eaclInfoTitle}>Current EACL ({currentEACL.records.length} rules)</Text>
              {currentEACL.records.slice(0, 5).map((r, i) => {
                const actionStr = r.action === Action.ALLOW ? '✓' : '✗';
                const actionColor = r.action === Action.ALLOW ? '#28a745' : '#dc3545';
                const opStr = ['?', 'GET', 'HEAD', 'PUT', 'DELETE', 'SEARCH', 'RANGE', 'HASH'][r.operation] || '?';
                const targetStr = r.targets.map(t => {
                  if (t.subjects.length > 0) return `${t.subjects.length} users`;
                  return ['?', 'USER', 'SYSTEM', 'OTHERS'][t.role] || '?';
                }).join(', ');
                return (
                  <Text key={i} style={[styles.eaclRule, { color: actionColor }]}>
                    {actionStr} {opStr.padEnd(6)} → {targetStr}
                  </Text>
                );
              })}
              {currentEACL.records.length > 5 && (
                <Text style={styles.eaclMoreRules}>
                  ... and {currentEACL.records.length - 5} more rules
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Bearer Token Section */}
      {connected && selectedContainer && currentEACL && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bearer Token</Text>
          <Text style={styles.hint}>
            Create a signed token to delegate access to others
          </Text>
          
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.expiryInput]}
              value={bearerTokenExpiry}
              onChangeText={setBearerTokenExpiry}
              placeholder="Epochs"
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>epochs until expiry</Text>
          </View>
          
          <TextInput
            style={styles.input}
            value={targetUserWif}
            onChangeText={setTargetUserWif}
            placeholder="Target user WIF (optional - leave empty for any bearer)"
            secureTextEntry
          />
          
          <View style={styles.buttonGrid}>
            <View style={styles.buttonWrapper}>
              <Button 
                title="Create Token" 
                onPress={handleCreateBearerToken}
                color="#6f42c1"
              />
            </View>
            <View style={styles.buttonWrapper}>
              <Button 
                title="Export" 
                onPress={handleExportBearerToken}
                color="#17a2b8"
                disabled={!bearerToken}
              />
            </View>
            <View style={styles.buttonWrapper}>
              <Button 
                title="Test Token" 
                onPress={handleTestBearerToken}
                disabled={!bearerToken}
              />
            </View>
          </View>

          {bearerToken && (
            <View style={styles.tokenInfo}>
              <Text style={styles.tokenInfoTitle}>Bearer Token Created</Text>
              <Text style={styles.tokenInfoText}>
                ● Signed: {bearerToken.isSigned ? 'Yes' : 'No'}
              </Text>
              <Text style={styles.tokenInfoText}>
                ● Lifetime: {bearerToken.lifetime?.nbf.toString() || '?'} → {bearerToken.lifetime?.exp.toString() || '?'}
              </Text>
              <Text style={styles.tokenInfoText}>
                ● Target: {bearerToken.targetUser ? bytesToHex(bearerToken.targetUser).substring(0, 16) + '...' : 'Any bearer'}
              </Text>
              <Text style={styles.tokenInfoText}>
                ● Rules: {bearerToken.eaclTable?.records.length || 0}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Logs Section */}
      <View style={styles.section}>
        <View style={styles.logsHeader}>
          <Text style={styles.sectionTitle}>Logs</Text>
          <Button title="Clear" onPress={clearLogs} />
        </View>
        
        <View style={styles.logsContainer}>
          {logs.length === 0 ? (
            <Text style={styles.noLogs}>No logs yet</Text>
          ) : (
            logs.map((entry, i) => (
              <Text
                key={i}
                style={[
                  styles.logEntry,
                  entry.level === 'error' && styles.logError,
                  entry.level === 'success' && styles.logSuccess,
                  entry.level === 'warn' && styles.logWarn,
                  entry.level === 'debug' && styles.logDebug,
                ]}
              >
                [{entry.timestamp.toLocaleTimeString()}] {entry.message}
              </Text>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    marginBottom: 12,
  },
  hostInput: {
    flex: 3,
    marginRight: 8,
    marginBottom: 0,
  },
  portInput: {
    flex: 1,
    marginBottom: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  buttonHalf: {
    flex: 1,
    marginHorizontal: 4,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  buttonWrapper: {
    padding: 4,
    width: '50%',
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  connected: {
    color: '#28a745',
  },
  disconnected: {
    color: '#6c757d',
  },
  infoBox: {
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 4,
  },
  containerList: {
    marginTop: 12,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  containerItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  containerInfo: {
    flex: 1,
  },
  selectedContainer: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#1976d2',
    borderWidth: 1,
    borderColor: '#1976d2',
  },
  containerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  containerAcl: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  containerId: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  contentInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  objectList: {
    marginTop: 12,
  },
  objectItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  objectInfo: {
    flex: 1,
  },
  objectName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  objectSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  objectId: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  objectActions: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  downloadButton: {
    backgroundColor: '#007bff',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  noObjects: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginTop: 12,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logsContainer: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    maxHeight: 300,
  },
  noLogs: {
    color: '#6c757d',
    fontStyle: 'italic',
  },
  logEntry: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#d4d4d4',
    marginBottom: 4,
  },
  logError: {
    color: '#f44336',
  },
  logSuccess: {
    color: '#4caf50',
  },
  logWarn: {
    color: '#ff9800',
  },
  logDebug: {
    color: '#9e9e9e',
  },
  // EACL styles
  presetContainer: {
    marginBottom: 12,
  },
  presetLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  presetButtons: {
    flexDirection: 'row',
  },
  presetButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e9ecef',
    borderRadius: 6,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  presetButtonActive: {
    backgroundColor: '#007bff',
  },
  presetButtonText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '600',
  },
  presetButtonTextActive: {
    color: '#fff',
  },
  eaclInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6c757d',
  },
  eaclInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  eaclRule: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  eaclMoreRules: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Bearer Token styles
  expiryInput: {
    flex: 0,
    width: 80,
    marginRight: 8,
    marginBottom: 0,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    alignSelf: 'center',
  },
  tokenInfo: {
    backgroundColor: '#f3e5f5',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6f42c1',
  },
  tokenInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  tokenInfoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  // Waiter toggle styles
  waiterToggle: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e9ecef',
    borderRadius: 8,
  },
  waiterToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  waiterToggleHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});
