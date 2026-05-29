import { version as APP_VERSION } from '../../package.json';
import { getApiUrl, apiFetch } from '../api/client';

const PLATFORM_MAP: Record<string, string> = {
  linux: 'linux',
  windows: 'windows',
  android: 'android',
};

interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion: string;
}

export async function checkAndUpdate(): Promise<void> {
  if (!('__TAURI_INTERNALS__' in window)) return;

  let platform: string;
  try {
    const { platform: getPlatform } = await import('@tauri-apps/plugin-os');
    platform = await getPlatform();
  } catch {
    return;
  }

  const mappedPlatform = PLATFORM_MAP[platform];
  if (!mappedPlatform) return;

  let result: UpdateCheckResult;
  try {
    result = await apiFetch(
      `/update/check?version=${encodeURIComponent(APP_VERSION)}&platform=${mappedPlatform}`
    );
  } catch {
    return;
  }

  if (!result?.updateAvailable) return;

  const confirmed = window.confirm(
    `Version ${result.latestVersion} ist verfügbar. Jetzt herunterladen?`
  );
  if (!confirmed) return;

  try {
    const token = localStorage.getItem('token');
    const downloadUrl = `${getApiUrl()}/update/download?platform=${mappedPlatform}`;
    const res = await fetch(downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;

    const arrayBuffer = await res.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const ext =
      mappedPlatform === 'windows'
        ? 'exe'
        : mappedPlatform === 'android'
          ? 'apk'
          : 'AppImage';
    const disposition = res.headers.get('content-disposition') ?? '';
    const fnMatch = disposition.match(/filename="?([^";\n]+)"?/i);
    const filename = fnMatch?.[1] ?? `jl-manager-${result.latestVersion}.${ext}`;

    const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    await writeFile(filename, uint8, { baseDir: BaseDirectory.Download });

    const { downloadDir } = await import('@tauri-apps/api/path');
    const { openPath } = await import('@tauri-apps/plugin-opener');
    const dir = await downloadDir();
    await openPath(`${dir}/${filename}`);
  } catch (e) {
    console.error('Update download failed:', e);
    window.alert('Download fehlgeschlagen. Bitte manuell aktualisieren.');
  }
}
