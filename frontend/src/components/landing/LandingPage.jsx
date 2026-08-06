import { useEffect, useRef } from 'react';
import Button from '../ui/Button';
import logo from '../../assets/logo-app.png';
import logoSharada from '../../assets/logo-sharada.png';

// ── Icons ───────────────────────────────────────────────────────────────
const DocIcon = ({ className = '' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ArrowIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

const UploadIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
  </svg>
);

const BoltIcon = () => (
  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
  </svg>
);

const SparkleIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l1.8 5.6L19.5 9l-5.7 1.4L12 16l-1.8-5.6L4.5 9l5.7-1.4L12 2zM19 15l.9 2.6L22.5 18l-2.6.9L19 21.5l-.9-2.6L15.5 18l2.6-.9L19 15zM5 15l.7 2 2 .7-2 .7L5 20.4l-.7-2-2-.7 2-.7L5 15z" />
  </svg>
);

const CheckPill = ({ children }) => (
  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success bg-success/10 rounded-full px-2.5 py-1">
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
    {children}
  </span>
);

const CloudUploadIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 11v6m0-6l-2.5 2.5M12 11l2.5 2.5" />
  </svg>
);

const DocSearchIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h9a2 2 0 002-2v-6M9 4h6l4 4M9 4v4h4" />
    <circle cx="11" cy="15" r="2.5" />
    <path strokeLinecap="round" d="M13.2 17.2L15 19" />
  </svg>
);

const DownloadTrayIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v10m0 0l-3.5-3.5M12 14l3.5-3.5M5 17v1a2 2 0 002 2h10a2 2 0 002-2v-1" />
  </svg>
);

const ChevronRightIcon = ({ className = 'w-4 h-4 text-white/20 shrink-0' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const ImagePlaceholderIcon = () => (
  <svg className="w-5 h-5 text-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 16l-5.5-5.5L3 20" />
  </svg>
);

// Large outline document + gear, used as a faint watermark behind the headline
const DocGearWatermark = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M50 20h60l30 30v120a6 6 0 01-6 6H56a6 6 0 01-6-6V26a6 6 0 016-6z" />
    <path d="M110 20v30h30" />
    <path d="M66 90h60M66 108h60M66 126h40" />
    <g transform="translate(120,130)">
      <circle r="34" />
      <circle r="12" />
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * Math.PI) / 4;
        const x1 = Math.cos(angle) * 34;
        const y1 = Math.sin(angle) * 34;
        const x2 = Math.cos(angle) * 44;
        const y2 = Math.sin(angle) * 44;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
    </g>
  </svg>
);

// ── Hero background: subtle industrial-themed decoration, all non-interactive ──
const HeroBackground = () => (
  <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
    {/* Faint blueprint grid */}
    <div
      className="absolute inset-0 opacity-[0.05]"
      style={{
        backgroundImage:
          'linear-gradient(var(--color-ink) 1px, transparent 1px), linear-gradient(90deg, var(--color-ink) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    />
    {/* Dotted accents, upper right */}
    <div
      className="absolute top-6 right-10 w-80 h-80 opacity-[0.07]"
      style={{
        backgroundImage: 'radial-gradient(circle, var(--color-ink) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }}
    />
    {/* Soft orange/brown gradient blobs */}
    <div className="absolute -top-28 -left-20 w-[32rem] h-[32rem] bg-accent/[0.08] rounded-full blur-3xl" />
    <div className="absolute top-1/4 -right-16 w-[26rem] h-[26rem] bg-warning/[0.07] rounded-full blur-3xl" />
    <div className="absolute -bottom-20 left-1/4 w-[24rem] h-[24rem] bg-info/[0.06] rounded-full blur-3xl" />
    {/* Thin connecting lines with node dots */}
    <svg className="absolute inset-0 w-full h-full opacity-[0.07]" preserveAspectRatio="none">
      <line x1="4%" y1="20%" x2="30%" y2="48%" stroke="var(--color-ink)" strokeWidth="1" />
      <line x1="55%" y1="12%" x2="82%" y2="34%" stroke="var(--color-ink)" strokeWidth="1" />
      <line x1="70%" y1="70%" x2="94%" y2="52%" stroke="var(--color-ink)" strokeWidth="1" />
      <circle cx="30%" cy="48%" r="3" fill="var(--color-accent)" />
      <circle cx="82%" cy="34%" r="3" fill="var(--color-accent)" />
      <circle cx="70%" cy="70%" r="3" fill="var(--color-accent)" />
    </svg>
    {/* Soft document + gear outline behind the headline */}
    <DocGearWatermark className="hidden md:block absolute -top-16 -left-10 w-[26rem] h-[26rem] text-ink opacity-[0.06]" />
  </div>
);

// ── Static copy ───────────────────────────────────────────────────────────
const FEATURES = [
  { icon: <BoltIcon />, title: 'AI-Powered', desc: 'Detects stages automatically.' },
  { icon: <ShieldIcon />, title: 'Operator Ready', desc: 'Clear steps & safety checks.' },
  { icon: <ClockIcon />, title: 'Time Saving', desc: 'Seconds, not hours.' },
];

const HOW_IT_WORKS = [
  { icon: <CloudUploadIcon className="w-7 h-7" />, title: 'Upload', desc: 'Upload your PCP Excel file.' },
  { icon: <DocSearchIcon className="w-7 h-7" />, title: 'Review', desc: 'Confirm sheets & preferences.' },
  { icon: <SparkleIcon className="w-7 h-7" />, title: 'Generate', desc: 'AI creates the instructions.' },
  { icon: <DownloadTrayIcon className="w-7 h-7" />, title: 'Download', desc: 'Get Word & Excel files.' },
];

// ── Hero illustration: Excel → AI Processing → Work Instruction ─────────
function HeroIllustration() {
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute w-[26rem] h-[26rem] bg-accent/10 rounded-full blur-3xl" />

      {/* Decorative accents */}
      <SparkleIcon className="hidden md:block absolute top-2 right-6 w-6 h-6 text-accent/40" />
      <div className="hidden md:grid absolute top-10 right-0 grid-cols-3 gap-1.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="w-1 h-1 rounded-full bg-accent/25" />
        ))}
      </div>

      <div className="relative flex items-center gap-4 md:gap-5">
        {/* PCP Excel card */}
        <div className="w-40 md:w-44 shrink-0 rounded-2xl bg-surface border border-border shadow-lg p-4">
          <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center text-success font-bold mb-3.5">
            X
          </div>
          <p className="text-justify text-base font-bold text-ink mb-3">PCP Excel</p>
          <div className="h-2 w-4/5 rounded bg-border mb-1.5" />
          <div className="h-2 w-3/5 rounded bg-border mb-1.5" />
          <div className="h-2 w-2/5 rounded bg-border mb-3.5" />
          <CheckPill>File Uploaded</CheckPill>
        </div>

        {/* Connector + AI processing */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <ArrowIcon className="w-5 h-5 text-accent/50 hidden md:block" />
          <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/30">
            <SparkleIcon className="w-6 h-6" />
          </div>
          <p className="text-justify text-sm font-bold text-ink whitespace-nowrap">AI Processing</p>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent/40" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent/40" />
          </div>
          <ArrowIcon className="w-5 h-5 text-accent/50 hidden md:block" />
        </div>

        {/* Work Instruction card */}
        <div className="relative w-44 md:w-48 shrink-0 -mt-6 rounded-2xl bg-surface border border-border shadow-xl p-4">
          <p className="text-justify text-base font-bold text-ink mb-3">Work Instruction</p>
          <div className="h-14 rounded-lg bg-accent/10 mb-3 flex items-center justify-center">
            <DocIcon className="w-6 h-6 text-accent" />
          </div>
          <div className="h-2 w-full rounded bg-border mb-1.5" />
          <div className="h-2 w-3/5 rounded bg-border mb-3" />
          <div className="h-14 rounded-lg bg-surface-2 border border-border mb-3 flex items-center justify-center">
            <ImagePlaceholderIcon />
          </div>
          <CheckPill>Ready to Download</CheckPill>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function LandingPage({ onStart }) {
  const howRef      = useRef(null);
  const useCasesRef = useRef(null);

  useEffect(() => {
    if (window.location.hash === '#how-it-works' && howRef.current) {
      howRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return (
    <div className="h-screen w-full overflow-hidden bg-canvas flex flex-col">
      {/* Nav */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 md:px-6 py-4 pl-6 md:pl-10">
        <div className="relative w-[151px] h-12 overflow-hidden shrink-0">
          <img
            src={logo}
            alt="PCP Work Instruction Generator"
            className="absolute -top-[35px] -left-[23px] w-[188px] h-[125px] max-w-none"
          />
        </div>
        <img
          src={logoSharada}
          alt="Sharada"
          className="h-10 w-auto object-contain shrink-0"
        />
      </header>

      {/* Hero */}
      <main className="relative flex-1 min-h-0 flex items-center px-6 md:px-12 overflow-hidden">
        <HeroBackground />
        <div className="relative z-10 max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="relative">
              <DocGearWatermark className="hidden lg:block absolute -top-10 -left-8 w-72 h-72 text-ink opacity-[0.06] -z-10" />
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-ink leading-[1.1] tracking-tight">
                Transform Your PCP into{' '}
                <span className="text-accent">Operator-Ready Work Instructions</span>
              </h1>
            </div>
            <p className="text-justify mt-5 text-base md:text-lg text-muted leading-relaxed max-w-xl">
              Upload your Process Control Plan and let AI generate clear, step-by-step work instructions for the shop floor — in minutes, not hours.
            </p>

            <div ref={useCasesRef} className="mt-8 grid grid-cols-3 gap-5 max-w-xl">
              {FEATURES.map((f) => (
                <div key={f.title}>
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent mb-2.5">{f.icon}</div>
                  <p className="text-base font-bold text-ink">{f.title}</p>
                  <p className="text-sm text-muted mt-0.5 leading-snug">{f.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-3">
              <Button variant="accent" size="lg" onClick={onStart}>
                <UploadIcon /> Upload PCP Excel
              </Button>
            </div>
            <p className="text-justify mt-4 flex items-center gap-1.5 text-sm text-muted">
              <LockIcon /> Your data is secure and never shared
            </p>
          </div>

          <HeroIllustration />
        </div>
      </main>

      {/* How it works */}
      <section id="how-it-works" ref={howRef} className="shrink-0 border-t border-black/20 bg-ink">
        <div className="max-w-7xl mx-auto w-full px-6 md:px-12 py-10">
          <p className="text-center text-lg md:text-xl font-semibold text-white mb-8">
            Go from raw PCP sheet to shop-floor-ready instructions in{' '}
            <span className="text-accent">4 simple steps</span>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((s, i) => (
              <div
                key={s.title}
                className="relative bg-white rounded-2xl shadow-lg px-5 py-4 flex items-start gap-4 overflow-hidden"
              >
                <div className="relative w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  {s.icon}
                  <span className="absolute -top-1.5 -left-1.5 w-7 h-7 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center ring-2 ring-white">
                    {i + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-ink whitespace-nowrap">{s.title}</p>
                  <p className="text-sm text-muted mt-0.5 leading-snug">{s.desc}</p>
                </div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-6 -translate-y-1/2 w-6 h-6 items-center justify-center">
                    <ChevronRightIcon className="w-4 h-4 text-accent/70 shrink-0" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
