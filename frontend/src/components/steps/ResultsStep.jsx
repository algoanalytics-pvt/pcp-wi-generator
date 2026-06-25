import { useState } from 'react';
import WIPreview from '../WIPreview';
import Badge     from '../ui/Badge';
import Button    from '../ui/Button';
import Card      from '../ui/Card';

// ── Helpers ───────────────────────────────────────────────────────────
function b64ToBlob(b64, mime) {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function DownloadBtn({ b64, mime, filename, label, icon }) {
  const handleClick = () => {
    if (!b64) return;
    const blob = b64ToBlob(b64, mime);
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      onClick={handleClick}
      disabled={!b64}
      className="flex items-center gap-1.5 text-sm text-muted hover:text-ink font-medium px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <span className="text-sm text-muted font-medium">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
          checked ? 'bg-accent' : 'bg-border'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-surface shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}

// ── Single result card ────────────────────────────────────────────────
function ResultCard({ stageLabel, result }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const wi     = result.wi_data;
  const h      = wi?.header || wi?.document || {};
  const prefix = result.file_prefix || 'WI';

  return (
    <div className="mb-6 rounded-2xl overflow-hidden border border-border shadow-sm">
      {/* Accent header */}
      <div className="bg-accent flex items-center justify-between px-5 py-3.5">
        <span className="text-white font-bold text-sm">Process Control Plan → Work Instructions</span>
        <span className="text-[11px] font-bold text-white/95 uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">
          {h.stage_name || stageLabel}
        </span>
      </div>

      {/* Meta grid */}
      <div className="bg-surface px-5 py-4 border-b border-border">
        <div className="grid grid-cols-3 gap-x-8 gap-y-4">
          {[
            { label: 'PART NO.',    value: h.part_no },
            { label: 'STAGE',       value: h.stage_no },
            { label: 'WI NO.',      value: h.work_instruction_no || h.wi_number },
            { label: 'PART NAME',   value: h.part_name },
            { label: 'STAGE NAME',  value: h.stage_name },
            { label: 'CYCLE TIME',  value: h.cycle_time },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{label}</p>
              <p className="text-sm font-semibold text-ink mt-0.5">{value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Downloads + preview toggle */}
      <div className="bg-surface px-5 py-3 border-b border-border flex items-center gap-3 flex-wrap">
        <DownloadBtn
          b64={result.csv_b64}
          mime="text/csv"
          filename={`${prefix}.csv`}
          label="CSV"
          icon="⬇"
        />
        {result.xlsx_b64 ? (
          <DownloadBtn
            b64={result.xlsx_b64}
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename={`${prefix}.xlsx`}
            label="Excel"
            icon="📄"
          />
        ) : (
          <span className="text-xs text-danger">⚠️ Excel failed: {result.xlsx_error}</span>
        )}
        <div className="ml-auto">
          <Toggle
            label="Preview"
            checked={previewOpen}
            onChange={setPreviewOpen}
          />
        </div>
      </div>

      {/* WI Preview section */}
      {previewOpen && (
        <div className="bg-surface">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <p className="text-xs font-bold text-muted uppercase tracking-widest">Full WI Preview</p>
          </div>
          <div className="px-5 py-4">
            <WIPreview wiData={wi} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Results step ─────────────────────────────────────────────────
const RegenerateIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export default function ResultsStep({ results, uploadData, language, onRegenerate }) {
  if (!results || Object.keys(results).length === 0) {
    return (
      <Card>
        <div className="text-center py-10 text-muted text-sm">No results to display.</div>
      </Card>
    );
  }

  const count = Object.keys(results).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Results header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent" />
          <h2 className="text-sm font-bold text-ink uppercase tracking-widest">
            Results — {count} WI{count !== 1 ? 's' : ''} Generated
          </h2>
        </div>
        <button
          onClick={onRegenerate}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-ink font-medium transition-colors"
        >
          <RegenerateIcon />
          Regenerate
        </button>
      </div>

      {/* Result cards */}
      {Object.entries(results).map(([stageLabel, res]) => (
        <ResultCard key={stageLabel} stageLabel={stageLabel} result={res} />
      ))}
    </div>
  );
}
