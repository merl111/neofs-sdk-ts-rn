#!/usr/bin/env sh
# Protoc wipes src/gen-grpc-react-native/*. Restores the barrel re-export module.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cp "$SCRIPT_DIR/gen-grpc-react-native-index.ts" "$ROOT/src/gen-grpc-react-native/index.ts"
