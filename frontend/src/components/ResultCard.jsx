import { useState } from 'react';
import WIPreview from './WIPreview';

function b64ToBlob(b64, mime) {
  const binary = atob(b64);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function DownloadBtn({ b64, mime, filename, label }) {
  const handleClick = () => {
    if (!b64) return;
    const blob = b64ToBlob(b64, mime);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button className="btn-dl" onClick={handleClick} disabled={!b64} style={!b64 ? { opacity: .5 } : {}}>
      ⬇️ {label}
    </button>
  );
}

export default function ResultCard({ stageLabel, result }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const wi      = result.wi_data;
  const h       = wi?.header || wi?.document || {};
  const prefix  = result.file_prefix || 'WI';

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Header */}
      <div className="result-header">
        <span>Process Control Plan → Work Instructions</span>
        <span className="result-stage-chip">
          {stageLabel} · {h.part_name || 'Work Instruction'}
        </span>
      </div>

      {/* Body */}
      <div className="card" style={{ borderTop: 'none', borderRadius: '0 0 14px 14px' }}>
        <div className="result-body">
          {/* Meta grid */}
          <div className="meta-grid">
            <div className="meta-item">
              <label>Part No.</label><br />
              <span>{h.part_no || '—'}</span>
            </div>
            <div className="meta-item">
              <label>Stage</label><br />
              <span>{h.stage_no || '—'}</span>
            </div>
            <div className="meta-item">
              <label>WI No.</label><br />
              <span>{h.work_instruction_no || h.wi_number || '—'}</span>
            </div>
            <div className="meta-item">
              <label>Part Name</label><br />
              <span>{h.part_name || '—'}</span>
            </div>
            <div className="meta-item">
              <label>Stage Name</label><br />
              <span>{h.stage_name || '—'}</span>
            </div>
            <div className="meta-item">
              <label>Cycle Time</label><br />
              <span>{h.cycle_time || '—'}</span>
            </div>
          </div>

          {/* Downloads */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Downloads:</span>
            <DownloadBtn
              b64={result.csv_b64}
              mime="text/csv"
              filename={`${prefix}.csv`}
              label="CSV"
            />
            {result.xlsx_b64 ? (
              <DownloadBtn
                b64={result.xlsx_b64}
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                filename={`${prefix}.xlsx`}
                label="Excel (.xlsx)"
              />
            ) : (
              <span style={{ fontSize: 12, color: '#c0392b' }}>⚠️ Excel failed: {result.xlsx_error}</span>
            )}

            <button
              className="btn btn-sm btn-secondary"
              style={{ marginLeft: 'auto' }}
              onClick={() => setPreviewOpen((o) => !o)}
            >
              {previewOpen ? '🙈 Hide Preview' : '👁 Preview WI'}
            </button>
          </div>

          {/* WI Preview */}
          {previewOpen && (
            <div style={{ borderTop: '1px solid #eee', paddingTop: 16 }}>
              <WIPreview wiData={wi} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
