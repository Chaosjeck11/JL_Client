#!/usr/bin/env bash
#
# init.sh — Setup / Bootstrap für JL_Client (Tauri + React)
#
# Prüft und installiert alle Build-Abhängigkeiten:
#   Node/pnpm, Rust + Targets, cargo-xwin, NSIS, Java,
#   Android SDK/NDK, Keystore, Linux-Systemlibs.
# Danach: pnpm install (root + JL-Manager).
#
# Idempotent: alles was schon da ist, wird übersprungen.
# Env-Vars werden nach ~/.bashrc geschrieben (nur wenn noch nicht drin).

set -euo pipefail

# ---------- Config (bei Bedarf anpassen) ----------
NDK_VERSION="27.1.12297006"
ANDROID_API="android-34"
BUILD_TOOLS="34.0.0"
JAVA_PKG="openjdk-17-jdk"
JAVA_HOME_PATH="/usr/lib/jvm/java-17-openjdk-amd64"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export NDK_HOME="${NDK_HOME:-$ANDROID_HOME/ndk/$NDK_VERSION}"
KEYSTORE="$(pwd)/jl-manager.keystore"
KEYSTORE_ALIAS="jl-manager"

RUST_ANDROID_TARGETS=(aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android)
RUST_WIN_TARGET="x86_64-pc-windows-msvc"

# ---------- Helpers ----------
c_ok()   { printf '  \033[32mOK\033[0m     %s\n' "$1"; }
c_add()  { printf '  \033[33m==>\033[0m    %s\n' "$1"; }
c_skip() { printf '  \033[90mSKIP\033[0m   %s\n' "$1"; }
section(){ printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }
have()   { command -v "$1" >/dev/null 2>&1; }

# Fragt y/N, default N. AUTO_YES=1 überspringt Rückfragen.
ask() {
  [ "${AUTO_YES:-0}" = "1" ] && return 0
  read -r -p "  $1 [y/N] " a
  [[ "$a" =~ ^[YyJj]$ ]]
}

# Fügt eine export-Zeile idempotent in ~/.bashrc ein.
persist_env() {
  local line="$1"
  grep -qxF "$line" "$HOME/.bashrc" 2>/dev/null || {
    echo "$line" >> "$HOME/.bashrc"
    c_add "in ~/.bashrc: $line"
  }
}

# ---------- 0. Node ----------
section "NODE / PNPM"
if ! have node; then
  echo "  Node fehlt. Installiere via apt..."
  sudo apt update && sudo apt install -y nodejs
fi
c_ok "node $(node -v)"

if ! have pnpm; then
  c_add "pnpm fehlt — standalone Installer (get.pnpm.io)"
  curl -fsSL https://get.pnpm.io/install.sh | sh -
  # pnpm-Pfad für diesen Lauf verfügbar machen
  export PNPM_HOME="$HOME/.local/share/pnpm"
  export PATH="$PNPM_HOME:$PATH"
fi
have pnpm && c_ok "pnpm $(pnpm -v)" || { echo "  pnpm-Install fehlgeschlagen. Neues Terminal öffnen und Script erneut."; exit 1; }

# ---------- 1. Rust ----------
section "RUST"
if ! have rustup; then
  c_add "rustup Installer (sh.rustup.rs)"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi
# cargo env für diesen Lauf
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
have cargo && c_ok "cargo $(cargo --version | awk '{print $2}')" || { echo "  Rust nicht gefunden."; exit 1; }

# Targets
installed_targets="$(rustup target list --installed 2>/dev/null || true)"
for t in "${RUST_ANDROID_TARGETS[@]}" "$RUST_WIN_TARGET"; do
  if grep -qx "$t" <<<"$installed_targets"; then
    c_skip "target $t"
  else
    c_add "target $t"
    rustup target add "$t"
  fi
done

# cargo-xwin (Windows-Cross)
if have cargo-xwin; then
  c_skip "cargo-xwin"
else
  c_add "cargo install cargo-xwin"
  cargo install cargo-xwin
fi

# ---------- 2. Linux-Systemlibs (Tauri) ----------
section "LINUX SYSTEM LIBS"
LIBS=(libglib2.0-dev libgtk-3-dev libwebkit2gtk-4.1-dev librsvg2-dev libssl-dev pkg-config build-essential)
missing_libs=()
for p in "${LIBS[@]}"; do
  dpkg -s "$p" >/dev/null 2>&1 && c_skip "$p" || missing_libs+=("$p")
done
if [ ${#missing_libs[@]} -gt 0 ]; then
  c_add "apt install: ${missing_libs[*]}"
  sudo apt install -y "${missing_libs[@]}"
fi

# ---------- 3. NSIS (Windows-Installer) ----------
section "NSIS"
if have makensis; then
  c_skip "makensis"
else
  c_add "apt install nsis"
  sudo apt install -y nsis
fi

# ---------- 4. Java ----------
section "JAVA"
if have javac && dpkg -s "$JAVA_PKG" >/dev/null 2>&1; then
  c_skip "$JAVA_PKG"
else
  c_add "apt install $JAVA_PKG"
  sudo apt install -y "$JAVA_PKG"
fi
export JAVA_HOME="$JAVA_HOME_PATH"
persist_env "export JAVA_HOME=$JAVA_HOME_PATH"

# ---------- 5. Android SDK / NDK ----------
section "ANDROID SDK / NDK"
if ! have sdkmanager; then
  c_add "apt install google-android-cmdline-tools-13.0-installer"
  sudo apt install -y google-android-cmdline-tools-13.0-installer
fi
mkdir -p "$ANDROID_HOME"
c_add "sdkmanager: platform-tools, $ANDROID_API, build-tools $BUILD_TOOLS, ndk $NDK_VERSION"
yes | sdkmanager --sdk_root="$ANDROID_HOME" \
  "platform-tools" \
  "platforms;$ANDROID_API" \
  "build-tools;$BUILD_TOOLS" \
  "ndk;$NDK_VERSION" || true
persist_env "export ANDROID_HOME=$ANDROID_HOME"
persist_env "export NDK_HOME=$NDK_HOME"

# ---------- 6. Keystore ----------
section "KEYSTORE"
if [ -f "$KEYSTORE" ]; then
  c_skip "$KEYSTORE vorhanden"
else
  if ask "Keystore erzeugen? (interaktiv, fragt nach Passwörtern)"; then
    keytool -genkey -v -keystore "$KEYSTORE" -alias "$KEYSTORE_ALIAS" \
      -keyalg RSA -keysize 2048 -validity 10000
    c_ok "Keystore erstellt: $KEYSTORE"
  else
    c_skip "Keystore übersprungen (Android-Signierung geht dann nicht)"
  fi
fi

# ---------- 7. pnpm install ----------
section "DEPENDENCIES"
c_add "pnpm install (root)"
pnpm install
c_add "pnpm install (JL-Manager)"
( cd JL-Manager && pnpm install )

# ---------- Done ----------
section "FERTIG"
echo "  Neues Terminal öffnen (oder: source ~/.bashrc), dann:"
echo "    ./linux_build.sh"
