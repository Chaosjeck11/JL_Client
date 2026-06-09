import { useEffect, useRef, useState } from 'react';
import { downloadUpdate, UpdateInfo } from './checkUpdate';

interface Props {
  info: UpdateInfo;
  onClose: () => void;
}

type Phase = 'confirm' | 'downloading' | 'done' | 'error';

export function UpdateModal({ info, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('confirm');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString('de-DE', { hour12: false });
    setLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  };

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleStart = async () => {
    setPhase('downloading');
    setProgress(0);
    setLogs([]);
    try {
      await downloadUpdate(info, addLog, setProgress);
      setPhase('done');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`FEHLER: ${msg}`);
      setErrorMsg(msg);
      setPhase('error');
    }
  };

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  };

  const modal: React.CSSProperties = {
    background: 'var(--bg, #fff)',
    border: '1px solid var(--border, #e2e8f0)',
    borderRadius: 12,
    padding: '28px 32px',
    width: 520,
    maxWidth: '95vw',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  };

  const terminal: React.CSSProperties = {
    background: '#0d1117',
    color: '#c9d1d9',
    fontFamily: 'monospace',
    fontSize: 12,
    borderRadius: 8,
    padding: '10px 12px',
    height: 200,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    lineHeight: 1.6,
  };

  const progressTrack: React.CSSProperties = {
    background: '#e2e8f0',
    borderRadius: 99,
    height: 10,
    overflow: 'hidden',
  };

  const progressFill: React.CSSProperties = {
    background: progress === 100 ? '#22c55e' : '#3b82f6',
    width: `${progress}%`,
    height: '100%',
    borderRadius: 99,
    transition: 'width 0.2s ease',
  };

  const btnPrimary: React.CSSProperties = {
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 14,
  };

  const btnSecondary: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--text-muted, #64748b)',
    border: '1px solid var(--border, #e2e8f0)',
    borderRadius: 8,
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: 14,
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && phase !== 'downloading' && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>
            {phase === 'done' ? '✅' : phase === 'error' ? '❌' : '🔄'}
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {phase === 'confirm' && `Update verfügbar — v${info.latestVersion}`}
              {phase === 'downloading' && 'Download läuft…'}
              {phase === 'done' && 'Update heruntergeladen'}
              {phase === 'error' && 'Download fehlgeschlagen'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
              {phase === 'confirm' && `Plattform: ${info.platform}`}
              {phase === 'downloading' && `${progress}% abgeschlossen`}
              {phase === 'done' && 'Installer wurde geöffnet.'}
              {phase === 'error' && errorMsg}
            </div>
          </div>
        </div>

        {/* Fortschrittsbalken */}
        {(phase === 'downloading' || phase === 'done') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: 'var(--text-muted, #64748b)' }}>
              <span>Fortschritt</span>
              <span>{progress}%</span>
            </div>
            <div style={progressTrack}>
              <div style={progressFill} />
            </div>
          </div>
        )}

        {/* Terminal */}
        {(phase === 'downloading' || phase === 'done' || phase === 'error') && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted, #64748b)' }}>
              Debug-Ausgabe
            </div>
            <div style={terminal} ref={logRef}>
              {logs.length === 0 ? (
                <span style={{ opacity: 0.4 }}>Warte auf Ausgabe…</span>
              ) : (
                logs.map((line, i) => (
                  <div key={i} style={{ color: line.includes('FEHLER') ? '#f87171' : '#c9d1d9' }}>
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Confirm-Text */}
        {phase === 'confirm' && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted, #64748b)', lineHeight: 1.6 }}>
            Eine neue Version des JL Managers ist verfügbar. Der Download wird im Hintergrund
            laufen und der Fortschritt wird hier angezeigt. Danach öffnet sich der Installer automatisch.
          </p>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          {phase === 'confirm' && (
            <>
              <button style={btnSecondary} onClick={onClose}>Abbrechen</button>
              <button style={btnPrimary} onClick={handleStart}>Jetzt herunterladen</button>
            </>
          )}
          {phase === 'downloading' && (
            <button disabled style={{ ...btnSecondary, opacity: 0.5, cursor: 'not-allowed' }}>
            Bitte warten…
            </button>
          )}
          {phase === 'done' && (
            <button style={btnPrimary} onClick={onClose}>Schließen</button>
          )}
          {phase === 'error' && (
            <>
              <button style={btnSecondary} onClick={onClose}>Schließen</button>
              <button style={btnPrimary} onClick={handleStart}>Erneut versuchen</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
