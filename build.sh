#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAURI_CONF="$SCRIPT_DIR/JL-Manager/src-tauri/tauri.conf.json"

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

# Android-Umgebungsvariablen
for VAR in JAVA_HOME ANDROID_HOME NDK_HOME; do
  if [ -z "${!VAR}" ]; then
    echo "  FEHLT: \$$VAR nicht gesetzt"
    PREFLIGHT_OK=false
  else
    echo "  OK:    $VAR=${!VAR}"
  fi
done

# Rust Android-Targets
for TARGET in aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android; do
  if rustup target list --installed | grep -q "$TARGET"; then
    echo "  OK:    rust target $TARGET"
  else
    echo "  FEHLT: rust target $TARGET  →  rustup target add $TARGET"
    PREFLIGHT_OK=false
  fi
done

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

cd "$SCRIPT_DIR/JL-Manager"

BUNDLE_DIR="src-tauri/target/release/bundle"

# ── Linux ────────────────────────────────────────────────────────────────────
echo ""
echo "=== BUILD LINUX ==="
NO_STRIP=true pnpm tauri build

find "$BUNDLE_DIR/appimage" -name "*.AppImage" -exec cp {} "$OUT_DIR/linux/" \; 2>/dev/null || true
find "$BUNDLE_DIR/deb"      -name "*.deb"      -exec cp {} "$OUT_DIR/linux/" \; 2>/dev/null || true
find "$BUNDLE_DIR/rpm"      -name "*.rpm"      -exec cp {} "$OUT_DIR/linux/" \; 2>/dev/null || true

# ── Android ──────────────────────────────────────────────────────────────────
echo ""
echo "=== BUILD ANDROID ==="

# init nur wenn gen/android fehlt (einmalig)
if [ ! -d "src-tauri/gen/android" ]; then
  echo "Einmalig: tauri android init..."
  pnpm tauri android init
fi

if pnpm tauri android build; then
  # APKs liegen unter gen/android/app/build/outputs/apk/
  find src-tauri/gen/android -name "*.apk" -exec cp {} "$OUT_DIR/android/" \; 2>/dev/null || true
  find src-tauri/gen/android -name "*.aab" -exec cp {} "$OUT_DIR/android/" \; 2>/dev/null || true
else
  echo "WARNUNG: Android-Build fehlgeschlagen. Übersprungen."
fi

# ── Ergebnis ─────────────────────────────────────────────────────────────────
echo ""
echo "=== FERTIG ==="
echo "Builds in: $OUT_DIR"
echo ""
find "$OUT_DIR" -type f | sort
