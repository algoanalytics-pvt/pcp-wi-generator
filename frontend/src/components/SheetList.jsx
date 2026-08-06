import { useState } from 'react';
import { apiUrl } from '../api';

function SheetPreview({ sessionId, sheetKey }) {
  const [html,    setHtml]    = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  const load = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/sheet-preview/${sessionId}/${encodeURIComponent(sheetKey)}`));
      const txt = await res.text();
      setHtml(txt);
      setLoaded(true);
    } catch {
      setHtml('<p><i>Preview failed.</i></p>');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sheet-preview-frame">
      {!loaded && !loading && (
        <button className="btn btn-sm btn-secondary" onClick={load}>Load preview</button>
      )}
      {loading && <span style={{ fontSize: 12, color: '#888' }}>Loading…</span>}
      {loaded && <div dangerouslySetInnerHTML={{ __html: html }} />}
    </div>
  );
}

function NonPCPExpander({ sheets, sessionId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState({});

  if (!sheets || sheets.length === 0) return null;

  const handleAdd = async (sheetName) => {
    setAdding((a) => ({ ...a, [sheetName]: true }));
    try {
      const res  = await fetch(apiUrl(`/add-non-pcp-as-wi/${sessionId}/${encodeURIComponent(sheetName)}`), { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      onAdded(sheetName, data);
    } catch (e) {
      alert(`Could not add sheet: ${e.message}`);
    } finally {
      setAdding((a) => ({ ...a, [sheetName]: false }));
    }
  };

  return (
    <div className="expander" style={{ marginBottom: 12 }}>
      <div className="expander-header" onClick={() => setOpen((o) => !o)}>
        <span>📂 {sheets.length} hidden sheet{sheets.length !== 1 ? 's' : ''} (not PCP) — click to add any as WI</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="expander-body">
          {sheets.map(({ sheet_name }) => (
            <div key={sheet_name} className="flex items-center justify-between" style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{sheet_name}</span>
              <button
                className="btn btn-sm btn-secondary"
                disabled={adding[sheet_name]}
                onClick={() => handleAdd(sheet_name)}
              >
                {adding[sheet_name] ? '…' : '➕ Add as WI'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SheetList({ uploadData, sessionId, selected, onSelectionChange }) {
  const [excluded,  setExcluded]  = useState(new Set());
  const [previewing, setPreviewing] = useState(new Set());
  const [sheets, setSheets] = useState(uploadData.pcp_sheets);
  const [nonPcp,  setNonPcp]  = useState(uploadData.non_pcp_sheets);

  const toggleExclude = (key) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const togglePreview = (key) => {
    setPreviewing((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleSelect = (key) => {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    onSelectionChange([...next]);
  };

  const handleNonPcpAdded = (sheetName, data) => {
    setSheets((prev) => [
      ...prev,
      { key: sheetName, meta: data.meta, columns: [] },
    ]);
    setNonPcp((prev) => prev.filter((s) => s.sheet_name !== sheetName));
    onSelectionChange([...selected, sheetName]);
  };

  const activeCount = sheets.filter((s) => !excluded.has(s.key)).length;
  const selectedActive = selected.filter((k) => !excluded.has(k));

  return (
    <div>
      <div className="alert alert-success">
        ✅ Found <strong>{sheets.length} Process Control Plan sheet{sheets.length !== 1 ? 's' : ''}</strong>
        {' '}→ <strong>{activeCount} WI{activeCount !== 1 ? 's' : ''} queued</strong>
        {nonPcp.length > 0 && <span style={{ marginLeft: 8, fontWeight: 400, color: '#555' }}> · {nonPcp.length} non-PCP sheet{nonPcp.length !== 1 ? 's' : ''} hidden</span>}
      </div>

      <NonPCPExpander sheets={nonPcp} sessionId={sessionId} onAdded={handleNonPcpAdded} />

      <div className="card">
        <div className="sheet-card-header">
          <span>📋 Detected PCP Sheets</span>
          <span className="queue-pill">✓ {selectedActive.length} WI{selectedActive.length !== 1 ? 's' : ''} queued</span>
        </div>

        {sheets.map(({ key, meta }) => {
          const isExcluded = excluded.has(key);
          const isSelected = selected.includes(key) && !isExcluded;
          const isPreviewing = previewing.has(key);
          const stageLabel = meta?.stage_label || key;
          const partName   = meta?.part_name   || '';
          const planNo     = meta?.plan_number  || '';

          return (
            <div key={key}>
              <div className="sheet-row">
                {/* Checkbox */}
                <div>
                  {!isExcluded ? (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(key)}
                      style={{ accentColor: '#E8521A', width: 16, height: 16, cursor: 'pointer' }}
                    />
                  ) : (
                    <span style={{ color: '#ccc', fontSize: 18 }}>☐</span>
                  )}
                </div>

                {/* Info */}
                <div>
                  {isExcluded ? (
                    <span style={{ color: '#bbb', fontSize: 13, textDecoration: 'line-through' }}>
                      {stageLabel} · {key} <span style={{ fontSize: 11 }}>(excluded)</span>
                    </span>
                  ) : (
                    <span>
                      <span className="stage-tag">{stageLabel}</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{key}</span>
                      {partName && <span style={{ color: '#888', fontSize: 11 }}> · {partName.slice(0, 60)}</span>}
                      {planNo   && <span style={{ color: '#aaa', fontSize: 11 }}> · {planNo.slice(0, 50)}</span>}
                    </span>
                  )}
                </div>

                {/* Preview toggle */}
                <button
                  className={`icon-btn ${isPreviewing ? 'active' : ''}`}
                  title="Preview sheet"
                  disabled={isExcluded}
                  onClick={() => togglePreview(key)}
                  style={isExcluded ? { opacity: .3 } : {}}
                >
                  👁
                </button>

                {/* Exclude / restore */}
                <button
                  className="icon-btn"
                  title={isExcluded ? 'Restore' : 'Exclude'}
                  onClick={() => toggleExclude(key)}
                  style={isExcluded ? { color: '#E8521A' } : {}}
                >
                  {isExcluded ? '↩' : '✕'}
                </button>
              </div>

              {/* Preview panel */}
              {isPreviewing && !isExcluded && (
                <div style={{ padding: '0 16px 12px' }}>
                  <SheetPreview sessionId={sessionId} sheetKey={key} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedActive.length > 0 && (
        <div className="alert alert-info" style={{ marginTop: 12 }}>
          <strong>{selectedActive.length} WI(s) queued:</strong>{' '}
          {selectedActive.slice(0, 8).join('  ·  ')}
          {selectedActive.length > 8 && ' …'}
        </div>
      )}
      {selectedActive.length === 0 && (
        <div className="alert alert-warning" style={{ marginTop: 12 }}>
          No PCPs selected — tick at least one above.
        </div>
      )}
    </div>
  );
}
