export async function triggerDownload(filename: string, blob: Blob): Promise<void> {
  if ('__TAURI_INTERNALS__' in window) {
    try {
      const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      const arrayBuffer = await blob.arrayBuffer();
      await writeFile(filename, new Uint8Array(arrayBuffer), { baseDir: BaseDirectory.Download });
      window.alert(`Gespeichert in Downloads:\n${filename}`);
    } catch (e) {
      window.alert(`Export fehlgeschlagen: ${e}`);
    }
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
