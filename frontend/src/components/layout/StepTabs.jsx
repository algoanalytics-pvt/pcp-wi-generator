const UploadIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const EyeIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const GearIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ResultsIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
  </svg>
);

const STEP_ICONS = {
  upload:   UploadIcon,
  review:   EyeIcon,
  generate: GearIcon,
  results:  ResultsIcon,
};

const CheckIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const ClockIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
  </svg>
);

const STATUS_STYLES = {
  completed: {
    card:   'border-border bg-surface',
    circle: 'bg-success/15 text-success',
    badge:  'bg-success text-white',
    pill:   'bg-success/15 text-success',
    pillIcon: <CheckIcon />,
    pillLabel: 'Completed',
  },
  active: {
    card:   'border-accent bg-accent/5 shadow-sm',
    circle: 'bg-accent text-white',
    badge:  'bg-accent text-white',
    pill:   'bg-accent/15 text-accent',
    pillIcon: <span className="w-1.5 h-1.5 rounded-full bg-accent" />,
    pillLabel: 'Active',
  },
  waiting: {
    card:   'border-border bg-surface',
    circle: 'bg-surface-2 text-muted',
    badge:  'bg-surface-2 text-muted border border-border',
    pill:   'bg-surface-2 text-muted',
    pillIcon: <ClockIcon />,
    pillLabel: 'Waiting',
  },
};

export default function StepTabs({ steps, stepStatuses }) {
  return (
    <div className="flex items-stretch gap-3 px-6 py-5 bg-canvas overflow-x-auto">
      {steps.map((step, idx) => {
        const status = stepStatuses?.[step.id] || 'waiting';
        const style  = STATUS_STYLES[status];
        const Icon   = STEP_ICONS[step.id];
        const prevCompleted = idx > 0 && stepStatuses?.[steps[idx - 1].id] === 'completed';

        return (
          <div key={step.id} className="flex items-center flex-1 min-w-[260px]">
            <div className={`relative flex-1 rounded-2xl border-2 p-6 transition-colors duration-200 ${style.card}`}>
              <div className="flex items-start gap-4">
                <div className="relative w-16 h-16 shrink-0">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${style.circle}`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className={`absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${style.badge}`}>
                    {idx + 1}
                  </div>
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="text-xl font-bold text-ink leading-tight truncate">{step.label}</p>
                  <p className="text-sm text-muted leading-tight mt-1 truncate">{step.sub}</p>
                </div>
              </div>
              <span className={`mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${style.pill}`}>
                {style.pillIcon}
                {style.pillLabel}
              </span>
            </div>

            {idx < steps.length - 1 && (
              <div className="relative w-6 md:w-10 h-px mx-2 shrink-0 hidden sm:block">
                <div className={`w-full h-px border-t border-dashed ${prevCompleted ? 'border-success/50' : 'border-border'}`} />
                <span className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${prevCompleted ? 'bg-success' : 'bg-border'}`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
