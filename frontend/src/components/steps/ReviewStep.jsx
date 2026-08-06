import { useState } from 'react';
import Button from '../ui/Button';
import Card   from '../ui/Card';
import Badge  from '../ui/Badge';

const EyeOffIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
  </svg>
);

// ── Sheet Preview (lazy-loaded HTML table) ────────────────────────────
function SheetPreview({ sessionId, sheetKey }) {
  const [html,    setHtml]    = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  const load = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sheet-preview/${sessionId}/${encodeURIComponent(sheetKey)}`);
      setHtml(await res.text());
      setLoaded(true);
    } catch {
      setHtml('<p><i>Preview failed.</i></p>');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 overflow-auto max-h-72 border border-border rounded-xl bg-surface p-2 text-xs">
      {!loaded && !loading && (
        <button
          onClick={load}
          className="text-accent text-xs font-medium hover:underline"
        >
          Load preview
        </button>
      )}
      {loading && <span className="text-muted text-xs">Loading…</span>}
      {loaded  && <div dangerouslySetInnerHTML={{ __html: html }} />}
    </div>
  );
}

// ── Non-PCP panel (shown when "Manage Hidden Sheets" is toggled) ──────
function HiddenSheetsPanel({ sheets, sessionId, onAdded }) {
  const [adding, setAdding] = useState({});

  if (!sheets || sheets.length === 0) return null;

  const handleAdd = async (sheetName) => {
    setAdding(a => ({ ...a, [sheetName]: true }));
    try {
      const res  = await fetch(`/api/add-non-pcp-as-wi/${sessionId}/${encodeURIComponent(sheetName)}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      onAdded(sheetName, data);
    } catch (e) {
      alert(`Could not add sheet: ${e.message}`);
    } finally {
      setAdding(a => ({ ...a, [sheetName]: false }));
    }
  };

  return (
    <div className="border-b border-border px-5 py-3 space-y-2 bg-surface-2/40">
      <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
        Hidden / Non-PCP Sheets
      </p>
      {sheets.map(({ sheet_name }) => (
        <div key={sheet_name} className="flex items-center justify-between py-1.5">
          <span className="text-sm font-medium text-ink">{sheet_name}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={adding[sheet_name]}
            onClick={() => handleAdd(sheet_name)}
          >
            {adding[sheet_name] ? '…' : '+ Add as WI'}
          </Button>
        </div>
      ))}
    </div>
  );
}

// ── Language picker ───────────────────────────────────────────────────
const LANGS = [
  { value: 'english', label: 'English' },
  { value: 'hindi',   label: 'Hindi (हिंदी)' },
  { value: 'marathi', label: 'Marathi (मराठी)' },
];

// ── Main component ────────────────────────────────────────────────────
export default function ReviewStep({
  uploadData, sessionId, selected, onSelectionChange,
  language, onLanguageChange, onContinue,
}) {
  const [excluded,   setExcluded]   = useState(new Set());
  const [previewing, setPreviewing] = useState(new Set());
  const [sheets, setSheets]         = useState(uploadData?.pcp_sheets || []);
  const [nonPcp, setNonPcp]         = useState(uploadData?.non_pcp_sheets || []);
  const [hiddenOpen, setHiddenOpen] = useState(false);

  const toggleExclude = (key) => {
    setExcluded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const togglePreview = (key) => {
    setPreviewing(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleSelect = (key) => {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    onSelectionChange([...next]);
  };

  const handleNonPcpAdded = (sheetName, data) => {
    setSheets(prev => [...prev, { key: sheetName, meta: data.meta, columns: [] }]);
    setNonPcp(prev => prev.filter(s => s.sheet_name !== sheetName));
    onSelectionChange([...selected, sheetName]);
  };

  const activeSelected = selected.filter(k => !excluded.has(k));
  const allIncluded    = sheets.length > 0 && sheets.every(({ key }) => !excluded.has(key));

  const selectAll = () => {
    setExcluded(new Set());
    onSelectionChange(sheets.map(s => s.key));
  };
  const clearAll = () => onSelectionChange([]);
  const toggleIncludeAll = () => (allIncluded ? clearAll() : selectAll());

  return (
    <div className="space-y-4">
    <div className="grid lg:grid-cols-4 gap-6 items-start">
      <div className="lg:col-span-3 space-y-4">

      {/* Review table */}
      <Card padding={false} className="overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-ink">Review Detected Sheets</h3>
            <Badge variant="success">{sheets.length} valid sheets found</Badge>
          </div>
          {nonPcp.length > 0 && (
            <button
              onClick={() => setHiddenOpen(o => !o)}
              className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                hiddenOpen
                  ? 'text-accent border-accent/40 bg-accent/10'
                  : 'text-accent border-accent/30 bg-accent/5 hover:bg-accent/10'
              }`}
            >
              <EyeOffIcon />
              Manage Hidden Sheets ({nonPcp.length})
            </button>
          )}
        </div>

        {/* Hidden sheets */}
        {hiddenOpen && (
          <HiddenSheetsPanel sheets={nonPcp} sessionId={sessionId} onAdded={handleNonPcpAdded} />
        )}

        {/* Column headings */}
        {sheets.length > 0 && (
          <div className="hidden md:flex items-center gap-3 px-5 py-2.5 bg-surface-2/60 border-b border-border text-xs font-bold text-muted uppercase tracking-wider">
            <input
              type="checkbox"
              checked={allIncluded}
              onChange={toggleIncludeAll}
              className="w-4 h-4 accent-accent cursor-pointer shrink-0"
            />
            <span className="flex-1">Sheet Name</span>
            <span className="w-20 text-center shrink-0">Detected As</span>
            <span className="w-20 text-center shrink-0">Operations</span>
            <span className="w-16 text-center shrink-0">Rows</span>
            <span className="w-16 text-center shrink-0">Include</span>
            <span className="w-7 shrink-0" />
          </div>
        )}

        {/* Sheet rows */}
        {sheets.length === 0 && (
          <div className="px-5 py-6 text-center text-sm text-muted">
            No Process Control Plan sheets found.
          </div>
        )}
        {sheets.map(({ key, meta }) => {
          const isExcluded   = excluded.has(key);
          const isSelected   = selected.includes(key) && !isExcluded;
          const isPreviewing = previewing.has(key);
          const stageLabel   = meta?.stage_label || key;
          const planNo       = meta?.plan_number  || '';
          const detectedAs   = meta?.sheet_name ? 'Stage' : 'Sheet';
          const operations   = meta?.operation_count ?? '—';
          const rows         = meta?.row_count ?? '—';

          return (
            <div key={key} className={`border-b border-border last:border-0 transition-colors ${isExcluded ? 'bg-surface-2/60' : ''}`}>
              <div className="flex items-center gap-3 px-5 py-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isExcluded}
                  onChange={() => toggleSelect(key)}
                  className="w-4 h-4 accent-accent cursor-pointer disabled:cursor-not-allowed shrink-0"
                />

                {/* Info */}
                <div className={`flex-1 min-w-0 flex items-center gap-2 flex-wrap ${isExcluded ? 'opacity-40' : ''}`}>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-accent/10 text-accent text-xs font-bold shrink-0">
                    {stageLabel}
                  </span>
                  <span className="text-base font-semibold text-ink truncate">{key}</span>
                  {planNo && <span className="text-sm text-muted truncate hidden lg:inline">{planNo.slice(0, 50)}</span>}
                </div>

                {/* Detected As */}
                <span className="w-20 shrink-0 hidden md:flex justify-center">
                  <Badge variant="info">{detectedAs}</Badge>
                </span>

                {/* Operations */}
                <span className="w-20 shrink-0 hidden md:block text-center text-base text-muted">
                  {operations}
                </span>

                {/* Rows */}
                <span className="w-16 shrink-0 hidden md:block text-center text-base text-muted">
                  {rows}
                </span>

                {/* Include toggle */}
                <button
                  type="button"
                  role="switch"
                  title={isExcluded ? 'Excluded — click to include' : 'Included — click to exclude'}
                  aria-checked={!isExcluded}
                  onClick={() => toggleExclude(key)}
                  className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${!isExcluded ? 'bg-success' : 'bg-border'}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      !isExcluded ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>

                {/* Expand / preview */}
                <button
                  title="Toggle preview"
                  disabled={isExcluded}
                  onClick={() => togglePreview(key)}
                  className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 shrink-0 ${
                    isPreviewing ? 'bg-accent/20 text-accent' : 'text-muted hover:text-accent hover:bg-accent/5'
                  }`}
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isPreviewing ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Preview panel */}
              {isPreviewing && !isExcluded && (
                <div className="px-5 pb-3">
                  <SheetPreview sessionId={sessionId} sheetKey={key} />
                </div>
              )}
            </div>
          );
        })}

        {/* Footer */}
        {sheets.length > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3 border-t border-border">
            <span className="text-sm text-muted">
              Showing {sheets.length} of {sheets.length} sheets
            </span>
            <div className="flex items-center gap-4">
              <button onClick={selectAll} className="text-sm text-accent font-semibold hover:underline">
                Select All
              </button>
              <button onClick={clearAll} className="text-sm text-muted font-semibold hover:underline">
                Clear All
              </button>
            </div>
          </div>
        )}
      </Card>
      </div>

      {/* Right column: language + summary */}
      <div className="space-y-4">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <h3 className="text-base font-semibold text-ink">Instruction Language</h3>
          </div>
          <div className="flex flex-col gap-3">
            {LANGS.map(lang => (
              <label
                key={lang.value}
                className={`flex items-center gap-2.5 cursor-pointer rounded-xl border px-3.5 py-2.5 transition-colors ${
                  language === lang.value ? 'border-accent bg-accent/5' : 'border-border hover:bg-surface-2'
                }`}
              >
                <input
                  type="radio"
                  name="language"
                  value={lang.value}
                  checked={language === lang.value}
                  onChange={() => onLanguageChange(lang.value)}
                  className="w-4 h-4 accent-accent"
                />
                <span className={`text-base ${language === lang.value ? 'text-accent font-semibold' : 'text-ink'}`}>
                  {lang.label}
                </span>
              </label>
            ))}
          </div>
        </Card>
      </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-muted flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Your data is secure and never shared.
        </p>
        <Button
          variant="accent"
          size="md"
          disabled={activeSelected.length === 0}
          onClick={onContinue}
        >
          Continue to Generate
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
