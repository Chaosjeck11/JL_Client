# JL-Manager

Vereinsverwaltung für Jugendlager-Gruppen. React 19 + TypeScript SPA (Vite), verpackt als Tauri-Desktop/Android-App und als Progressive Web App (PWA) nutzbar.

**Features:** Mitgliederverwaltung · Kassenbuch · Mitgliedsbeiträge · Strafen · Dateiverwaltung · Veranstaltungen · Kalender · Bierliste

---

## Schnellstart — frischer Linux-Rechner (Debian/Ubuntu)

```bash
git clone https://github.com/Chaosjeck11/JL_Client.git
cd JL_Client
./init.sh
```

Das Script erkennt die Distribution automatisch und installiert und konfiguriert alles, was zum Bauen aller Plattformen benötigt wird:

- Node.js 22 + pnpm
- Rust + Cargo (via rustup)
- Alle Rust-Targets (Android × 4 + Windows)
- cargo-xwin (Windows-Cross-Compile)
- NSIS (Windows-Installer-Generator)
- OpenJDK 17
- Android SDK (Command-Line Tools, Build-Tools, Platform 35)
- Android NDK 27
- npm-Abhängigkeiten (root + JL-Manager)
- `.env` aus `.env.example` vorausfüllen
- Android-Keystore optional direkt erstellen

**Unterstützte Distributionen:**

| Familie | Beispiele |
|---|---|
| Debian/Ubuntu | Ubuntu, Linux Mint, Pop!\_OS, Kali, Raspberry Pi OS |
| Arch Linux | CachyOS, Manjaro, EndeavourOS, Garuda, ArcoLinux |
| Fedora/RHEL | Fedora, Nobara, AlmaLinux, Rocky Linux, CentOS Stream |
| openSUSE | Tumbleweed, Leap |

**Nach dem Script:** neue Shell öffnen (oder `source ~/.bashrc`), `.env` befüllen, fertig.

> Das Script ist idempotent — mehrfaches Ausführen schadet nicht. `sudo`-Rechte werden benötigt.

---

## Manuelle Einrichtung (Schritt für Schritt)

Nur nötig, wenn `init.sh` nicht verwendet werden soll oder kein Debian/Ubuntu vorliegt.

### Voraussetzungen installieren

| Tool | Mindestversion | Zweck |
|---|---|---|
| Node.js | 22 | Frontend-Build |
| pnpm | aktuell | Paketmanager |
| Rust + Cargo | stable | Tauri Desktop/Android |
| OpenJDK | 17 | Android-Build |
| Android SDK | API 35 | Android-Build |
| Android NDK | 27.0.12077973 | Android-Build |
| cargo-xwin | aktuell | Windows-Cross-Compile |
| NSIS / makensis | aktuell | Windows-Installer |

Rust-Targets hinzufügen:
```bash
rustup target add \
  aarch64-linux-android \
  armv7-linux-androideabi \
  i686-linux-android \
  x86_64-linux-android \
  x86_64-pc-windows-msvc
```

Umgebungsvariablen setzen (in `~/.bashrc` / `~/.zshrc` eintragen):
```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=$HOME/android-sdk
export NDK_HOME=$ANDROID_HOME/ndk/27.0.12077973
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$HOME/.cargo/bin:$PATH"
```

### Repository klonen + Dependencies installieren

```bash
git clone https://github.com/Chaosjeck11/JL_Client.git
cd JL_Client

pnpm install
cd JL-Manager && pnpm install && cd ..
```

### `.env` anlegen

```bash
cp .env.example .env
nano .env          # Werte eintragen
```

```env
# ── Deploy-Server ─────────────────────────────────────────────────────────────
SERVER_USER=ben                              # SSH-User auf dem Deploy-Server
SERVER_HOST=100.x.x.x                       # Tailscale-IP oder Hostname
SERVER_PATH=/mnt/docker/JL_Backend/Builds   # Zielpfad auf dem Server

# ── Android Keystore ──────────────────────────────────────────────────────────
KEYSTORE_PASSWORD=dein_keystore_passwort
KEY_PASSWORD=dein_key_passwort

# ── Frontend (Vite) ───────────────────────────────────────────────────────────
# Wird im Login-Screen als vorausgefüllte Server-Adresse angezeigt.
# Leer lassen → Nutzer trägt die URL selbst ein.
VITE_API_BASE_URL=https://deine-backend-domain.de
```

> Die `.env`-Datei ist in `.gitignore` und wird nie committed.
> Den Android-Keystore (`jl-manager.keystore`) ebenfalls nur lokal ablegen.

### Android-Keystore erstellen (einmalig)

```bash
keytool -genkey -v \
  -keystore jl-manager.keystore \
  -alias jl-manager \
  -keyalg RSA -keysize 2048 -validity 10000
```

Die gewählten Passwörter in `.env` als `KEYSTORE_PASSWORD` und `KEY_PASSWORD` eintragen.

---

## Entwicklung

### Web-Dev (ohne Tauri, schnellster Einstieg)

```bash
cd JL-Manager
pnpm run dev
# → http://localhost:5173
```

### Tauri Desktop (Live-Reload)

```bash
# Sync src/ → JL-Manager/src/, dann tauri dev starten:
./test_run.sh
```

> Alle Quelldateien liegen in `src/` im Repo-Root.  
> `JL-Manager/src/` wird bei jedem `test_run.sh`-Aufruf überschrieben — dort **nie** direkt editieren.

### Android (Live-Reload)

```bash
./test_run.sh   # startet tauri dev mit Android-Target, wenn verbundenes Gerät erkannt wird
```

---

## Linting & Type-Check

```bash
cd JL-Manager
pnpm run lint      # ESLint
pnpm run build     # tsc -b + vite build (Type-Check + Production-Bundle)
```

---

## Production-Build

### Alle Plattformen (Linux + Windows + Android)

```bash
# Benötigt: SERVER_USER, SERVER_HOST, SERVER_PATH, KEYSTORE_PASSWORD, KEY_PASSWORD in .env
./build.sh
```

Das Script:
1. Fragt nach Release-Typ (Major / Minor / Patch)
2. Bumpt die Version in `tauri.conf.json` + `package.json`
3. Baut Linux (AppImage + .deb), Windows (NSIS-Installer) und Android (APK)
4. Legt alles unter `Builds/<version>/` ab
5. Fragt ob auf den Server deployt werden soll (via SSH/SCP)

### Nur Android

```bash
./android_build.sh
```

### Nur Linux + Windows

```bash
./linux_build.sh
```

---

## Installation (Endnutzer)

### Linux

Im Release-Archiv liegt ein `install.sh`:

```bash
cd Builds/<version>/linux
./install.sh
# Installiert AppImage nach /usr/local/bin/jl-manager + Desktop-Eintrag
```

### Windows

`Builds/<version>/windows/*.exe` ausführen (NSIS-Installer).

### Android

`Builds/<version>/android/*.apk` auf dem Gerät installieren (Sideloading, USB-Debugging).

### PWA (Browser)

Die App kann im Browser unter der Backend-URL als PWA installiert werden (Chrome/Safari → "Zum Homescreen hinzufügen"). Service Worker und Manifest sind in `public/` hinterlegt.

---

## Verzeichnisstruktur

```
JL_Client/
├── src/                  ← Quellcode (hier editieren!)
│   ├── api/              ← API-Client und Endpunkt-Module
│   ├── auth/             ← JWT-Handling, Permissions
│   ├── components/       ← Geteilte UI-Komponenten
│   ├── hooks/            ← Custom React Hooks
│   ├── screens/          ← Bildschirm-Komponenten
│   ├── styles/           ← Globale CSS
│   └── types/            ← TypeScript-Typen
├── public/               ← PWA-Assets (manifest.json, sw.js, Icons)
├── JL-Manager/           ← Tauri-Subprojekt (Build-Artefakt, nicht editieren)
├── build.sh              ← Multi-Plattform-Release-Build
├── android_build.sh      ← Android-Only-Build
├── linux_build.sh        ← Linux+Windows-Build
├── test_run.sh           ← Entwicklungs-Start (sync + tauri dev)
├── .env.example          ← Vorlage für .env
└── CLAUDE.md             ← Architektur-Dokumentation (für Claude Code)
```

---

## Zugriffslevels

| Level | Rolle | Rechte (Kurzfassung) |
|---|---|---|
| L0 | Mitglied | Eigene Strafen lesen, Bierliste buchen |
| L1 | Strafenwart | Strafenkatalog + alle Einträge verwalten |
| L2 | Orgateam | Mitglieder lesen, Veranstaltungen schreiben |
| L3 | Vorstand | Mitglieder schreiben, Finanzen lesen, Bierliste Admin |
| L4 | Kassenwart | Finanzen schreiben, Beiträge bezahlen |
| L5 | Admin | Vollzugriff inkl. Anhänge, Formular-Template |

---

## Bierliste

Getränkeverwaltung und Schuldenbuch für den Vereinskühlschrank. Integriert in die App unter dem Tab **Bierliste** (🍺).

### Subtabs

| Tab | Sichtbar für | Funktion |
|---|---|---|
| Home | Alle | Eigener Saldo + offener Betrag, Getränke buchen (+1/−1), PayPal-Bezahlbutton, persönlicher Score |
| Kühlschrank | Alle | Bestandsübersicht inkl. Niedrig-/Kritisch-Warnungen |
| Score | Alle | Gesamt-Scoreboard aller Mitglieder, sortierbar, Drinkauswahl via Dropdown |
| Kasse | Admins (L3+) | Bierliste-Kassenstand, manuelle Buchungen (IN/OUT/CORRECTION) |
| Admin | Admins (L3+) | Salden-Übersicht, Abrechnungen, Getränke verwalten, Kühlschrank befüllen (Einzeln/Kasten), Bestandswarnungen konfigurieren |

### Spam-Schutz

Die Buchungs-Buttons (+1/−1) sind durch einen **synchronen Ref-Lock** (`useRef<Set<number>>`) gegen Doppelklicks geschützt. Nach einer erfolgreichen Buchung bleibt der Button für 800 ms gesperrt (visuell: `disabled` + gedimmt). Bei einem API-Fehler wird die Sperre sofort aufgehoben, damit ein Retry möglich ist.

### Konfiguration

- **PayPal-Link**: Admins können unter Home → ⚙ einen `https://paypal.me/...`-Link hinterlegen (gespeichert in `localStorage('bierliste_paypal_link')`). Der Betrag wird automatisch an die URL angehängt.
- **Bestandswarnungen**: Pro Getränk togglebar, gespeichert in `localStorage('bierliste_warn_off_<drinkId>')`. Schwellenwerte: < 10 = Gelb, < 5 = Rot.
- **Bierliste-Admin-Level**: Konfigurierbar per `BIERLISTE_ADMIN_MIN_LEVEL` im Backend (Standard: L3).

### API-Modul

`src/api/bierliste.ts` — alle `/bierliste/*`-Endpunkte. Typen in `src/types/bierliste.ts`.
