import { useRef, useState } from 'react';

export default function UploadStep({ onUploadSuccess }) {
  const inputRef  = useRef(null);
  const [dragging, setDragging]   = useState(false);
  const [loading,  setLoading]    = useState(false);
  const [fileName, setFileName]   = useState('');
  const [error,    setError]      = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
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
    } finally {
      setLoading(false);
    }
  };

  const onInputChange = (e) => handleFile(e.target.files[0]);
  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <section>
      <div className="step-label">
        <span className="step-num">1</span> Upload PCP File
      </div>

      <div
        className={`upload-zone ${dragging ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onInputChange}
          style={{ display: 'none' }}
        />
        <div className="upload-icon">📂</div>
        {loading ? (
          <>
            <div className="upload-title" style={{ color: '#E8521A' }}>🔍 Scanning sheets…</div>
            <div className="upload-sub">Detecting Process Control Plan blocks</div>
          </>
        ) : (
          <>
            <div className="upload-title">Drop your PCP Excel file here</div>
            <div className="upload-sub">Supports .xlsx · .xls · .csv — Click to browse</div>
          </>
        )}
        {fileName && !loading && (
          <div className="upload-file-name">📄 {fileName}</div>
        )}
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: 12 }}>
          ❌ {error}
        </div>
      )}
    </section>
  );
}
