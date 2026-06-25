import Sidebar from './Sidebar';
import Card    from '../ui/Card';

const MoonIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const ResetIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export default function AppShell({
  steps,
  currentStep,
  completedSteps,
  trainingStatus,
  onReset,
  children,
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Sidebar */}
      <Sidebar steps={steps} currentStep={currentStep} completedSteps={completedSteps} />

      {/* Main panel */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Thin top bar */}
        <header className="flex items-center justify-between px-5 h-11 bg-surface border-b border-border shrink-0">
          {/* Left: breadcrumb */}
          <div className="flex items-center gap-3">
            <button className="text-muted hover:text-ink transition-colors p-1 rounded">
              <MenuIcon />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-accent to-accent-strong flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-ink">Process Control Plan → Work Instruction Generator</span>
              <span className="text-border text-sm">·</span>
              <span className="text-xs text-muted">Converts PCP Excel sheets to operator Work Instructions</span>
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-3">
            {trainingStatus && (
              <div
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                  trainingStatus.ready
                    ? 'text-success bg-success/10 border border-success/20'
                    : 'text-danger bg-danger/10 border border-danger/20'
                }`}
                title={trainingStatus.ready ? 'Training data loaded' : trainingStatus.errors?.join(' | ')}
              >
                <span>{trainingStatus.ready ? '✓' : '⚠'}</span>
                <span>{trainingStatus.ready ? 'Training Ready' : 'Training Missing'}</span>
              </div>
            )}
            <button className="text-muted hover:text-ink transition-colors p-1.5 rounded-lg hover:bg-surface-2">
              <MoonIcon />
            </button>
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink bg-surface-2 hover:bg-border px-3 py-1.5 rounded-lg transition-all duration-150 border border-border"
            >
              <ResetIcon />
              Reset
            </button>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-canvas">
          <div className="max-w-3xl mx-auto px-6 py-8">
            {/* Page header */}
            <Card className="mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 leading-tight">Process Control Plan → Work Instruction Generator</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Extract manufacturing guidelines and tasks from PCPs to generate detailed operator Work Instructions.</p>
                </div>
              </div>
            </Card>

            {/* Step content */}
            <div className="animate-fade-in">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
