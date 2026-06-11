#!/bin/bash
# ── JL-Manager Init-Script ────────────────────────────────────────────────────
# Richtet einen frischen Linux-Rechner (Debian/Ubuntu) so ein, dass alle
# Build-Targets (Web, Linux, Windows, Android) funktionieren.
#
# Aufruf: ./init.sh
# Das Script ist idempotent — es kann mehrfach ausgeführt werden.
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Farben ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  OK:${NC}    $*"; }
warn() { echo -e "${YELLOW}  WARN:${NC}  $*"; }
info() { echo -e "  →      $*"; }
step() { echo -e "\n${GREEN}=== $* ===${NC}"; }
fail() { echo -e "${RED}  FEHLER:${NC} $*"; exit 1; }

# ── Versions-Pins ─────────────────────────────────────────────────────────────
NODE_MAJOR=22
ANDROID_CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
NDK_VERSION="27.0.12077973"
JAVA_MIN=17

# ─────────────────────────────────────────────────────────────────────────────
step "Betriebssystem prüfen"
if ! command -v apt-get &>/dev/null; then
  fail "Dieses Script setzt Debian/Ubuntu voraus (apt-get nicht gefunden)."
fi
ok "Debian/Ubuntu erkannt"

# ─────────────────────────────────────────────────────────────────────────────
step "System-Pakete"

PKGS=(
  curl wget git unzip zip
  build-essential pkg-config libssl-dev
  libgtk-3-dev libwebkit2gtk-4.1-dev
  libayatana-appindicator3-dev librsvg2-dev
  libsoup-3.0-dev libjavascriptcoregtk-4.1-dev
  nsis
  openjdk-17-jdk
)

info "apt-get update..."
sudo apt-get update -qq

MISSING_PKGS=()
for pkg in "${PKGS[@]}"; do
  dpkg -s "$pkg" &>/dev/null || MISSING_PKGS+=("$pkg")
done

if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
  info "Installiere: ${MISSING_PKGS[*]}"
  sudo apt-get install -y "${MISSING_PKGS[@]}"
fi
ok "System-Pakete installiert"

# ─────────────────────────────────────────────────────────────────────────────
step "Java (OpenJDK $JAVA_MIN+)"

JAVA_VER=$(java -version 2>&1 | head -1 | sed 's/.*version "\([0-9]*\).*/\1/')
if [ -z "$JAVA_VER" ] || [ "$JAVA_VER" -lt "$JAVA_MIN" ]; then
  info "Setze Java $JAVA_MIN als Standard..."
  sudo update-alternatives --set java "$(update-alternatives --list java | grep "java-$JAVA_MIN" | head -1)"
fi
JAVA_HOME_DETECTED=$(dirname "$(dirname "$(readlink -f "$(which java)")")")
export JAVA_HOME="${JAVA_HOME:-$JAVA_HOME_DETECTED}"
ok "Java: $(java -version 2>&1 | head -1)  (JAVA_HOME=$JAVA_HOME)"

# ─────────────────────────────────────────────────────────────────────────────
step "Node.js $NODE_MAJOR"

if command -v node &>/dev/null; then
  NODE_INSTALLED=$(node --version | sed 's/v\([0-9]*\).*/\1/')
  if [ "$NODE_INSTALLED" -ge "$NODE_MAJOR" ]; then
    ok "Node.js $(node --version) bereits installiert"
  else
    warn "Node.js $(node --version) zu alt — installiere v$NODE_MAJOR"
    NODE_INSTALL=true
  fi
else
  NODE_INSTALL=true
fi

if [ "${NODE_INSTALL:-false}" = true ]; then
  info "NodeSource-Repository einrichten..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
  ok "Node.js $(node --version) installiert"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "pnpm"

if command -v pnpm &>/dev/null; then
  ok "pnpm $(pnpm --version) bereits installiert"
else
  info "Installiere pnpm..."
  sudo npm install -g pnpm
  ok "pnpm $(pnpm --version) installiert"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Rust + Cargo"

if command -v rustup &>/dev/null; then
  ok "Rust $(rustc --version) bereits installiert"
  rustup update stable --no-self-update
else
  info "Installiere Rust via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
  ok "Rust $(rustc --version) installiert"
fi

# Rust in aktuelle Shell-Session verfügbar machen
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"

# ── Rust-Targets ──────────────────────────────────────────────────────────────
step "Rust-Targets"

TARGETS=(
  aarch64-linux-android
  armv7-linux-androideabi
  i686-linux-android
  x86_64-linux-android
  x86_64-pc-windows-msvc
)

for TARGET in "${TARGETS[@]}"; do
  if rustup target list --installed | grep -q "$TARGET"; then
    ok "$TARGET"
  else
    info "Installiere $TARGET..."
    rustup target add "$TARGET"
    ok "$TARGET"
  fi
done

# ── cargo-xwin (Windows-Cross-Compile) ────────────────────────────────────────
step "cargo-xwin"

if command -v cargo-xwin &>/dev/null; then
  ok "cargo-xwin bereits installiert"
else
  info "Installiere cargo-xwin (dauert ein paar Minuten)..."
  cargo install cargo-xwin
  ok "cargo-xwin installiert"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Android SDK + NDK"

mkdir -p "$ANDROID_HOME/cmdline-tools"

if [ -f "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  ok "Android Command-Line Tools bereits installiert"
else
  info "Lade Android Command-Line Tools herunter..."
  TMP_ZIP=$(mktemp /tmp/android-cmdtools-XXXXXX.zip)
  wget -q --show-progress -O "$TMP_ZIP" "$ANDROID_CMDLINE_TOOLS_URL"
  info "Entpacke nach $ANDROID_HOME/cmdline-tools/latest ..."
  TMP_DIR=$(mktemp -d)
  unzip -q "$TMP_ZIP" -d "$TMP_DIR"
  mv "$TMP_DIR/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  rm -rf "$TMP_ZIP" "$TMP_DIR"
  ok "Command-Line Tools installiert"
fi

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

info "Akzeptiere SDK-Lizenzen..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true

SDK_PACKAGES=(
  "platform-tools"
  "build-tools;35.0.0"
  "platforms;android-35"
  "ndk;$NDK_VERSION"
)

for PKG in "${SDK_PACKAGES[@]}"; do
  if sdkmanager --list_installed 2>/dev/null | grep -q "$(echo "$PKG" | sed 's/;/ /')"; then
    ok "$PKG"
  else
    info "Installiere $PKG..."
    sdkmanager "$PKG"
    ok "$PKG"
  fi
done

export NDK_HOME="$ANDROID_HOME/ndk/$NDK_VERSION"

# ─────────────────────────────────────────────────────────────────────────────
step "Shell-Profil aktualisieren (~/.bashrc / ~/.zshrc)"

PROFILE_BLOCK="
# ── JL-Manager Build-Umgebung ─────────────────────────────────────────────
export JAVA_HOME=\"$JAVA_HOME\"
export ANDROID_HOME=\"$ANDROID_HOME\"
export NDK_HOME=\"$ANDROID_HOME/ndk/$NDK_VERSION\"
export PATH=\"\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$HOME/.cargo/bin:\$PATH\"
# ─────────────────────────────────────────────────────────────────────────"

for PROFILE in "$HOME/.bashrc" "$HOME/.zshrc"; do
  if [ -f "$PROFILE" ]; then
    if grep -q "JL-Manager Build-Umgebung" "$PROFILE"; then
      ok "$PROFILE bereits konfiguriert"
    else
      echo "$PROFILE_BLOCK" >> "$PROFILE"
      ok "$PROFILE aktualisiert"
    fi
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
step "npm-Abhängigkeiten installieren"

cd "$SCRIPT_DIR"
info "Root-Paket installieren..."
pnpm install

info "JL-Manager-Paket installieren..."
cd "$SCRIPT_DIR/JL-Manager" && pnpm install && cd "$SCRIPT_DIR"

ok "Alle npm-Abhängigkeiten installiert"

# ─────────────────────────────────────────────────────────────────────────────
step ".env einrichten"

if [ -f "$SCRIPT_DIR/.env" ]; then
  ok ".env existiert bereits — wird nicht überschrieben"
else
  cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
  warn ".env aus .env.example erstellt — bitte Werte eintragen:"
  info "  nano $SCRIPT_DIR/.env"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Android Keystore"

KEYSTORE="$SCRIPT_DIR/jl-manager.keystore"

if [ -f "$KEYSTORE" ]; then
  ok "Keystore $KEYSTORE existiert bereits"
else
  echo ""
  echo -e "${YELLOW}  Kein Android-Keystore gefunden.${NC}"
  echo "  Zum Signieren von Release-APKs wird ein Keystore benötigt."
  echo ""
  echo "  Optionen:"
  echo "    [1] Jetzt neu erstellen (empfohlen für frische Setups)"
  echo "    [2] Überspringen (Keystore später manuell ablegen)"
  echo ""
  printf "  Auswahl [1/2]: "
  read -r KS_CHOICE

  if [ "$KS_CHOICE" = "1" ]; then
    echo ""
    info "Erstelle Keystore: $KEYSTORE"
    info "Du wirst nach Passwörtern und Zertifikats-Infos gefragt."
    echo ""
    keytool -genkey -v \
      -keystore "$KEYSTORE" \
      -alias jl-manager \
      -keyalg RSA \
      -keysize 2048 \
      -validity 10000
    ok "Keystore erstellt: $KEYSTORE"
    echo ""
    warn "Trage die gewählten Passwörter in .env ein:"
    info "  KEYSTORE_PASSWORD=<keystore-passwort>"
    info "  KEY_PASSWORD=<key-passwort>"
    info "  → nano $SCRIPT_DIR/.env"
    warn "Sichere den Keystore! Ohne ihn kannst du keine neuen Versionen signieren."
  else
    warn "Keystore übersprungen. Lege $KEYSTORE vor dem ersten Build ab."
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Setup abgeschlossen!                           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Nächste Schritte:"
echo ""
echo "  1. Neue Shell öffnen (oder: source ~/.bashrc) damit PATH greift"
echo ""
echo "  2. .env prüfen / befüllen:"
echo "       nano $SCRIPT_DIR/.env"
echo ""
echo "  3. Entwicklung starten:"
echo "       cd JL-Manager && pnpm run dev       # reines Web-Dev"
echo "       ./test_run.sh                        # Tauri Desktop/Android live"
echo ""
echo "  4. Production-Build:"
echo "       ./build.sh                           # Linux + Windows + Android"
echo "       ./android_build.sh                   # nur Android"
echo "       ./linux_build.sh                     # nur Linux + Windows"
echo ""
