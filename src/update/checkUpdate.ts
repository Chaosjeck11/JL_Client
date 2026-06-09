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

  const downloadUrl = `${getApiUrl()}/update/download?platform=${platform}`;
  const token = localStorage.getItem('token');

  onLog(`Verbinde mit Server…`);
  onLog(`URL: ${downloadUrl}`);

  const res = await fetch(downloadUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) throw new Error(`Server antwortete mit HTTP ${res.status}`);

  const disposition = res.headers.get('content-disposition') ?? '';
  const fnMatch = disposition.match(/filename="?([^";\n]+)"?/i);
  const filename = fnMatch?.[1] ?? `jl-manager-${latestVersion}.${ext}`;
  onLog(`Dateiname: ${filename}`);

  const contentLength = Number(res.headers.get('content-length') ?? '0');
  if (contentLength > 0) {
    const mb = (contentLength / 1024 / 1024).toFixed(1);
    onLog(`Dateigröße: ${mb} MB`);
  } else {
    onLog(`Dateigröße: unbekannt`);
  }

  onLog(`Download gestartet…`);

  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (contentLength > 0) {
      const pct = Math.round((received / contentLength) * 100);
      onProgress(pct);
    } else {
      const mbRecv = (received / 1024 / 1024).toFixed(1);
      onLog(`Empfangen: ${mbRecv} MB`);
    }
  }

  onProgress(100);
  onLog(`Download abgeschlossen (${(received / 1024 / 1024).toFixed(1)} MB).`);
  onLog(`Schreibe Datei in Downloads-Ordner…`);

  const uint8 = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    uint8.set(chunk, offset);
    offset += chunk.length;
  }

  const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  await writeFile(filename, uint8, { baseDir: BaseDirectory.Download });
  onLog(`Datei gespeichert: ${filename}`);

  onLog(`Öffne Installer…`);
  const { downloadDir } = await import('@tauri-apps/api/path');
  const { invoke } = await import('@tauri-apps/api/core');
  const dir = await downloadDir();
  const filePath = `${dir}/${filename}`;
  if (platform === 'linux') {
    await invoke('launch_appimage', { path: filePath });
  } else if (platform === 'android') {
    onLog('Starte APK-Installation…');
    onLog(`APK-Pfad: ${filePath}`);
    const installLog: string[] = [
      `${new Date().toISOString()} APK-Pfad: ${filePath}`,
      `${new Date().toISOString()} invoke plugin:install|installApk …`,
    ];
    try {
      await invoke('plugin:install|installApk', { path: filePath });
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
