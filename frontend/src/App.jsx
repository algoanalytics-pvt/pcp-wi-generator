import { useEffect, useState } from 'react';
import { apiUrl } from './api';
import LandingPage  from './components/landing/LandingPage';
import AppShell     from './components/layout/AppShell';
import UploadStep   from './components/steps/UploadStep';
import ReviewStep   from './components/steps/ReviewStep';
import GenerateStep from './components/steps/GenerateStep';
import { loadGA } from './ga';

const APP_NAME = 'PCP WI Generator';

// ── Step definitions ──────────────────────────────────────────────────
const STEPS = [
  { id: 'upload',   label: 'Upload',   sub: 'Import PCP File' },
  { id: 'review',   label: 'Review',   sub: 'Validate & Configure' },
  { id: 'generate', label: 'Generate', sub: 'Create Instructions' },
  { id: 'results',  label: 'Results',  sub: 'Download Output' },
];

export default function App() {
  // ── Global state ──────────────────────────────────────────────────
  const [view,           setView]           = useState('landing'); // 'landing' | 'app'
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [currentStep,    setCurrentStep]    = useState(0);       // 0-1
  const [uploadData,     setUploadData]     = useState(null);    // /api/upload-pcp response
  const [sessionId,      setSessionId]      = useState('');
  const [selected,       setSelected]       = useState([]);      // selected sheet keys
  const [language,       setLanguage]       = useState('english');
  const [generatePhase,  setGeneratePhase]  = useState('idle');  // idle | generating | done | error

  // ── Load training status ──────────────────────────────────────────
  useEffect(() => {
    fetch(apiUrl('/training-status'))
      .then(r  => r.json())
      .then(setTrainingStatus)
      .catch(() => setTrainingStatus({ ready: false, errors: ['Backend not reachable'] }));
  }, []);

  // ── Google Analytics ────────────────────────────────────────────────
  useEffect(() => {
    loadGA(APP_NAME);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────
  const handleUploadStart = () => {
    // Clear previous file's review data immediately so stale sheets
    // never linger on screen while the new file is being scanned.
    setUploadData(null);
    setSessionId('');
    setSelected([]);
  };

  const handleUploadSuccess = (data) => {
    setUploadData(data);
    setSessionId(data.session_id);
    setSelected(data.pcp_sheets.map(s => s.key));
    // Review appears below the upload card on the same step — no step change
  };

  const handleReset = () => {
    setCurrentStep(0);
    setUploadData(null);
    setSessionId('');
    setSelected([]);
    setLanguage('english');
    setGeneratePhase('idle');
  };

  // ── Per-step tracker status (Upload / Review / Generate / Results) ─
  const stepStatuses = {
    upload:   uploadData ? 'completed' : 'active',
    review:   currentStep === 1 ? 'completed' : (uploadData ? 'active' : 'waiting'),
    generate: currentStep === 0 ? 'waiting' : (generatePhase === 'done' ? 'completed' : 'active'),
    results:  currentStep === 0 ? 'waiting' : (generatePhase === 'done' ? 'active' : 'waiting'),
  };

  // ── Render ────────────────────────────────────────────────────────
  if (view === 'landing') {
    return <LandingPage onStart={() => setView('app')} />;
  }

  return (
    <AppShell
      steps={STEPS}
      stepStatuses={stepStatuses}
      trainingStatus={trainingStatus}
      onReset={handleReset}
      onHome={() => setView('landing')}
      onHowItWorks={() => {
        window.location.hash = 'how-it-works';
        setView('landing');
      }}
    >
      {/* Step 0 — Upload & Review (merged: review appears below the upload card) */}
      {currentStep === 0 && (
        <div className="space-y-6">
          <UploadStep
            uploadData={uploadData}
            onUploadStart={handleUploadStart}
            onUploadSuccess={handleUploadSuccess}
          />
          {uploadData && (
            <ReviewStep
              key={sessionId}
              uploadData={uploadData}
              sessionId={sessionId}
              selected={selected}
              onSelectionChange={setSelected}
              language={language}
              onLanguageChange={setLanguage}
              onContinue={() => setCurrentStep(1)}
            />
          )}
        </div>
      )}

      {/* Step 1 — Generate & Results (merged: results appear on the same step) */}
      {currentStep === 1 && (
        <GenerateStep
          sessionId={sessionId}
          selected={selected}
          language={language}
          trainingReady={trainingStatus?.ready ?? false}
          onBack={() => setCurrentStep(0)}
          onPhaseChange={setGeneratePhase}
        />
      )}
    </AppShell>
  );
}
