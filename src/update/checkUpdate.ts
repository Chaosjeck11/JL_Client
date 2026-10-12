import { version as APP_VERSION } from '../../package.json';
import { getApiUrl, apiFetch } from '../api/client';

const PLATFORM_MAP: Record<string, string> = {
  linux: 'linux',
  windows: 'windows',
  android: 'android',
};

export interface UpdateInfo {
  latestVersion: string;
  platform: string;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!('__TAURI_INTERNALS__' in window)) return null;

  let platform: string;
  try {
    const { platform: getPlatform } = await import('@tauri-apps/plugin-os');
    platform = await getPlatform();
  } catch {
    return null;
  }

  const mappedPlatform = PLATFORM_MAP[platform];
  if (!mappedPlatform) return null;

  try {
    const result = await apiFetch(
      `/update/check?version=${encodeURIComponent(APP_VERSION)}&platform=${mappedPlatform}`
    );
    if (!result?.updateAvailable) return null;
    return { latestVersion: result.latestVersion, platform: mappedPlatform };
  } catch {
    return null;
  }
}

export async function downloadUpdate(
  info: UpdateInfo,
  onLog: (msg: string) => void,
  onProgress: (pct: number) => void
): Promise<void> {
  const { latestVersion, platform } = info;

  const ext =
    platform === 'windows' ? 'exe' : platform === 'android' ? 'apk' : 'AppImage';
  const filename = `jl-manager-${latestVersion}.${ext}`;
  const downloadUrl = `${getApiUrl()}/update/download?platform=${platform}`;
  const token = localStorage.getItem('token') ?? '';

  onLog(`Verbinde mit Server…`);
  onLog(`URL: ${downloadUrl}`);
  onLog(`Dateiname: ${filename}`);

  const { invoke } = await import('@tauri-apps/api/core');

  if (platform === 'android') {
    // Android: download via WebView fetch, not the Rust `download_file` command.
    // reqwest's rustls-platform-verifier is never initialised on Android (no JNI
    // init, no Kotlin component) → TLS handshake panics inside the async command,
    // the invoke promise never settles and progress sits at 0% forever.
    // fetch uses the Android network stack and honours network_security_config.
    const res = await fetch(downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok || !res.body) throw new Error(`Server antwortete mit HTTP ${res.status}`);

    const total = Number(res.headers.get('Content-Length')) || 0;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    let lastLoggedMb = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total > 0) {
        onProgress(Math.min(99, Math.floor((received / total) * 100)));
      } else if (received / 1024 / 1024 - lastLoggedMb >= 0.5) {
        lastLoggedMb = received / 1024 / 1024;
        onLog(`${lastLoggedMb.toFixed(1)} MB heruntergeladen (Gesamtgröße unbekannt)…`);
      }
    }
    const data = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) {
      data.set(c, offset);
      offset += c.length;
    }
    onProgress(100);

    // App cache dir: always writable, no storage permission, covered by
    // FileProvider <cache-path> so the installer can read it.
    const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const { cacheDir, join } = await import('@tauri-apps/api/path');
    onLog('Speichere APK…');
    await writeFile(filename, data, { baseDir: BaseDirectory.Cache });
    const apkPath = await join(await cacheDir(), filename);

    onLog('Starte APK-Installation…');
    onLog(`APK-Pfad: ${apkPath}`);
    await invoke('plugin:install|install_apk', { path: apkPath });
    onLog('Installation gestartet. Bitte Installationsaufforderung bestätigen.');
    return;
  }

  const { listen } = await import('@tauri-apps/api/event');

  let lastLoggedMb = 0;
  const unlisten = await listen<{ received: number; total: number }>('download-progress', (event) => {
    const { received, total } = event.payload;
    if (total > 0) {
      onProgress(Math.min(99, Math.floor((received / total) * 100)));
    } else {
      const mb = received / 1024 / 1024;
      if (mb - lastLoggedMb >= 0.5) {
        lastLoggedMb = mb;
        onLog(`${mb.toFixed(1)} MB heruntergeladen (Gesamtgröße unbekannt)…`);
      }
    }
  });

  let filePath: string;
  try {
    filePath = await invoke<string>('download_file', {
      url: downloadUrl,
      filename,
      headers: token ? [['Authorization', `Bearer ${token}`]] : [],
    });
  } finally {
    unlisten();
  }
  onProgress(100);

  onLog(`Öffne Installer…`);

  if (platform === 'linux') {
    await invoke('launch_appimage', { path: filePath });
  } else {
    const { openPath } = await import('@tauri-apps/plugin-opener');
    await openPath(filePath);
  }
  onLog(`Fertig. Installer geöffnet.`);
}

/** Legacy wrapper — called from App.tsx, now delegates to modal via state */
export async function checkAndUpdate(): Promise<UpdateInfo | null> {
  return checkForUpdate();
}
