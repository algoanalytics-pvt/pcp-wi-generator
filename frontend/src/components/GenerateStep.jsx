import { useState } from 'react';

const LANGS = [
  { value: 'english', label: 'English' },
  { value: 'hindi',   label: 'Hindi (हिंदी)' },
  { value: 'marathi', label: 'Marathi (मराठी)' },
];

const SUB_LABELS = [
  'Building prompt…',
  'Calling LLM…',
  'Parsing response…',
  'Building Excel…',
];
const SUB_WEIGHTS = [20, 50, 20, 10];
const TOTAL_W = SUB_WEIGHTS.reduce((a, b) => a + b, 0);

function Spinner({ current, total, subStep, stageName, pct }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="spinner-wrap">
        <div className="spinner-ring" />
        <div className="spinner-pct">{pct}%</div>
        <div className="spinner-msg">{SUB_LABELS[subStep] ?? 'Working…'}</div>
        <div className="spinner-stage">Stage {current} of {total} · {stageName}</div>
        <div className="spinner-dots">
          {Array.from({ length: total }).map((_, i) => {
            const cls = i < current - 1 ? 'done' : i === current - 1 ? 'active' : '';
            return (
              <div key={i} className="dot-wrap">
                <div className={`dot ${cls}`} />
                <div className="dot-label">S{String(i + 1).padStart(2, '0')}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function GenerateStep({
  sessionId, selected, trainingReady, onResults,
}) {
  const [language, setLanguage] = useState('english');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [spinner,  setSpinner]  = useState(null); // { current, total, subStep, stageName, pct }

  const canGenerate = trainingReady && sessionId && selected.length > 0 && !loading;

  const missing = [];
  if (!trainingReady)      missing.push('training data (add files to training_data/)');
  if (!sessionId)          missing.push('PCP file upload');
  if (selected.length === 0) missing.push('at least one PCP sheet selected');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setSpinner({ current: 1, total: selected.length, subStep: 0, stageName: selected[0], pct: 0 });

    try {
      // Simulate progress ticks while the request runs
      let done = false;
      let stageIdx = 0;
      let subIdx   = 0;

      const tick = () => {
        if (done) return;
        stageIdx = Math.min(stageIdx, selected.length - 1);
        const stageBase = Math.floor((stageIdx / selected.length) * 100);
        const stageSpan = Math.floor((1 / selected.length) * 100);
        const doneSoFar = SUB_WEIGHTS.slice(0, subIdx).reduce((a, b) => a + b, 0);
        const subFrac   = doneSoFar / TOTAL_W;
        const pct       = Math.min(99, stageBase + Math.floor(subFrac * stageSpan));
        setSpinner({
          current:   stageIdx + 1,
          total:     selected.length,
          subStep:   subIdx,
          stageName: selected[stageIdx] || '',
          pct,
        });
        subIdx++;
        if (subIdx >= SUB_WEIGHTS.length) { subIdx = 0; stageIdx++; }
        setTimeout(tick, 1200);
      };
      tick();

      const res  = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id:      sessionId,
          selected_sheets: selected,
          language,
        }),
      });
      done = true;

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Generation failed');

      if (data.errors?.length) {
        setError(data.errors.join('\n'));
      }
      onResults(data.results);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setSpinner(null);
    }
  };

  return (
    <section>
      <hr className="divider" />
      <div className="step-label">
        <span className="step-num">2</span> Language &amp; Generate
      </div>

      {/* Language selector */}
      <div className="lang-radio-group">
        {LANGS.map((lang) => (
          <label key={lang.value} className={`lang-radio-option ${language === lang.value ? 'selected' : ''}`}>
            <input
              type="radio"
              name="language"
              value={lang.value}
              checked={language === lang.value}
              onChange={() => setLanguage(lang.value)}
            />
            {lang.label}
          </label>
        ))}
      </div>

      {/* Missing requirements */}
      {missing.length > 0 && !loading && (
        <div className="alert alert-info" style={{ marginBottom: 12 }}>
          Still needed: {missing.join(', ')}
        </div>
      )}

      {/* Generate button */}
      <button
        className="btn btn-primary btn-full"
        disabled={!canGenerate}
        onClick={handleGenerate}
      >
        🚀 Generate {selected.length > 0 ? `${selected.length} Work Instruction${selected.length !== 1 ? 's' : ''}` : 'Work Instructions'}
      </button>

      {/* Spinner */}
      {spinner && <Spinner {...spinner} />}

      {/* Error */}
      {error && (
        <div className="alert alert-error" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
          ⚠️ {error}
        </div>
      )}
    </section>
  );
}
