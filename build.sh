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
VERSION=$(grep '"version"' "$TAURI_CONF" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
echo ""
echo "=== JL-Manager v$VERSION ==="

OUT_DIR="$SCRIPT_DIR/Builds/$VERSION"
mkdir -p "$OUT_DIR/linux"
mkdir -p "$OUT_DIR/android"
mkdir -p "$OUT_DIR/windows"

cd "$SCRIPT_DIR/JL-Manager"

BUNDLE_DIR="src-tauri/target/release/bundle"

# ── Linux ─────────────────────────────────────────────────────────────────────
echo ""
echo "=== BUILD LINUX ==="
NO_STRIP=true \
GDK_BACKEND=x11 \
WAYLAND_DISPLAY="" \
WEBKIT_DISABLE_DMABUF_RENDERER=1 \
pnpm tauri build

find "$BUNDLE_DIR/appimage" -name "*.AppImage" -exec cp {} "$OUT_DIR/linux/" \; 2>/dev/null || true
find "$BUNDLE_DIR/deb"      -name "*.deb"      -exec cp {} "$OUT_DIR/linux/" \; 2>/dev/null || true
find "$BUNDLE_DIR/rpm"      -name "*.rpm"      -exec cp {} "$OUT_DIR/linux/" \; 2>/dev/null || true

# ── Linux Install-Script ──────────────────────────────────────────────────────
APPIMAGE_NAME=$(find "$OUT_DIR/linux" -name "*.AppImage" -printf "%f\n" | head -1)
ICON_SRC="$SCRIPT_DIR/JL-Manager/src-tauri/icons/128x128.png"

cat > "$OUT_DIR/linux/install.sh" << EOF
#!/bin/bash
set -e

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
APPIMAGE="\$SCRIPT_DIR/$APPIMAGE_NAME"

if [ ! -f "\$APPIMAGE" ]; then
  echo "FEHLER: AppImage nicht gefunden: \$APPIMAGE"
  exit 1
fi

echo "=== JL-Manager Installation ==="

# AppImage nach /usr/local/bin mit versioniertem Namen kopieren
sudo cp "\$APPIMAGE" /usr/local/bin/$APPIMAGE_NAME
sudo chmod +x /usr/local/bin/$APPIMAGE_NAME
echo "  OK: AppImage nach /usr/local/bin/$APPIMAGE_NAME kopiert"

# Wrapper-Script erstellen (löst WebKit GPU-Compositing-Bugs auf allen Maschinen)
sudo tee /usr/local/bin/jl-manager > /dev/null << 'WRAPPER'
#!/bin/bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 exec /usr/local/bin/$APPIMAGE_NAME "\$@"
WRAPPER
sudo chmod +x /usr/local/bin/jl-manager
echo "  OK: Wrapper /usr/local/bin/jl-manager erstellt"

# Icon kopieren
if [ -f "\$SCRIPT_DIR/jl-manager.png" ]; then
  sudo cp "\$SCRIPT_DIR/jl-manager.png" /usr/share/icons/jl-manager.png
  echo "  OK: Icon installiert"
else
  echo "  WARN: Icon nicht gefunden, übersprungen"
fi

# Desktop-Eintrag
sudo tee /usr/share/applications/jl-manager.desktop > /dev/null << DESKTOP
[Desktop Entry]
Name=JL-Manager
Exec=/usr/local/bin/jl-manager
Icon=/usr/share/icons/jl-manager.png
Type=Application
Categories=Utility;
StartupNotify=true
DESKTOP
echo "  OK: Desktop-Eintrag erstellt"

sudo update-desktop-database 2>/dev/null || true
echo "  OK: Menü aktualisiert"

echo ""
echo "=== Fertig. JL-Manager ist installiert. ==="
EOF

chmod +x "$OUT_DIR/linux/install.sh"

# Icon ins Linux-Verzeichnis kopieren
if [ -f "$ICON_SRC" ]; then
  cp "$ICON_SRC" "$OUT_DIR/linux/jl-manager.png"
fi

echo "  OK: install.sh erstellt"

# ── Windows ───────────────────────────────────────────────────────────────────
echo ""
echo "=== BUILD WINDOWS ==="
WIN_BUNDLE_DIR="src-tauri/target/x86_64-pc-windows-msvc/release/bundle"

if NO_STRIP=true pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc; then
  find "$WIN_BUNDLE_DIR/nsis" -name "*.exe" -exec cp {} "$OUT_DIR/windows/" \; 2>/dev/null || true
  find "$WIN_BUNDLE_DIR/msi"  -name "*.msi" -exec cp {} "$OUT_DIR/windows/" \; 2>/dev/null || true
else
  echo "WARNUNG: Windows-Build fehlgeschlagen. Übersprungen."
fi

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
