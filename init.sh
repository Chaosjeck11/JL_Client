#!/bin/bash
# ── JL-Manager Init-Script ────────────────────────────────────────────────────
# Richtet einen frischen Linux-Rechner so ein, dass alle Build-Targets
# (Web, Linux-Desktop, Windows, Android) gebaut werden können.
#
# Unterstützte Distributionen:
#   Debian / Ubuntu / Linux Mint / Pop!_OS
#   Arch Linux / CachyOS / Manjaro / EndeavourOS / Garuda
#   Fedora / RHEL / CentOS Stream / AlmaLinux / Rocky Linux
#   openSUSE Tumbleweed / Leap
#
# Aufruf: ./init.sh [--auto]
#   --auto  Keine interaktiven Eingaben: tzdata→Europa/Berlin, Keystore überspringen.
#           Ideal für CI, Container und vollautomatische Setups.
# Das Script ist idempotent — es kann mehrfach ausgeführt werden.
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Flags ─────────────────────────────────────────────────────────────────────
AUTO=false
for arg in "$@"; do
  case "$arg" in
    --auto) AUTO=true ;;
    *) echo "Unbekanntes Argument: $arg"; echo "Verwendung: ./init.sh [--auto]"; exit 1 ;;
  esac
done

# ── Farben ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  OK:${NC}    $*"; }
warn() { echo -e "${YELLOW}  WARN:${NC}  $*"; }
info() { echo -e "  →      $*"; }
step() { echo -e "\n${CYAN}=== $* ===${NC}"; }
fail() { echo -e "${RED}  FEHLER:${NC} $*"; exit 1; }

# ── sudo-Wrapper: als root direkt ausführen, sonst sudo nutzen ───────────────
if [ "$(id -u)" = "0" ]; then
  SUDO=""
else
  if ! command -v sudo &>/dev/null; then
    fail "Nicht root und kein sudo verfügbar. Script als root ausführen oder sudo installieren."
  fi
  SUDO="sudo"
fi

# ── Nicht-interaktiver apt-Modus (verhindert tzdata-Eingabeaufforderung) ──────
# tzdata fragt sonst interaktiv nach Weltregion (7=Europa) und Stadt (8=Berlin).
export DEBIAN_FRONTEND=noninteractive
export TZ=Europe/Berlin

# ── Versions-Pins ─────────────────────────────────────────────────────────────
NODE_MAJOR=22
ANDROID_CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
NDK_VERSION="27.0.12077973"
JAVA_MIN=17

# ─────────────────────────────────────────────────────────────────────────────
step "Distribution erkennen"

DISTRO_FAMILY=""
DISTRO_NAME=""
PKG_MANAGER=""

if [ -f /etc/os-release ]; then
  # shellcheck source=/dev/null
  source /etc/os-release
  DISTRO_NAME="${NAME:-unbekannt}"
  ID_LOWER="${ID,,}"
  ID_LIKE_LOWER="${ID_LIKE,,}"

  case "$ID_LOWER" in
    ubuntu|debian|linuxmint|pop|elementary|zorin|kali|raspbian)
      DISTRO_FAMILY="debian"
      PKG_MANAGER="apt"
      ;;
    arch|cachyos|manjaro|endeavouros|garuda|arcolinux|artix|crystal|blackarch)
      DISTRO_FAMILY="arch"
      PKG_MANAGER="pacman"
      ;;
    fedora|rhel|centos|almalinux|rocky|nobara|ultramarine|bazzite)
      DISTRO_FAMILY="fedora"
      PKG_MANAGER="dnf"
      ;;
    opensuse*|sles)
      DISTRO_FAMILY="suse"
      PKG_MANAGER="zypper"
      ;;
    *)
      # Fallback über ID_LIKE
      if [[ "$ID_LIKE_LOWER" == *"debian"* ]] || [[ "$ID_LIKE_LOWER" == *"ubuntu"* ]]; then
        DISTRO_FAMILY="debian"; PKG_MANAGER="apt"
      elif [[ "$ID_LIKE_LOWER" == *"arch"* ]]; then
        DISTRO_FAMILY="arch"; PKG_MANAGER="pacman"
      elif [[ "$ID_LIKE_LOWER" == *"fedora"* ]] || [[ "$ID_LIKE_LOWER" == *"rhel"* ]]; then
        DISTRO_FAMILY="fedora"; PKG_MANAGER="dnf"
      elif [[ "$ID_LIKE_LOWER" == *"suse"* ]]; then
        DISTRO_FAMILY="suse"; PKG_MANAGER="zypper"
      fi
      ;;
  esac
fi

if [ -z "$DISTRO_FAMILY" ]; then
  fail "Distribution nicht erkannt. Unterstützt: Debian/Ubuntu, Arch/CachyOS, Fedora/RHEL, openSUSE."
fi

ok "$DISTRO_NAME  (Familie: $DISTRO_FAMILY, Paketmanager: $PKG_MANAGER)"

# ─────────────────────────────────────────────────────────────────────────────
step "System-Pakete installieren"

install_pkgs_debian() {
  local PKGS=(
    curl wget git unzip zip
    build-essential pkg-config libssl-dev
    libgtk-3-dev libwebkit2gtk-4.1-dev
    libayatana-appindicator3-dev librsvg2-dev
    libsoup-3.0-dev libjavascriptcoregtk-4.1-dev
    nsis
    openjdk-17-jdk
  )
  info "apt-get update..."
  $SUDO apt-get update -qq
  local MISSING=()
  for pkg in "${PKGS[@]}"; do
    dpkg -s "$pkg" &>/dev/null || MISSING+=("$pkg")
  done
  if [ ${#MISSING[@]} -gt 0 ]; then
    info "Installiere: ${MISSING[*]}"
    $SUDO apt-get install -y "${MISSING[@]}"
  fi
}

install_pkgs_arch() {
  # Prüfe ob paru oder yay für AUR-Pakete vorhanden ist
  AUR_HELPER=""
  for helper in paru yay; do
    if command -v "$helper" &>/dev/null; then
      AUR_HELPER="$helper"
      break
    fi
  done

  local PKGS=(
    curl wget git unzip zip
    base-devel openssl pkg-config
    gtk3 webkit2gtk-4.1
    libayatana-appindicator librsvg
    jdk17-openjdk
  )
  # nsis ist auf Arch im AUR (mingw-w64-nsis) oder als nsis
  local PACMAN_PKGS=("${PKGS[@]}")
  local AUR_PKGS=()

  # nsis: in den offiziellen Repos für manche Arch-Derivate verfügbar
  if pacman -Ss "^nsis$" 2>/dev/null | grep -q "^community\|^extra\|^multilib"; then
    PACMAN_PKGS+=(nsis)
  else
    AUR_PKGS+=(nsis)
  fi

  info "pacman -Syu..."
  $SUDO pacman -Syu --noconfirm --needed

  local MISSING=()
  for pkg in "${PACMAN_PKGS[@]}"; do
    pacman -Q "$pkg" &>/dev/null || MISSING+=("$pkg")
  done
  if [ ${#MISSING[@]} -gt 0 ]; then
    info "Installiere: ${MISSING[*]}"
    $SUDO pacman -S --noconfirm --needed "${MISSING[@]}"
  fi

  # AUR-Pakete
  if [ ${#AUR_PKGS[@]} -gt 0 ]; then
    if [ -n "$AUR_HELPER" ]; then
      local AUR_MISSING=()
      for pkg in "${AUR_PKGS[@]}"; do
        pacman -Q "$pkg" &>/dev/null || AUR_MISSING+=("$pkg")
      done
      if [ ${#AUR_MISSING[@]} -gt 0 ]; then
        info "Installiere AUR-Pakete via $AUR_HELPER: ${AUR_MISSING[*]}"
        "$AUR_HELPER" -S --noconfirm --needed "${AUR_MISSING[@]}"
      fi
    else
      warn "AUR-Pakete benötigt (${AUR_PKGS[*]}), aber kein AUR-Helper (paru/yay) gefunden."
      warn "Installiere paru: https://github.com/morganamilo/paru#installation"
      warn "Danach: paru -S ${AUR_PKGS[*]}"
      warn "Ohne NSIS ist kein Windows-Cross-Build möglich (Linux/Android-Build funktioniert)."
    fi
  fi
}

install_pkgs_fedora() {
  local PKGS=(
    curl wget git unzip zip
    gcc gcc-c++ make pkg-config openssl-devel
    gtk3-devel
    webkit2gtk4.1-devel
    libayatana-appindicator-gtk3-devel
    librsvg2-devel
    java-17-openjdk-devel
    mingw64-nsis
  )
  info "dnf check-update..."
  $SUDO dnf check-update -q || true
  local MISSING=()
  for pkg in "${PKGS[@]}"; do
    rpm -q "$pkg" &>/dev/null || MISSING+=("$pkg")
  done
  if [ ${#MISSING[@]} -gt 0 ]; then
    info "Installiere: ${MISSING[*]}"
    $SUDO dnf install -y "${MISSING[@]}"
  fi
}

install_pkgs_suse() {
  local PKGS=(
    curl wget git unzip zip
    gcc gcc-c++ make pkg-config libopenssl-devel
    gtk3-devel
    webkit2gtk3-4_1-devel
    libayatana-appindicator3-devel
    librsvg-devel
    java-17-openjdk-devel
    nsis
  )
  info "zypper refresh..."
  $SUDO zypper refresh -q
  local MISSING=()
  for pkg in "${PKGS[@]}"; do
    rpm -q "$pkg" &>/dev/null || MISSING+=("$pkg")
  done
  if [ ${#MISSING[@]} -gt 0 ]; then
    info "Installiere: ${MISSING[*]}"
    $SUDO zypper install -y "${MISSING[@]}"
  fi
}

case "$DISTRO_FAMILY" in
  debian) install_pkgs_debian ;;
  arch)   install_pkgs_arch   ;;
  fedora) install_pkgs_fedora ;;
  suse)   install_pkgs_suse   ;;
esac

ok "System-Pakete installiert"

# ─────────────────────────────────────────────────────────────────────────────
step "Java (OpenJDK $JAVA_MIN+)"

# JAVA_HOME aus installierter Java-Version ableiten
detect_java_home() {
  local java_bin
  java_bin=$(readlink -f "$(which java)" 2>/dev/null) || return 1
  # Pfad ist z.B. /usr/lib/jvm/java-17-openjdk-amd64/bin/java
  echo "$(dirname "$(dirname "$java_bin")")"
}

if command -v java &>/dev/null; then
  JAVA_VER=$(java -version 2>&1 | head -1 | sed 's/.*version "\([0-9]*\).*/\1/')
  if [ -n "$JAVA_VER" ] && [ "$JAVA_VER" -ge "$JAVA_MIN" ] 2>/dev/null; then
    JAVA_HOME_DETECTED=$(detect_java_home)
    export JAVA_HOME="${JAVA_HOME:-$JAVA_HOME_DETECTED}"
    ok "Java $JAVA_VER (JAVA_HOME=$JAVA_HOME)"
  else
    # Auf Debian/Ubuntu update-alternatives nutzen
    if [ "$DISTRO_FAMILY" = "debian" ] && command -v update-alternatives &>/dev/null; then
      JAVA17_PATH=$(update-alternatives --list java 2>/dev/null | grep "java-$JAVA_MIN" | head -1)
      if [ -n "$JAVA17_PATH" ]; then
        $SUDO update-alternatives --set java "$JAVA17_PATH"
        JAVA_HOME_DETECTED=$(detect_java_home)
        export JAVA_HOME="${JAVA_HOME:-$JAVA_HOME_DETECTED}"
        ok "Java auf $JAVA_MIN gesetzt (JAVA_HOME=$JAVA_HOME)"
      fi
    else
      warn "Java-Version $(java -version 2>&1 | head -1) — ggf. zu alt, aber Build-Check entscheidet."
    fi
  fi
else
  fail "Java nicht gefunden. System-Pakete müssen Java installiert haben."
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Node.js $NODE_MAJOR+"

NODE_NEEDS_INSTALL=false
if command -v node &>/dev/null; then
  NODE_INSTALLED=$(node --version | sed 's/v\([0-9]*\).*/\1/')
  if [ "$NODE_INSTALLED" -ge "$NODE_MAJOR" ] 2>/dev/null; then
    ok "Node.js $(node --version) bereits installiert"
  else
    warn "Node.js $(node --version) zu alt (benötigt v$NODE_MAJOR+)"
    NODE_NEEDS_INSTALL=true
  fi
else
  NODE_NEEDS_INSTALL=true
fi

if [ "$NODE_NEEDS_INSTALL" = true ]; then
  case "$DISTRO_FAMILY" in
    debian)
      info "NodeSource-Repository einrichten..."
      curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | ${SUDO:+sudo -E} bash -
      $SUDO apt-get install -y nodejs
      ;;
    arch)
      # Arch-Repos haben meistens aktuelles Node — pacman -S nodejs
      info "Installiere nodejs via pacman..."
      $SUDO pacman -S --noconfirm --needed nodejs npm
      ;;
    fedora)
      info "NodeSource-Repository einrichten (RPM)..."
      curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | ${SUDO:+sudo -E} bash -
      $SUDO dnf install -y nodejs
      ;;
    suse)
      info "NodeSource-Repository einrichten (openSUSE)..."
      curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | ${SUDO:+sudo -E} bash -
      $SUDO zypper install -y nodejs
      ;;
  esac
  ok "Node.js $(node --version) installiert"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "pnpm"

if command -v pnpm &>/dev/null; then
  ok "pnpm $(pnpm --version) bereits installiert"
else
  info "Installiere pnpm..."
  # corepack ist in Node.js 16+ enthalten und ist die sauberste Methode
  if command -v corepack &>/dev/null; then
    $SUDO corepack enable
    corepack prepare pnpm@latest --activate
  else
    $SUDO npm install -g pnpm
  fi
  ok "pnpm $(pnpm --version) installiert"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Rust + Cargo"

if command -v rustup &>/dev/null; then
  ok "Rust bereits installiert: $(rustc --version)"
  rustup update stable --no-self-update
else
  info "Installiere Rust via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
  ok "Rust installiert"
fi

# Rust-Toolchain in aktuelle Shell-Session laden
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
export PATH="$HOME/.cargo/bin:$PATH"
ok "Rust: $(rustc --version)"

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

if cargo xwin --version &>/dev/null 2>&1 || command -v cargo-xwin &>/dev/null; then
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
  INSTALLED_CHECK=$(echo "$PKG" | sed 's/;/ /')
  if sdkmanager --list_installed 2>/dev/null | grep -q "$INSTALLED_CHECK"; then
    ok "$PKG"
  else
    info "Installiere $PKG..."
    sdkmanager "$PKG"
    ok "$PKG"
  fi
done

export NDK_HOME="$ANDROID_HOME/ndk/$NDK_VERSION"

# ─────────────────────────────────────────────────────────────────────────────
step "Shell-Profil aktualisieren"

PROFILE_BLOCK="
# ── JL-Manager Build-Umgebung ─────────────────────────────────────────────
export JAVA_HOME=\"$JAVA_HOME\"
export ANDROID_HOME=\"$ANDROID_HOME\"
export NDK_HOME=\"\$ANDROID_HOME/ndk/$NDK_VERSION\"
export PATH=\"\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$HOME/.cargo/bin:\$PATH\"
# ─────────────────────────────────────────────────────────────────────────"

PROFILES_UPDATED=()
for PROFILE in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
  if [ -f "$PROFILE" ]; then
    if grep -q "JL-Manager Build-Umgebung" "$PROFILE"; then
      ok "$PROFILE bereits konfiguriert"
    else
      echo "$PROFILE_BLOCK" >> "$PROFILE"
      PROFILES_UPDATED+=("$PROFILE")
      ok "$PROFILE aktualisiert"
    fi
  fi
done

# fish shell
FISH_CONF="$HOME/.config/fish/conf.d/jl-manager.fish"
if command -v fish &>/dev/null && [ ! -f "$FISH_CONF" ]; then
  mkdir -p "$(dirname "$FISH_CONF")"
  cat > "$FISH_CONF" << EOF
# JL-Manager Build-Umgebung
set -gx JAVA_HOME "$JAVA_HOME"
set -gx ANDROID_HOME "$ANDROID_HOME"
set -gx NDK_HOME "\$ANDROID_HOME/ndk/$NDK_VERSION"
fish_add_path "\$ANDROID_HOME/cmdline-tools/latest/bin" "\$ANDROID_HOME/platform-tools" "\$HOME/.cargo/bin"
EOF
  ok "$FISH_CONF erstellt"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "npm-Abhängigkeiten installieren"

cd "$SCRIPT_DIR"
mkdir -p JL-Manager/src
info "Root-Paket..."
pnpm install

info "JL-Manager-Paket..."
cd "$SCRIPT_DIR/JL-Manager" && pnpm install && cd "$SCRIPT_DIR"

ok "Alle npm-Abhängigkeiten installiert"

# ─────────────────────────────────────────────────────────────────────────────
step ".env einrichten"

if [ -f "$SCRIPT_DIR/.env" ]; then
  ok ".env existiert bereits — wird nicht überschrieben"
else
  cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
  warn ".env aus .env.example erstellt — Werte eintragen:"
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

  if [ "$AUTO" = true ]; then
    warn "--auto: Keystore-Erstellung übersprungen. $KEYSTORE vor dem ersten Build ablegen."
    KS_CHOICE="2"
  else
    echo ""
    echo "    [1] Jetzt neu erstellen (empfohlen)"
    echo "    [2] Überspringen (Keystore später manuell ablegen)"
    echo ""
    printf "  Auswahl [1/2]: "
    read -r KS_CHOICE
  fi

  if [ "$KS_CHOICE" = "1" ]; then
    echo ""
    info "Erstelle Keystore — du wirst nach Passwörtern und Zertifikats-Infos gefragt."
    echo ""
    keytool -genkey -v \
      -keystore "$KEYSTORE" \
      -alias jl-manager \
      -keyalg RSA \
      -keysize 2048 \
      -validity 10000
    ok "Keystore erstellt: $KEYSTORE"
    echo ""
    warn "Passwörter in .env eintragen:"
    info "  KEYSTORE_PASSWORD=<keystore-passwort>"
    info "  KEY_PASSWORD=<key-passwort>"
    info "  → nano $SCRIPT_DIR/.env"
    warn "Keystore sichern! Ohne ihn sind keine signierten Releases möglich."
  else
    warn "Keystore übersprungen. $KEYSTORE vor dem ersten Build ablegen."
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Setup abgeschlossen!                           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Distribution: $DISTRO_NAME"
echo "  Rust:         $(rustc --version 2>/dev/null || echo 'n/a')"
echo "  Node.js:      $(node --version 2>/dev/null || echo 'n/a')"
echo "  Java:         $(java -version 2>&1 | head -1)"
echo ""
echo "  Nächste Schritte:"
echo ""
echo "  1. Neue Shell öffnen (oder: source ~/.bashrc) damit PATH greift"
echo ""
echo "  2. .env befüllen:"
echo "       nano $SCRIPT_DIR/.env"
echo ""
echo "  3. Entwicklung starten:"
echo "       cd JL-Manager && pnpm run dev    # reines Web-Dev (kein Tauri)"
echo "       ./test_run.sh                    # Tauri Desktop/Android live"
echo ""
echo "  4. Production-Build:"
echo "       ./build.sh            # Linux + Windows + Android"
echo "       ./android_build.sh    # nur Android"
echo "       ./linux_build.sh      # nur Linux + Windows"
echo ""
