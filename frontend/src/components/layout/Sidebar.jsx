// Icon components as simple SVGs
const UploadIcon = ({ className = '' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12V3m0 0L8.5 6.5M12 3l3.5 3.5" />
  </svg>
);

const ReviewIcon = ({ className = '' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const GenerateIcon = ({ className = '' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const ResultsIcon = ({ className = '' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const CheckIcon = ({ className = '' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const STEP_ICONS = [UploadIcon, ReviewIcon, GenerateIcon, ResultsIcon];

export default function Sidebar({ steps, currentStep, completedSteps }) {
  return (
    <aside className="w-52 min-h-screen bg-navy flex flex-col shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-strong flex items-center justify-center shrink-0 shadow-md">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-white font-bold text-xs leading-tight tracking-wide uppercase">PCP → WI Gen</div>
          <div className="text-white/50 text-[9px] leading-tight mt-0.5 truncate">Work Instruction Generator</div>
        </div>
      </div>

      {/* Steps navigation */}
      <nav className="flex-1 px-3 py-5">
        <div className="flex flex-col gap-1">
          {steps.map((step, idx) => {
            const isActive    = idx === currentStep;
            const isCompleted = completedSteps.has(step.id);
            const isPending   = !isActive && !isCompleted;
            const Icon        = STEP_ICONS[idx];

            return (
              <div key={step.id} className="relative">
                {/* Connector line */}
                {idx < steps.length - 1 && (
                  <div
                    className={`absolute left-[22px] top-full w-px h-3 transition-colors duration-300 ${
                      isCompleted ? 'bg-success/60' : 'bg-white/15'
                    }`}
                    style={{ zIndex: 0 }}
                  />
                )}

                {/* Step row */}
                <div
                  className={`relative z-10 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-success shadow-lg shadow-success/40'
                      : 'hover:bg-navy-soft text-white/70 hover:text-white'
                  }`}
                >
                  {/* Icon / Check circle */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
                      isCompleted
                        ? 'bg-success text-white'
                        : isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-white/10 text-white/35'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckIcon className="w-3.5 h-3.5" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                  </div>

                  {/* Labels */}
                  <div className="min-w-0">
                    <div
                      className={`font-semibold text-xs leading-tight transition-colors duration-200 ${
                        isActive
                          ? 'text-white'
                          : isCompleted
                          ? 'text-success'
                          : 'text-white/40'
                      }`}
                    >
                      {step.label}
                    </div>
                    <div
                      className={`text-[10px] leading-tight mt-0.5 transition-colors duration-200 ${
                        isActive ? 'text-white/80' : isPending ? 'text-white/25' : 'text-white/45'
                      }`}
                    >
                      {step.sub}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
