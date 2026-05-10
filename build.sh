cat > sync-build.sh << 'EOF'
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

echo "==> tauri build..."
npm run tauri build

echo "==> Bundle:"
ls src-tauri/target/release/bundle/
EOF
