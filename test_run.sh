#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Sync src..."
cp -r src/* JL-Manager/src/
cp index.html JL-Manager/index.html
cp -r public/* JL-Manager/public/ 2>/dev/null || true

echo "==> npm install..."
cd JL-Manager
npm install

echo "==> tauri dev..."
GDK_BACKEND=x11 WAYLAND_DISPLAY="" WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri dev

