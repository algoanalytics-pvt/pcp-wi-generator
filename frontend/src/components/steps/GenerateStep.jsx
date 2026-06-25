import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Card   from '../ui/Card';

// ── Sub-step labels & weights ─────────────────────────────────────────
const SUB_LABELS  = ['Building prompt…', 'Calling LLM…', 'Parsing response…', 'Building Excel…'];

// ── Spinner ───────────────────────────────────────────────────────────
function GeneratingSpinner({ current, total, subStep, stageName, pct, selectedSheets }) {
  return (
    <Card>
      <div className="p-6 md:p-8 space-y-8 animate-scale-in">
        {/* Header */}
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-ink">Generating Work Instructions</h3>
          <p className="text-xs text-muted">Please do not close or refresh this page. Generating files from AI model.</p>
        </div>

        {/* Progress Display */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
          {/* Circular Progress Ring */}
          <div className="relative w-28 h-28 flex-shrink-0">
            {/* SVG Circle background & progress */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                className="text-surface-2"
                strokeWidth="8"
                stroke="currentColor"
                fill="transparent"
                r="38"
                cx="50"
                cy="50"
              />
              <circle
                className="text-accent transition-all duration-300 ease-out"
                strokeWidth="8"
                strokeDasharray={2 * Math.PI * 38}
                strokeDashoffset={2 * Math.PI * 38 * (1 - pct / 100)}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="38"
                cx="50"
                cy="50"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-accent tracking-tight">{pct}%</span>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Overall</span>
            </div>
          </div>

          {/* Details / Sub-step indicator */}
          <div className="flex-1 space-y-4 w-full">
            {/* Linear Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-ink">Overall Progress</span>
                <span className="font-bold text-accent">{pct}%</span>
              </div>
              <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-accent-strong transition-all duration-300 ease-out rounded-full shadow-[0_0_8px_rgba(19,135,201,0.25)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Sub-step indicator */}
            <div className="bg-accent/5 border border-accent/10 rounded-xl p-3.5 flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-accent mt-0.5 animate-pulse">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Current Action</p>
                <p className="text-sm font-bold text-ink mt-0.5">{SUB_LABELS[subStep] ?? 'Working…'}</p>
                <p className="text-xs text-accent font-medium mt-0.5">
                  Sheet: <span className="underline font-semibold">{stageName}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sheet progress checklist */}
        {selectedSheets && selectedSheets.length > 0 && (
          <div className="border-t border-border pt-6">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Sheet Processing Queue</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedSheets.map((sheetName, i) => {
                const state = i < current - 1 ? 'done' : i === current - 1 ? 'active' : 'pending';

                return (
                  <div
                    key={sheetName}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
                      state === 'done'
                        ? 'bg-success/5 border-success/20 text-success'
                        : state === 'active'
                        ? 'bg-accent/5 border-accent/20 text-ink shadow-sm shadow-accent/5'
                        : 'bg-surface-2/50 border-border/80 text-muted'
                    }`}
                  >
                    {/* Status Indicator */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        state === 'done'
                          ? 'bg-success text-white'
                          : state === 'active'
                          ? 'bg-accent text-white shadow-md shadow-accent/10'
                          : 'bg-border text-muted'
                      }`}
                    >
                      {state === 'done' ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : state === 'active' ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      ) : (
                        <span className="text-[10px] font-bold">{i + 1}</span>
                      )}
                    </div>

                    {/* Sheet Name and details */}
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate ${state === 'pending' ? 'text-muted' : 'text-ink'}`}>
                        {sheetName}
                      </p>
                      <p className="text-[10px] text-muted truncate">
                        {state === 'done' ? (
                          <span className="text-success font-semibold">Done</span>
                        ) : state === 'active' ? (
                          <span className="text-accent font-semibold animate-pulse">{SUB_LABELS[subStep] ?? 'Processing…'}</span>
                        ) : (
                          <span>Queued</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Success screen ────────────────────────────────────────────────────
function GenerationSuccess({ uploadData, language, selected, onViewResults, onBack }) {
  const langLabel = { english: 'English', hindi: 'Hindi (हिंदी)', marathi: 'Marathi (मराठी)' }[language] ?? language;
  const fileName  = uploadData?.file_name || 'Uploaded file';

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary card */}
      <Card>
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">Generation Summary</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Box 1: SOURCE */}
          <div className="flex items-center gap-3.5 p-4 rounded-xl border border-border bg-surface-2/50">
            <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest leading-none">SOURCE</p>
              <p className="text-xs font-bold text-ink truncate mt-1.5" title={fileName}>{fileName}</p>
            </div>
          </div>

          {/* Box 2: LANGUAGE */}
          <div className="flex items-center gap-3.5 p-4 rounded-xl border border-border bg-surface-2/50">
            <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest leading-none">LANGUAGE</p>
              <p className="text-xs font-bold text-ink truncate mt-1.5">{langLabel}</p>
            </div>
          </div>

          {/* Box 3: OUTPUT */}
          <div className="flex items-center gap-3.5 p-4 rounded-xl border border-border bg-surface-2/50">
            <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest leading-none">OUTPUT</p>
              <p className="text-xs font-bold text-ink truncate mt-1.5">{selected.length} Work Instruction{selected.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Complete card */}
      <Card>
        <div className="flex flex-col items-center py-10 gap-4">
          {/* Animated check */}
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" className="animate-checkmark" />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-ink">Generation Complete</h2>
            <p className="text-sm text-muted mt-1">Your work instructions are ready</p>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <Button variant="ghost" size="md" onClick={onBack}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Modify Settings
            </Button>
            <Button variant="primary" size="md" onClick={onViewResults}>
              View Results
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function GenerateStep({
  sessionId, selected, language, trainingReady,
  uploadData, onResults, onBack,
}) {
  const [phase,   setPhase]   = useState('idle');   // idle | generating | done | error
  const [spinner, setSpinner] = useState(null);
  const [error,   setError]   = useState('');
  const [results, setResults] = useState(null);

  const langLabel = { english: 'English', hindi: 'Hindi (हिंदी)', marathi: 'Marathi (मराठी)' }[language] ?? language;
  const fileName  = uploadData?.file_name || 'Uploaded file';

  const canGenerate = trainingReady && sessionId && selected.length > 0;

  const missing = [];
  if (!trainingReady)         missing.push('training data');
  if (!sessionId)             missing.push('PCP upload');
  if (selected.length === 0)  missing.push('at least one sheet selected');

  const handleGenerate = async () => {
    setPhase('generating');
    setError('');
    setSpinner({ current: 1, total: selected.length, subStep: 0, stageName: selected[0], pct: 0 });

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
      const res  = await fetch('/api/generate', {
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

  // ── Generating spinner ─────────────────────────────────────
  if (phase === 'generating' && spinner) {
    return <GeneratingSpinner {...spinner} selectedSheets={selected} />;
  }

  // ── Done / Success ─────────────────────────────────────────
  if (phase === 'done') {
    return (
      <GenerationSuccess
        uploadData={uploadData}
        language={language}
        selected={selected}
        onViewResults={() => onResults(results)}
        onBack={() => setPhase('idle')}
      />
    );
  }

  // ── Idle / pre-generation ──────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Generation Summary</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Box 1: SOURCE */}
          <div className="flex items-center gap-3.5 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">SOURCE</p>
              <p className="text-xs font-bold text-gray-800 truncate mt-1.5" title={fileName}>{fileName}</p>
            </div>
          </div>

          {/* Box 2: LANGUAGE */}
          <div className="flex items-center gap-3.5 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">LANGUAGE</p>
              <p className="text-xs font-bold text-gray-800 truncate mt-1.5">{langLabel}</p>
            </div>
          </div>

          {/* Box 3: OUTPUT */}
          <div className="flex items-center gap-3.5 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">OUTPUT</p>
              <p className="text-xs font-bold text-gray-800 truncate mt-1.5">{selected.length} Work Instruction{selected.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {missing.length > 0 && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3 mb-4">
            <span>⚠️</span>
            <span>Still needed: {missing.join(', ')}</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4 whitespace-pre-wrap">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="md" onClick={onBack}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </Button>
        <Button variant="primary" size="md" disabled={!canGenerate} onClick={handleGenerate}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Generate {selected.length > 0 ? `${selected.length} WI${selected.length !== 1 ? 's' : ''}` : 'WIs'}
        </Button>
      </div>
    </div>
  );
}
