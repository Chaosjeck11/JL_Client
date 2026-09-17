#!/bin/bash
set -e
set -a; source .env; set +a

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAURI_CONF="$SCRIPT_DIR/JL-Manager/src-tauri/tauri.conf.json"

: "${SERVER_USER:?SERVER_USER nicht gesetzt}"
: "${SERVER_HOST:?SERVER_HOST nicht gesetzt}"
: "${SERVER_PATH:?SERVER_PATH nicht gesetzt}"

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
rm -rf "$OUT_DIR/windows"
mkdir -p "$OUT_DIR/windows"

cd "$SCRIPT_DIR/JL-Manager"

# ── Windows ───────────────────────────────────────────────────────────────────
echo ""
echo "=== BUILD WINDOWS ==="
WIN_BUNDLE_DIR="src-tauri/target/x86_64-pc-windows-msvc/release/bundle"

if NO_STRIP=true pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc; then
  # target/ accumulates artifacts from every past local build — filter by
  # $VERSION so only this run's files get copied.
  find "$WIN_BUNDLE_DIR/nsis" -name "*$VERSION*.exe" -exec cp {} "$OUT_DIR/windows/" \; 2>/dev/null || true
  find "$WIN_BUNDLE_DIR/msi"  -name "*$VERSION*.msi" -exec cp {} "$OUT_DIR/windows/" \; 2>/dev/null || true
else
  echo "WARNUNG: Windows-Build fehlgeschlagen. Übersprungen."
fi

# ── latest.json ───────────────────────────────────────────────────────────────
WIN_FILE=$(find "$OUT_DIR/windows" -name "*.exe" -printf "%f\n" | head -1)

mkdir -p "$SCRIPT_DIR/Builds"
if [ -f "$SCRIPT_DIR/Builds/latest.json" ]; then
  # bestehende linux/android-Einträge erhalten, nur windows + version aktualisieren
  sed -i "s/\"version\": *\"[^\"]*\"/\"version\": \"$VERSION\"/" "$SCRIPT_DIR/Builds/latest.json"
  sed -i "s/\"windows\": *\"[^\"]*\"/\"windows\": \"${WIN_FILE:-}\"/" "$SCRIPT_DIR/Builds/latest.json"
else
  cat > "$SCRIPT_DIR/Builds/latest.json" << EOF
{
  "version": "$VERSION",
  "linux":   "",
  "windows": "${WIN_FILE:-}",
  "android": ""
}
EOF
fi

echo "  OK: latest.json erstellt"

# ── Cleanup ───────────────────────────────────────────────────────────────────
echo ""
echo "=== CLEANUP ==="
KEEP=3
mapfile -t ALL_VERSIONS < <(find "$SCRIPT_DIR/Builds" -maxdepth 1 -mindepth 1 -type d -printf "%f\n" | sort -V)
if [ "${#ALL_VERSIONS[@]}" -gt "$KEEP" ]; then
  for OLD_VERSION in "${ALL_VERSIONS[@]:0:$((${#ALL_VERSIONS[@]} - KEEP))}"; do
    echo "  Lösche alten Build: $OLD_VERSION"
    rm -rf "$SCRIPT_DIR/Builds/$OLD_VERSION"
  done
else
  echo "  Nichts zu löschen (${#ALL_VERSIONS[@]} Versionen vorhanden, $KEEP werden behalten)."
fi

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

  ssh "$SERVER_USER@$SERVER_HOST" "mkdir -p $SERVER_PATH/$VERSION/windows"
  scp -r "$OUT_DIR/"* "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/$VERSION/"
  scp "$SCRIPT_DIR/Builds/latest.json" "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/latest.json"

  echo "  OK: Deployment abgeschlossen."
fi
