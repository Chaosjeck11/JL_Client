#!/bin/bash
set -e
set -a; source .env; set +a


SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAURI_CONF="$SCRIPT_DIR/JL-Manager/src-tauri/tauri.conf.json"
KEYSTORE="$SCRIPT_DIR/jl-manager.keystore"

# ── Keystore-Passwörter ───────────────────────────────────────────────────────
: "${KEYSTORE_PASSWORD:?KEYSTORE_PASSWORD nicht gesetzt}"
: "${KEY_PASSWORD:?KEY_PASSWORD nicht gesetzt}"
export KEYSTORE_PASSWORD
export KEY_PASSWORD

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
VERSION=$(grep '"version"' "$TAURI_CONF" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
echo ""
echo "=== JL-Manager v$VERSION ==="

OUT_DIR="$SCRIPT_DIR/Builds/$VERSION"
mkdir -p "$OUT_DIR/linux"
mkdir -p "$OUT_DIR/android"
mkdir -p "$OUT_DIR/windows"

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
  find src-tauri/gen/android -name "*.apk" -exec cp {} "$OUT_DIR/android/" \; 2>/dev/null || true
  find src-tauri/gen/android -name "*.aab" -exec cp {} "$OUT_DIR/android/" \; 2>/dev/null || true
else
  echo "WARNUNG: Android-Build fehlgeschlagen. Übersprungen."
fi

# ── Ergebnis ──────────────────────────────────────────────────────────────────
echo ""
echo "=== FERTIG ==="
echo "Builds in: $OUT_DIR"
echo ""
find "$OUT_DIR" -type f | sort
