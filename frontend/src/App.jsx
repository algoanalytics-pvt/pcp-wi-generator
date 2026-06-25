import { useEffect, useState } from 'react';
import TopBar        from './components/TopBar';
import UploadStep    from './components/UploadStep';
import SheetList     from './components/SheetList';
import GenerateStep  from './components/GenerateStep';
import ResultCard    from './components/ResultCard';

export default function App() {
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [uploadData,     setUploadData]     = useState(null);   // result of /api/upload-pcp
  const [sessionId,      setSessionId]      = useState('');
  const [selected,       setSelected]       = useState([]);     // selected sheet keys
  const [results,        setResults]        = useState(null);   // generation results

  // ── Load training status on mount ────────────────────────────────────
  useEffect(() => {
    fetch('/api/training-status')
      .then((r) => r.json())
      .then(setTrainingStatus)
      .catch(() => setTrainingStatus({ ready: false, errors: ['Backend not reachable'] }));
  }, []);

  const handleUploadSuccess = (data) => {
    setUploadData(data);
    setSessionId(data.session_id);
    // Auto-select all PCP sheets
    setSelected(data.pcp_sheets.map((s) => s.key));
    setResults(null);
  };

  const handleResults = (res) => {
    setResults(res);
    // Scroll to results
    setTimeout(() => {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <>
      <TopBar trainingStatus={trainingStatus} />

      <main className="page-wrap">
        {/* Step 1 — Upload */}
        <UploadStep onUploadSuccess={handleUploadSuccess} />

        {/* Sheet list */}
        {uploadData && (
          <div style={{ marginTop: 20 }}>
            {uploadData.total_pcp > 0 ? (
              <SheetList
                uploadData={uploadData}
                sessionId={sessionId}
                selected={selected}
                onSelectionChange={setSelected}
              />
            ) : (
              <div className="alert alert-warning">
                ⚠️ No Process Control Plan sheets found. Check that sheets contain
                "PROCESS CONTROL PLAN" (or "CONTROL PLAN") and "Process Control Plan Number" in header rows.
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Language & Generate */}
        <GenerateStep
          sessionId={sessionId}
          selected={selected}
          trainingReady={trainingStatus?.ready ?? false}
          onResults={handleResults}
        />

        {/* Results */}
        {results && Object.keys(results).length > 0 && (
          <section id="results-section">
            <hr className="divider" />
            <div className="step-label" style={{ marginTop: 0 }}>
              📥 Results — {Object.keys(results).length} WI{Object.keys(results).length !== 1 ? 's' : ''} generated
            </div>
            <div className="alert alert-success">
              ✅ {Object.keys(results).length} Work Instruction{Object.keys(results).length !== 1 ? 's' : ''} generated successfully!
            </div>
            {Object.entries(results).map(([stageLabel, res]) => (
              <ResultCard key={stageLabel} stageLabel={stageLabel} result={res} />
            ))}
          </section>
        )}
      </main>
    </>
  );
}
