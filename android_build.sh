#!/bin/bash
set -e
set -a; source .env; set +a

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAURI_CONF="$SCRIPT_DIR/JL-Manager/src-tauri/tauri.conf.json"
KEYSTORE="$SCRIPT_DIR/jl-manager.keystore"

SERVER_USER="ben"
SERVER_HOST="100.91.210.125"   # Tailscale IP anpassen
SERVER_PATH="/mnt/docker/JL_Backend/Builds"

# ── Keystore-Passwörter ───────────────────────────────────────────────────────
: "${KEYSTORE_PASSWORD:?KEYSTORE_PASSWORD nicht gesetzt}"
: "${KEY_PASSWORD:?KEY_PASSWORD nicht gesetzt}"
export KEYSTORE_PASSWORD
export KEY_PASSWORD

# ── Release-Typ ───────────────────────────────────────────────────────────────
CURRENT_VERSION=$(grep '"version"' "$TAURI_CONF" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
IFS='.' read -r VER_MAJOR VER_MINOR VER_PATCH <<< "$CURRENT_VERSION"

echo ""
echo "Aktuelle Version: $CURRENT_VERSION"
echo "Release-Typ? [1] Major  [2] Minor  [3] Patch"
read -r RELEASE_TYPE

case "$RELEASE_TYPE" in
  1) VER_MAJOR=$((VER_MAJOR + 1)); VER_MINOR=0; VER_PATCH=0 ;;
  2) VER_MINOR=$((VER_MINOR + 1)); VER_PATCH=0 ;;
  3) VER_PATCH=$((VER_PATCH + 1)) ;;
  *) echo "Ungültige Auswahl. Abbruch."; exit 1 ;;
esac

VERSION="$VER_MAJOR.$VER_MINOR.$VER_PATCH"

sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$VERSION\"/" "$TAURI_CONF"
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$VERSION\"/" "$SCRIPT_DIR/JL-Manager/package.json"

echo "Neue Version: $VERSION"

# ── Preflight ─────────────────────────────────────────────────────────────────
echo "=== PREFLIGHT ==="
PREFLIGHT_OK=true

check() {
  if ! command -v "$1" &>/dev/null; then
    echo "  FEHLT: $1"
    PREFLIGHT_OK=false
  else
    echo "  OK:    $1"
  fi
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Sync src..."
cp -r src/* JL-Manager/src/
cp index.html JL-Manager/index.html
cp -r public/* JL-Manager/public/ 2>/dev/null || true

check pnpm
check cargo
check rustup
check cargo-xwin
check makensis

for VAR in JAVA_HOME ANDROID_HOME NDK_HOME; do
  if [ -z "${!VAR}" ]; then
    echo "  FEHLT: \$$VAR nicht gesetzt"
    PREFLIGHT_OK=false
  else
    echo "  OK:    $VAR=${!VAR}"
  fi
done

if [ ! -f "$KEYSTORE" ]; then
  echo "  FEHLT: $KEYSTORE nicht gefunden"
  PREFLIGHT_OK=false
else
  echo "  OK:    Keystore gefunden"
fi

for TARGET in aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android; do
  if rustup target list --installed | grep -q "$TARGET"; then
    echo "  OK:    rust target $TARGET"
  else
    echo "  FEHLT: rust target $TARGET  →  rustup target add $TARGET"
    PREFLIGHT_OK=false
  fi
done

if rustup target list --installed | grep -q "x86_64-pc-windows-msvc"; then
  echo "  OK:    rust target x86_64-pc-windows-msvc"
else
  echo "  FEHLT: rust target x86_64-pc-windows-msvc  →  rustup target add x86_64-pc-windows-msvc"
  PREFLIGHT_OK=false
fi

if [ "$PREFLIGHT_OK" = false ]; then
  echo ""
  echo "Preflight fehlgeschlagen. Build abgebrochen."
  exit 1
fi

# ── Version ───────────────────────────────────────────────────────────────────
echo ""
echo "=== JL-Manager v$VERSION ==="

OUT_DIR="$SCRIPT_DIR/Builds/$VERSION"
rm -rf "$OUT_DIR/linux" "$OUT_DIR/android" "$OUT_DIR/windows"
mkdir -p "$OUT_DIR/linux" "$OUT_DIR/android" "$OUT_DIR/windows"

cd "$SCRIPT_DIR/JL-Manager"

BUNDLE_DIR="src-tauri/target/release/bundle"


# ── Android ───────────────────────────────────────────────────────────────────
echo ""
echo "=== BUILD ANDROID ==="

if [ ! -d "src-tauri/gen/android" ]; then
  echo "Einmalig: tauri android init..."
  pnpm tauri android init
fi

if pnpm tauri android build --apk; then
  find src-tauri/gen/android/app/build/outputs/apk    -name "*release*.apk" -exec cp {} "$OUT_DIR/android/" \; 2>/dev/null || true
  find src-tauri/gen/android/app/build/outputs/bundle -name "*release*.aab" -exec cp {} "$OUT_DIR/android/" \; 2>/dev/null || true
else
  echo "WARNUNG: Android-Build fehlgeschlagen. Übersprungen."
fi

# ── latest.json ───────────────────────────────────────────────────────────────
LINUX_FILE=$(find "$OUT_DIR/linux"   -name "*.AppImage" -printf "%f\n" | head -1)
WIN_FILE=$(find   "$OUT_DIR/windows" -name "*.exe"       -printf "%f\n" | head -1)
APK_FILE=$(find   "$OUT_DIR/android" -name "*.apk"       -printf "%f\n" | head -1)

mkdir -p "$SCRIPT_DIR/Builds"
cat > "$SCRIPT_DIR/Builds/latest.json" << EOF
{
  "version": "$VERSION",
  "linux":   "${LINUX_FILE:-}",
  "windows": "${WIN_FILE:-}",
  "android": "${APK_FILE:-}"
}
EOF

echo "  OK: latest.json erstellt"

# ── Ergebnis ──────────────────────────────────────────────────────────────────
echo ""
echo "=== FERTIG ==="
echo "Builds in: $OUT_DIR"
echo ""
find "$OUT_DIR" -type f | sort

# ── Deploy ────────────────────────────────────────────────────────────────────
echo ""
echo "Auf Server deployen? [j/N]"
read -r DEPLOY_ANSWER

if [ "$DEPLOY_ANSWER" = "j" ] || [ "$DEPLOY_ANSWER" = "J" ]; then
  echo "=== DEPLOY v$VERSION → $SERVER_HOST ==="

  ssh "$SERVER_USER@$SERVER_HOST" "mkdir -p $SERVER_PATH/$VERSION/linux $SERVER_PATH/$VERSION/windows $SERVER_PATH/$VERSION/android"
  scp -r "$OUT_DIR/"* "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/$VERSION/"
  scp "$SCRIPT_DIR/Builds/latest.json" "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/latest.json"

  echo "  OK: Deployment abgeschlossen."
fi
