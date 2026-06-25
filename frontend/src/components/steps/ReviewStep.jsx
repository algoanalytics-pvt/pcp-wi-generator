import { useState } from 'react';
import Button from '../ui/Button';
import Card   from '../ui/Card';
import Badge  from '../ui/Badge';

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
    <div className="mt-2 overflow-auto max-h-72 border border-gray-200 rounded-xl bg-white p-2 text-xs">
      {!loaded && !loading && (
        <button
          onClick={load}
          className="text-indigo-600 text-xs font-medium hover:underline"
        >
          Load preview
        </button>
      )}
      {loading && <span className="text-gray-400 text-xs">Loading…</span>}
      {loaded  && <div dangerouslySetInnerHTML={{ __html: html }} />}
    </div>
  );
}

// ── Non-PCP expander ──────────────────────────────────────────────────
function HiddenSheetsPanel({ sheets, sessionId, onAdded }) {
  const [open,   setOpen]   = useState(false);
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
    <Card padding={false} className="mb-4 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-2 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-ink">Hidden Sheets</p>
            <p className="text-xs text-muted">{sheets.length} not added to queue</p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-3 space-y-2">
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
      )}
    </Card>
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
  language, onLanguageChange, onBack, onContinue,
}) {
  const [excluded,   setExcluded]   = useState(new Set());
  const [previewing, setPreviewing] = useState(new Set());
  const [sheets, setSheets]         = useState(uploadData?.pcp_sheets || []);
  const [nonPcp, setNonPcp]         = useState(uploadData?.non_pcp_sheets || []);

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

  return (
    <div className="space-y-4">
      {/* Hidden sheets */}
      <HiddenSheetsPanel sheets={nonPcp} sessionId={sessionId} onAdded={handleNonPcpAdded} />

      {/* Queued WIs */}
      <Card padding={false} className="overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest">Queued Work Instructions</p>
              <p className="text-xs text-muted mt-0.5">{activeSelected.length} active WI(s)</p>
            </div>
          </div>
          {activeSelected.length > 0 && (
            <Badge variant="success">✓ {activeSelected.length} ready</Badge>
          )}
          {activeSelected.length === 0 && (
            <Badge variant="warning">⚠ None selected</Badge>
          )}
        </div>

        {/* Sheet rows */}
        {sheets.length === 0 && (
          <div className="px-5 py-6 text-center text-sm text-muted">
            No Process Control Plan sheets found.
          </div>
        )}
        {sheets.map(({ key, meta }) => {
          const isExcluded  = excluded.has(key);
          const isSelected  = selected.includes(key) && !isExcluded;
          const isPreviewing = previewing.has(key);
          const stageLabel  = meta?.stage_label || key;
          const planNo      = meta?.plan_number  || '';

          return (
            <div key={key} className={`border-b border-border last:border-0 transition-colors ${isExcluded ? 'bg-surface-2/60' : ''}`}>
              <div className="flex items-center gap-3 px-5 py-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isExcluded}
                  onChange={() => toggleSelect(key)}
                  className="w-4 h-4 accent-accent cursor-pointer disabled:cursor-not-allowed"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className={`flex items-center gap-2 flex-wrap ${isExcluded ? 'opacity-40' : ''}`}>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[11px] font-bold">
                      {stageLabel}
                    </span>
                    <span className="text-sm font-semibold text-ink truncate">{key}</span>
                    {planNo && <span className="text-xs text-muted truncate">{planNo.slice(0, 50)}</span>}
                  </div>
                </div>

                {/* Preview btn */}
                <button
                  title="Toggle preview"
                  disabled={isExcluded}
                  onClick={() => togglePreview(key)}
                  className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${
                    isPreviewing ? 'bg-accent/20 text-accent' : 'text-muted hover:text-accent hover:bg-accent/5'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>

                {/* Exclude/Restore btn */}
                <button
                  title={isExcluded ? 'Restore' : 'Exclude'}
                  onClick={() => toggleExclude(key)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isExcluded ? 'text-accent hover:bg-accent/5' : 'text-muted hover:text-danger hover:bg-danger/10'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    {isExcluded ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    )}
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

        {/* Queued summary */}
        {activeSelected.length > 0 && (
          <div className="px-5 py-3 bg-accent/5 border-t border-border">
            <p className="text-xs text-accent font-medium">
              ⓘ {activeSelected.length} WI(s) queued: {activeSelected.slice(0, 6).join(' · ')}{activeSelected.length > 6 ? ' …' : ''}
            </p>
          </div>
        )}
      </Card>

      {/* Language selector */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
          <h3 className="text-sm font-semibold text-ink">Instruction Language</h3>
        </div>
        <div className="flex gap-8 flex-wrap mt-2 pl-1">
          {LANGS.map(lang => (
            <label key={lang.value} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="language"
                value={lang.value}
                checked={language === lang.value}
                onChange={() => onLanguageChange(lang.value)}
                className="w-4 h-4 accent-accent"
              />
              <span className={`text-sm transition-colors ${language === lang.value ? 'text-accent font-semibold' : 'text-muted group-hover:text-ink'}`}>
                {lang.label}
              </span>
            </label>
          ))}
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="md" onClick={onBack}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </Button>
        <Button
          variant="primary"
          size="md"
          disabled={activeSelected.length === 0}
          onClick={onContinue}
        >
          Continue
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
