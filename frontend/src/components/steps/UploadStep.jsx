import { useRef, useState } from 'react';
import Button from '../ui/Button';
import Card   from '../ui/Card';

const FileDocIcon = () => (
  <svg className="w-12 h-12 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const UploadCloudIcon = () => (
  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

export default function UploadStep({ onUploadSuccess, uploadData, onRemove }) {
  const inputRef            = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [fileName, setFileName] = useState(uploadData?.file_name || '');
  const [fileSize, setFileSize] = useState('');
  const [error,    setError]    = useState('');

  const alreadyUploaded = !!uploadData;

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setFileSize((file.size / 1024 / 1024).toFixed(1) + ' MB');
    setError('');
    setLoading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res  = await fetch('/api/upload-pcp', { method: 'POST', body: form });
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

  // ── Uploaded state ──────────────────────────────────────────────────
  if (alreadyUploaded && !loading) {
    return (
      <Card>
        <div className="flex flex-col items-center py-8 gap-4">
          {/* File icon */}
          <div className="w-20 h-20 rounded-2xl bg-success/10 flex items-center justify-center">
            <FileDocIcon />
          </div>

          {/* File info */}
          <div className="text-center">
            <p className="font-bold text-ink text-base">{fileName}</p>
            {fileSize && <p className="text-sm text-muted mt-0.5">{fileSize}</p>}
            <p className="text-sm text-success font-medium mt-2">✓ File uploaded successfully</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => {
                onRemove();
                setFileName('');
                setFileSize('');
              }}
              className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors border border-border bg-surface hover:bg-surface-2 px-3.5 py-1.5 rounded-lg font-semibold"
            >
              <XIcon />
              Remove
            </button>
            <Button variant="primary" size="md" onClick={() => onUploadSuccess(uploadData)}>
              Continue <ArrowRightIcon />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // ── Drop zone ───────────────────────────────────────────────────────
  return (
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
  );
}
