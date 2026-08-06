import { useRef, useState } from 'react';
import Card from '../ui/Card';
import { apiUrl } from '../../api';

const FileDocIcon = () => (
  <svg className="w-12 h-12 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const UploadCloudIcon = () => (
  <svg className="w-10 h-10 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const ChangeFileIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const LayersIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V4.804z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
  </svg>
);

const GET_ITEMS = [
  'Clear, step-by-step Work Instructions',
  'Operator-friendly format',
  'Images, safety & quality checkpoints',
  'Ready to share with the shop floor',
];

function WhatYouGetPanel() {
  return (
    <Card className="bg-info/5 border-info/20">
      <p className="text-xs font-bold text-info uppercase tracking-widest mb-3">What you'll get</p>
      <ul className="space-y-2.5">
        {GET_ITEMS.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <span className="w-4.5 h-4.5 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0 mt-0.5">
              <CheckIcon />
            </span>
            <span className="text-sm text-ink leading-snug">{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const STAT_TONES = {
  accent:  'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
};

function StatPill({ icon, value, label, tone }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${STAT_TONES[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-ink leading-tight">{value}</p>
        <p className="text-xs text-muted leading-tight truncate">{label}</p>
      </div>
    </div>
  );
}

function QuickGuidePanel() {
  const steps = [
    { title: 'Upload', desc: 'Upload your PCP Excel file' },
    { title: 'Review', desc: 'Pick sheets & instruction language' },
    { title: 'Generate', desc: 'AI processes every sheet' },
    { title: 'Download', desc: 'Get ready-to-print Work Instructions' },
  ];
  return (
    <Card>
      <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">Quick Guide</p>
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{s.title}</p>
              <p className="text-xs text-muted leading-snug">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default function UploadStep({ onUploadSuccess, onUploadStart, uploadData }) {
  const inputRef            = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [fileName, setFileName] = useState(uploadData?.file_name || '');
  const [fileSize, setFileSize] = useState('');
  const [error,    setError]    = useState('');

  const alreadyUploaded = !!uploadData;

  const handleFile = async (file) => {
    if (!file) return;
    onUploadStart?.();
    setFileName(file.name);
    setFileSize((file.size / 1024 / 1024).toFixed(1) + ' MB');
    setError('');
    setLoading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res  = await fetch(apiUrl('/upload-pcp'), { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      onUploadSuccess(data);
    } catch (e) {
      setError(e.message);
      setFileName('');
    } finally {
      setLoading(false);
    }
  };

  const onInputChange = (e) => handleFile(e.target.files[0]);
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // ── Uploaded state — drop zone stays for swapping files, stats + review appear alongside ──
  if (alreadyUploaded && !loading) {
    const totalPcp    = uploadData?.total_pcp    ?? 0;
    const totalNonPcp = uploadData?.total_non_pcp ?? 0;
    const totalSheets = totalPcp + totalNonPcp;

    return (
      <Card>
        <div className="grid lg:grid-cols-5 gap-6 items-stretch">
          <div
            className={`lg:col-span-2 relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
              dragging
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-accent hover:bg-surface-2'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onInputChange}
              className="hidden"
            />
            <UploadCloudIcon />
            <div className="text-center">
              <p className="font-semibold text-ink text-sm">Drag & drop your PCP Excel file here</p>
              <p className="text-xs text-muted mt-1">Supports .xlsx, .xls, .csv</p>
              <button
                type="button"
                className="mt-3 text-sm text-accent font-semibold hover:text-accent-strong transition-colors border border-accent/30 bg-accent/5 hover:bg-accent/10 px-3.5 py-1.5 rounded-lg"
              >
                Browse Files
              </button>
            </div>
          </div>

          <div className="lg:col-span-3 flex flex-col justify-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                <FileDocIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink text-base truncate">{fileName}</p>
                <p className="text-sm text-success font-medium mt-0.5">
                  ✓ Uploaded successfully{fileSize ? ` · ${fileSize}` : ''}
                </p>
              </div>
              <button
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors border border-border bg-surface hover:bg-surface-2 px-3.5 py-1.5 rounded-lg font-semibold shrink-0"
              >
                <ChangeFileIcon />
                Change File
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatPill icon={<LayersIcon />} value={totalSheets} label="Sheets Detected" tone="accent" />
              <StatPill icon={<CheckIcon />}  value={totalPcp}    label="Valid Sheets" tone="success" />
              <StatPill icon={<EyeOffIcon />} value={totalNonPcp} label="Hidden / Non-PCP" tone="warning" />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-danger/10 border border-danger/20 text-danger text-sm rounded-xl px-4 py-3">
                <span className="text-base">⚠️</span>
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // ── Drop zone ───────────────────────────────────────────────────────
  return (
    <div className="grid lg:grid-cols-3 gap-6 items-start">
      <div className="lg:col-span-2">
        <Card>
          <div
            className={`relative flex flex-col items-center justify-center gap-4 p-12 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
              dragging
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-accent hover:bg-surface-2'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !loading && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onInputChange}
              className="hidden"
            />

            {loading ? (
              <>
                <div className="w-12 h-12 rounded-full border-4 border-border border-t-accent animate-si-spin" />
                <div className="text-center">
                  <p className="font-semibold text-ink">Scanning sheets…</p>
                  <p className="text-sm text-muted mt-1">Detecting Process Control Plan blocks</p>
                </div>
              </>
            ) : (
              <>
                <UploadCloudIcon />
                <div className="text-center">
                  <p className="font-semibold text-ink">Drop your PCP Excel file here</p>
                  <p className="text-sm text-muted mt-1">Supports .xlsx · .xls · .csv</p>
                  <button
                    type="button"
                    className="mt-3 text-sm text-accent font-semibold hover:text-accent-strong transition-colors"
                  >
                    Browse files
                  </button>
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2.5 bg-danger/10 border border-danger/20 text-danger text-sm rounded-xl px-4 py-3">
              <span className="text-base">⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </Card>
      </div>
      <div className="space-y-4">
        <WhatYouGetPanel />
        <QuickGuidePanel />
      </div>
    </div>
  );
}
