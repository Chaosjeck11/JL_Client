type Props = {
  filename: string;
  url: string;
  mimeType: string;
  onDownload: () => void;
  onClose: () => void;
};

function getPreviewType(filename: string, mimeType: string): "pdf" | "image" | "none" {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  return "none";
}

export default function AttachmentViewer({ filename, url, mimeType, onDownload, onClose }: Props) {
  const type = getPreviewType(filename, mimeType);

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, width: "min(600px, 50vw)", height: "100vh",
      background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
      display: "flex", flexDirection: "column", zIndex: 1000,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
        borderBottom: "1px solid #e2e8f0", flexShrink: 0,
      }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {filename}
        </span>
        <button
          onClick={onDownload}
          title="Herunterladen"
          style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #d1d5db", background: "#f8fafc", fontSize: 12, cursor: "pointer" }}
        >
          ↓ Download
        </button>
        <button
          onClick={onClose}
          title="Schließen"
          style={{ padding: "4px 10px", borderRadius: 5, border: "none", background: "none", fontSize: 16, cursor: "pointer", color: "#64748b" }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        {type === "pdf" && (
          <iframe src={url} style={{ width: "100%", height: "100%", border: "none" }} title={filename} />
        )}
        {type === "image" && (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", background: "#f8fafc" }}>
            <img src={url} alt={filename} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </div>
        )}
        {type === "none" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "#64748b" }}>
            <span style={{ fontSize: 40 }}>📎</span>
            <span style={{ fontSize: 14 }}>Keine Vorschau verfügbar</span>
            <button
              onClick={onDownload}
              style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, cursor: "pointer" }}
            >
              Herunterladen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
