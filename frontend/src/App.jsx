import { useEffect, useState } from 'react';
import AppShell     from './components/layout/AppShell';
import UploadStep   from './components/steps/UploadStep';
import ReviewStep   from './components/steps/ReviewStep';
import GenerateStep from './components/steps/GenerateStep';
import ResultsStep  from './components/steps/ResultsStep';

// ── Step definitions ──────────────────────────────────────────────────
const STEPS = [
  { id: 'upload',   label: 'Upload',   sub: 'Upload PCP' },
  { id: 'review',   label: 'Review',   sub: 'Review & Configure' },
  { id: 'generate', label: 'Generate', sub: 'Generate WIs' },
  { id: 'results',  label: 'Results',  sub: 'View Results' },
];

export default function App() {
  // ── Global state ──────────────────────────────────────────────────
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [currentStep,    setCurrentStep]    = useState(0);       // 0-3
  const [uploadData,     setUploadData]     = useState(null);    // /api/upload-pcp response
  const [sessionId,      setSessionId]      = useState('');
  const [selected,       setSelected]       = useState([]);      // selected sheet keys
  const [language,       setLanguage]       = useState('english');
  const [results,        setResults]        = useState(null);    // generation results

  // ── Load training status ──────────────────────────────────────────
  useEffect(() => {
    fetch('/api/training-status')
      .then(r  => r.json())
      .then(setTrainingStatus)
      .catch(() => setTrainingStatus({ ready: false, errors: ['Backend not reachable'] }));
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────
  const handleUploadSuccess = (data) => {
    setUploadData(data);
    setSessionId(data.session_id);
    setSelected(data.pcp_sheets.map(s => s.key));
    setResults(null);
    // Advance to review step
    setCurrentStep(1);
  };

  const handleResults = (res) => {
    setResults(res);
    setCurrentStep(3);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setUploadData(null);
    setSessionId('');
    setSelected([]);
    setLanguage('english');
    setResults(null);
  };

  // ── Completed steps: every step before currentStep ────────────────
  const completedSteps = new Set(
    STEPS.slice(0, currentStep).map(s => s.id)
  );

  // ── Render ────────────────────────────────────────────────────────
  return (
    <AppShell
      steps={STEPS}
      currentStep={currentStep}
      completedSteps={completedSteps}
      trainingStatus={trainingStatus}
      onReset={handleReset}
    >
      {/* Step 0 — Upload */}
      {currentStep === 0 && (
        <UploadStep
          uploadData={uploadData}
          onUploadSuccess={handleUploadSuccess}
          onRemove={() => {
            setUploadData(null);
            setSessionId('');
            setSelected([]);
          }}
        />
      )}

      {/* Step 1 — Review */}
      {currentStep === 1 && uploadData && (
        <ReviewStep
          uploadData={uploadData}
          sessionId={sessionId}
          selected={selected}
          onSelectionChange={setSelected}
          language={language}
          onLanguageChange={setLanguage}
          onBack={() => setCurrentStep(0)}
          onContinue={() => setCurrentStep(2)}
        />
      )}

      {/* Step 2 — Generate */}
      {currentStep === 2 && (
        <GenerateStep
          sessionId={sessionId}
          selected={selected}
          language={language}
          uploadData={uploadData}
          trainingReady={trainingStatus?.ready ?? false}
          onResults={handleResults}
          onBack={() => setCurrentStep(1)}
        />
      )}

      {/* Step 3 — Results */}
      {currentStep === 3 && (
        <ResultsStep
          results={results}
          uploadData={uploadData}
          language={language}
          onRegenerate={() => setCurrentStep(2)}
        />
      )}
    </AppShell>
  );
}
