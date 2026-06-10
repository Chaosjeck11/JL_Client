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
  const { listen } = await import('@tauri-apps/api/event');

  const unlisten = await listen<{ received: number; total: number }>('download-progress', (event) => {
    const { received, total } = event.payload;
    if (total > 0) {
      onProgress(Math.min(99, Math.floor((received / total) * 100)));
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
  } else if (platform === 'android') {
    onLog('Starte APK-Installation…');
    onLog(`APK-Pfad: ${filePath}`);
    const installLog: string[] = [
      `${new Date().toISOString()} APK-Pfad: ${filePath}`,
      `${new Date().toISOString()} invoke plugin:install|install_apk …`,
    ];
    const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    try {
      await invoke('plugin:install|install_apk', { path: filePath });
      installLog.push(`${new Date().toISOString()} invoke OK`);
      onLog('Installation gestartet. Bitte Installationsaufforderung bestätigen.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      installLog.push(`${new Date().toISOString()} invoke FEHLER: ${msg}`);
      onLog(`Fehler: ${msg}`);
      throw e;
    } finally {
      const logText = new TextEncoder().encode(installLog.join('\n') + '\n');
      await writeFile('jl-install.log', logText, { baseDir: BaseDirectory.Download }).catch(() => {});
      onLog('Log gespeichert: Downloads/jl-install.log');
    }
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
