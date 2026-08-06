import Sidebar  from './Sidebar';
import StepTabs from './StepTabs';
import logoIcon from '../../assets/logo-icon.png';

const ResetIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const HelpIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export default function AppShell({
  steps,
  stepStatuses,
  trainingStatus,
  onReset,
  onHome,
  onHowItWorks,
  children,
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Sidebar */}
      <Sidebar onHome={onHome} />

      {/* Main panel */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header — single compact bar, no redundant page title below it */}
        <header className="flex items-center justify-between gap-4 px-4 md:px-6 py-4 bg-canvas border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logoIcon} alt="PCP → WI GEN" className="w-12 h-12 object-contain shrink-0" />
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-ink leading-tight truncate">PCP → Work Instruction Generator</h1>
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-3 shrink-0">
            {trainingStatus && (
              <div
                className={`flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-full border ${
                  trainingStatus.ready
                    ? 'text-success bg-success/10 border-success/25'
                    : 'text-danger bg-danger/10 border-danger/25'
                }`}
                title={trainingStatus.ready ? 'Training data loaded' : trainingStatus.errors?.join(' | ')}
              >
                <span>{trainingStatus.ready ? '✓' : '⚠'}</span>
                <span>{trainingStatus.ready ? 'Training Ready' : 'Training Missing'}</span>
              </div>
            )}
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 text-sm font-semibold text-ink bg-surface hover:bg-surface-2 px-4 py-2 rounded-full transition-all duration-150 border border-border"
            >
              <ResetIcon />
              Reset
            </button>
          </div>
        </header>

        {/* Step tabs */}
        <StepTabs steps={steps} stepStatuses={stepStatuses} />

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-canvas">
          <div className="w-full px-6 py-6">
            <div className="animate-fade-in">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
