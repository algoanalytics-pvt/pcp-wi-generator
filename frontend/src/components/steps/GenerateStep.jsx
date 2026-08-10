import { useEffect, useRef, useState } from 'react';
import Button    from '../ui/Button';
import Card      from '../ui/Card';
import WIPreview from '../WIPreview';
import { apiUrl } from '../../api';
import { trackEvent } from '../../ga';

function downloadFile(b64, mime, filename, format) {
  if (!b64) return;
  trackEvent('file_downloaded', {
    app_name: 'PCP WI Generator',
    format,
  });
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

function formatDuration(ms) {
  if (ms == null) return '—';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function estimateFileSize(b64) {
  if (!b64) return '—';
  const bytes = Math.round((b64.length * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Icons ─────────────────────────────────────────────────────────────
const CheckIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);
const RegenerateIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const ClockIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
  </svg>
);
const EyeIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);
const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);
const DocIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const LayersIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4" />
  </svg>
);
const SlidersIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M6 6a2 2 0 100-4 2 2 0 000 4zm4 4h10M10 10a2 2 0 11-4 0 2 2 0 014 0zm4 8h6m-6 0a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const DownloadIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
  </svg>
);
const ArrowRightIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);
const ShieldCheckIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M12 3c3 0 6 1.5 6 1.5v6c0 4-2.5 7-6 8.5-3.5-1.5-6-4.5-6-8.5v-6S9 3 12 3z" />
  </svg>
);

// ── Compact toolbar button (Preview / CSV / Excel) ─────────────────────
function ToolbarButton({ icon, label, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-strong px-3.5 py-2 rounded-lg border border-accent bg-surface hover:bg-accent/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {icon}
      {label}
    </button>
  );
}

// ── Stat pill shown in the top status banner ───────────────────────────
function StatPill({ icon, value, label }) {
  return (
    <div className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 min-w-[150px]">
      <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center text-accent flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-ink leading-tight truncate">{value}</p>
        <p className="text-sm text-muted leading-tight truncate">{label}</p>
      </div>
    </div>
  );
}

// ── Live preview: the actual generated Work Instruction document, with
//    paging across the generated sheets ────────────────────────────────
function LivePreviewPanel({ result, activeIdx, total, onPrev, onNext }) {
  return (
    <div className="animate-fade-in">
      <div className="rounded-xl border border-border p-4">
        <WIPreview wiData={result.wi_data} />
      </div>

      <div className="flex items-center justify-between mt-3 px-1">
        <button
          onClick={onPrev}
          disabled={activeIdx <= 0}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeftIcon />
        </button>
        <span className="text-xs font-medium text-muted">{activeIdx + 1} / {total}</span>
        <button
          onClick={onNext}
          disabled={activeIdx >= total - 1}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
}

// ── Placeholder shown while no sheet has finished yet ───────────────────
function PreviewSkeleton() {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 flex flex-col items-center justify-center text-center gap-2 min-h-[180px]">
      <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      <p className="text-xs text-muted">Preview will appear here once a sheet finishes generating</p>
    </div>
  );
}

// ── One row in the "All Results" list ──────────────────────────────────
function ResultRow({ stageLabel, result, onPreview }) {
  const wi     = result.wi_data;
  const h      = wi?.header || wi?.document || {};
  const prefix = result.file_prefix || 'WI';

  return (
    <div className="flex items-center gap-4 py-5 flex-wrap border-b border-border last:border-0">
      <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
        <DocIcon className="w-5 h-5" />
      </div>

      <div className="min-w-0 flex-1 basis-[240px]">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-base font-bold text-ink truncate">
            Work Instruction - {h.part_name || stageLabel}
          </p>
          <span className="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded-full flex-shrink-0">
            Generated
          </span>
        </div>
        <p className="text-sm text-muted truncate mt-0.5">{h.stage_name || stageLabel}</p>
      </div>

      <div className="hidden md:flex items-center gap-6 text-sm flex-shrink-0">
        <div>
          <p className="text-xs text-muted">Part No.</p>
          <p className="font-semibold text-ink mt-0.5">{h.part_no || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Stage</p>
          <p className="font-semibold text-ink mt-0.5">{h.stage_no || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted">File Size</p>
          <p className="font-semibold text-ink mt-0.5">{estimateFileSize(result.xlsx_b64 || result.csv_b64)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        <ToolbarButton icon={<EyeIcon />} label="Preview" onClick={onPreview} />
        <ToolbarButton
          icon={<DocIcon className="w-4 h-4" />}
          label="Excel"
          disabled={!result.xlsx_b64}
          onClick={() => downloadFile(
            result.xlsx_b64,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            `${prefix}.xlsx`,
            'xlsx'
          )}
        />
        <ToolbarButton
          icon={<DownloadIcon className="w-4 h-4" />}
          label="CSV"
          disabled={!result.csv_b64}
          onClick={() => downloadFile(result.csv_b64, 'text/csv', `${prefix}.csv`, 'csv')}
        />
      </div>
    </div>
  );
}

// ── Generating / Done — single linear view, no tabs or duplicate CTAs ──
function GenerateResultsView({ selected, phase, spinner, results, error, onBack, onRegenerate }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (phase === 'generating' && startRef.current == null) {
      startRef.current = performance.now();
    }
    if (phase === 'done' && startRef.current != null && elapsedMs == null) {
      setElapsedMs(performance.now() - startRef.current);
    }
  }, [phase, elapsedMs]);

  const total     = selected.length;
  const pct       = phase === 'done' ? 100 : (spinner?.pct ?? 0);
  const stageName = spinner?.stageName ?? '';

  const resultEntries = results ? Object.entries(results) : [];

  const activeSheetName = selected[activeIdx];
  const activeEntry = (results && activeSheetName && results[activeSheetName])
    ? [activeSheetName, results[activeSheetName]]
    : resultEntries[activeIdx];
  const [, activeResult] = activeEntry || [];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Status banner: icon + title/subtitle (left), stat pills or progress (right) */}
      <Card className={phase === 'done' ? 'bg-success/5 border-success/20' : ''}>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-4 flex-1 min-w-[240px]">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 ${
              phase === 'done' ? 'bg-success text-white' : 'bg-accent text-white'
            }`}>
              {phase === 'done'
                ? <CheckIcon className="w-8 h-8" />
                : <div className="w-4 h-4 rounded-full bg-white animate-ping" />}
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-ink truncate">
                {phase === 'done' ? 'Work Instruction generated successfully!' : 'Generating Work Instruction…'}
              </p>
              <p className="text-sm text-muted mt-0.5 truncate">
                {phase === 'done'
                  ? 'Your document is ready to preview and download.'
                  : `Processing: ${stageName || '—'}. Almost done, please don't close this window.`}
              </p>
            </div>
          </div>

          {phase === 'done' ? (
            <div className="flex items-center gap-3 flex-wrap">
              <StatPill
                icon={<DocIcon />}
                value={resultEntries.length}
                label={resultEntries.length === 1 ? 'Work Instruction' : 'Work Instructions'}
              />
              <StatPill icon={<LayersIcon />} value={total} label="Sheets Processed" />
              <StatPill icon={<ClockIcon className="w-5 h-5" />} value={formatDuration(elapsedMs)} label="Generation Time" />
              <StatPill icon={<ShieldCheckIcon />} value="100%" label="Completed" />
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-1 min-w-[180px]">
              <div className="flex-1 h-2.5 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-accent/10 text-accent flex-shrink-0">
                {pct}%
              </span>
            </div>
          )}
        </div>
      </Card>

      {phase === 'done' ? (
        <>
          {/* Output Options — Preview & Download */}
          <Card>
            <div className="flex items-center gap-2">
              <SlidersIcon className="w-5 h-5 text-ink" />
              <p className="text-base font-bold text-ink">Output Options</p>
            </div>
            <p className="text-sm text-muted mt-1 mb-5">
              Choose how you want to view or download your Work Instruction.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Preview card */}
              <div className="rounded-xl border border-border p-5 flex flex-col">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
                    <EyeIcon />
                  </div>
                  <p className="font-bold text-ink text-base">Preview Work Instruction</p>
                  <span className="text-[10px] font-bold text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                </div>
                <p className="text-sm text-muted mb-4">
                  Open an interactive preview to review the document before downloading.
                </p>
                <Button
                  variant="secondary"
                  size="md"
                  className="mt-auto self-start"
                  onClick={() => setPreviewOpen(o => !o)}
                >
                  {previewOpen ? 'Hide Preview' : 'Preview'}
                  <ArrowRightIcon />
                </Button>
              </div>

              {/* Download card */}
              <div className="rounded-xl border border-border p-5 flex flex-col">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
                    <DownloadIcon />
                  </div>
                  <p className="font-bold text-ink text-base">Download Work Instruction</p>
                </div>
                <p className="text-sm text-muted mb-4">
                  Download the generated Work Instruction in your preferred format.
                </p>
                <div className="flex items-center gap-2 mt-auto">
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={!activeResult?.xlsx_b64}
                    onClick={() => downloadFile(
                      activeResult.xlsx_b64,
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                      `${activeResult.file_prefix || 'WI'}.xlsx`,
                      'xlsx'
                    )}
                  >
                    <DocIcon className="w-4 h-4" />
                    Download Excel
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={!activeResult?.csv_b64}
                    onClick={() => downloadFile(activeResult.csv_b64, 'text/csv', `${activeResult.file_prefix || 'WI'}.csv`, 'csv')}
                  >
                    <DocIcon className="w-4 h-4" />
                    Download CSV
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {previewOpen && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                <p className="text-base font-bold text-ink">Live Preview</p>
              </div>
              {activeResult ? (
                <LivePreviewPanel
                  result={activeResult}
                  activeIdx={activeIdx}
                  total={resultEntries.length || total}
                  onPrev={() => setActiveIdx(i => Math.max(0, i - 1))}
                  onNext={() => setActiveIdx(i => Math.min((resultEntries.length || total) - 1, i + 1))}
                />
              ) : (
                <PreviewSkeleton />
              )}
            </Card>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-danger/10 border border-danger/25 text-danger text-sm rounded-xl px-4 py-3 whitespace-pre-wrap">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {resultEntries.length > 0 && (
            <div className="flex items-start gap-2 bg-info/5 border border-info/20 text-ink text-sm rounded-xl px-4 py-3">
              <span className="text-info flex-shrink-0">ℹ</span>
              <span>
                You can always download the file{resultEntries.length > 1 ? 's' : ''} again from the{' '}
                <strong>All Results</strong> section below.
              </span>
            </div>
          )}

          {/* Full results list */}
          {resultEntries.length > 0 && (
            <Card>
              <p className="text-base font-bold text-ink mb-1">All Results</p>
              <div>
                {resultEntries.map(([stageLabel, res], i) => (
                  <ResultRow
                    key={stageLabel}
                    stageLabel={stageLabel}
                    result={res}
                    onPreview={() => { setActiveIdx(i); setPreviewOpen(true); }}
                  />
                ))}
              </div>
            </Card>
          )}
        </>
      ) : (
        error && (
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/25 text-danger text-sm rounded-xl px-4 py-3 whitespace-pre-wrap">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="md" onClick={onBack}>
          <BackIcon />
          Modify Settings
        </Button>
        {phase === 'done' && (
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="md" onClick={onRegenerate}>
              <RegenerateIcon />
              Generate Again
            </Button>
            <Button variant="accent" size="md" onClick={onBack}>
              <CheckIcon />
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function GenerateStep({
  sessionId, selected, language, trainingReady,
  onBack, onPhaseChange,
}) {
  const [phase,   setPhase]   = useState('idle');   // idle | generating | done | error
  const [spinner, setSpinner] = useState(null);
  const [error,   setError]   = useState('');
  const [results, setResults] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    onPhaseChange?.(phase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const canGenerate = trainingReady && sessionId && selected.length > 0;

  const missing = [];
  if (!trainingReady)         missing.push('training data');
  if (!sessionId)             missing.push('PCP upload');
  if (selected.length === 0)  missing.push('at least one sheet selected');

  const handleGenerate = async () => {
    setPhase('generating');
    setError('');
    setSpinner({ current: 1, total: selected.length, subStep: 0, stageName: selected[0], pct: 0 });
    trackEvent('generation_run', {
      app_name: 'PCP WI Generator',
      sheets_count: selected.length,
      language,
    });

    let done = false;
    let currentPct = 0;

    // Scale interval based on number of sheets: roughly 6 seconds simulated per sheet
    const baseInterval = Math.max(50, Math.floor((selected.length * 6000) / 100));

    const tick = () => {
      if (done) return;

      if (currentPct < 99) {
        let increment = 1;
        // Asymptotically slow down as we approach 99%
        if (currentPct >= 95) {
          if (Math.random() > 0.9) increment = 1;
          else increment = 0;
        } else if (currentPct >= 85) {
          if (Math.random() > 0.6) increment = 1;
          else increment = 0;
        } else if (currentPct >= 70) {
          if (Math.random() > 0.3) increment = 1;
          else increment = 0;
        }

        currentPct = Math.min(currentPct + increment, 99);
      }

      const progressPerSheet = 100 / selected.length;
      const stageIdx = Math.min(Math.floor(currentPct / progressPerSheet), selected.length - 1);
      const sheetProgress = currentPct - (stageIdx * progressPerSheet);
      const subStepIdx = Math.min(Math.floor((sheetProgress / progressPerSheet) * 4), 3);

      setSpinner({
        current: stageIdx + 1,
        total: selected.length,
        subStep: subStepIdx,
        stageName: selected[stageIdx] || '',
        pct: currentPct
      });

      if (currentPct < 99) {
        setTimeout(tick, baseInterval);
      } else {
        // Slow heartbeat ticks if we are stuck at 99% waiting for LLM
        setTimeout(tick, 1000);
      }
    };
    tick();

    try {
      const res  = await fetch(apiUrl('/generate'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_id: sessionId, selected_sheets: selected, language }),
      });
      done = true;

      // Jump immediately to 100%
      setSpinner({
        current: selected.length,
        total: selected.length,
        subStep: 3,
        stageName: selected[selected.length - 1] || '',
        pct: 100
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Generation failed');
      if (data.errors?.length) setError(data.errors.join('\n'));
      setResults(data.results);

      // Brief delay to let them see 100% completion
      await new Promise(resolve => setTimeout(resolve, 800));
      setPhase('done');
    } catch (e) {
      done = true;
      setError(e.message);
      setPhase('error');
    } finally {
      setSpinner(null);
    }
  };

  // Generation starts the moment this step mounts — no extra confirmation click.
  useEffect(() => {
    if (canGenerate && !started.current) {
      started.current = true;
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGenerate]);

  // ── Combined generating / done view (linear, no tabs) ──────
  if (phase === 'generating' || phase === 'done') {
    return (
      <GenerateResultsView
        selected={selected}
        phase={phase}
        spinner={spinner}
        results={results}
        error={error}
        onBack={onBack}
        onRegenerate={() => { setResults(null); setError(''); handleGenerate(); }}
      />
    );
  }

  // ── Error — allow retry without leaving the step ────────────
  if (phase === 'error') {
    return (
      <div className="space-y-4 animate-fade-in">
        <Card>
          <p className="text-xs font-bold text-danger uppercase tracking-widest mb-3">Generation Failed</p>
          <p className="text-sm text-ink whitespace-pre-wrap">{error}</p>
        </Card>
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="md" onClick={onBack}>
            <BackIcon />
            Modify Settings
          </Button>
          <Button variant="accent" size="md" onClick={handleGenerate}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Idle — only reached when prerequisites are missing ──────
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">Cannot Generate Yet</p>
        <div className="flex items-start gap-2 bg-warning/10 border border-warning/25 text-warning text-sm rounded-xl px-4 py-3">
          <span>⚠️</span>
          <span>Still needed: {missing.join(', ')}</span>
        </div>
      </Card>
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="md" onClick={onBack}>
          <BackIcon />
          Back
        </Button>
      </div>
    </div>
  );
}
