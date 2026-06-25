export default function WIPreview({ wiData }) {
  const h = wiData?.header || wiData?.document || {};
  const instructions = wiData?.detailed_work_instructions || [];
  const tooling = wiData?.tooling_equipments || wiData?.tooling_equipment || [];
  const qp = wiData?.quality_parameters || {};
  const incoming = Array.isArray(qp) ? [] : (qp.incoming || []);
  const finished  = Array.isArray(qp) ? [] : (qp.finished  || []);
  const rework  = wiData?.rework_instructions || [];
  const logistics = wiData?.logistics || [];
  const parts   = wiData?.part_details || [];

  return (
    <div className="wi-preview">
      <h2>🏢 SHARADA INDUSTRIES — WORK INSTRUCTIONS</h2>

      <div className="wi-header-grid">
        <div className="wi-header-item">
          <label>Factory / Area</label><br />
          <span>{h.line_area || h.factory_line_area || '—'}</span>
        </div>
        <div className="wi-header-item">
          <label>Stage</label><br />
          <span>{h.stage_no || '—'}</span>
        </div>
        <div className="wi-header-item">
          <label>WI No.</label><br />
          <span>{h.work_instruction_no || h.wi_number || '—'}</span>
        </div>
        <div className="wi-header-item">
          <label>Machine / Equipment</label><br />
          <span>{h.machine_equipment || '—'}</span>
        </div>
        <div className="wi-header-item">
          <label>Stage Name</label><br />
          <span>{h.stage_name || '—'}</span>
        </div>
        <div className="wi-header-item">
          <label>Rev No.</label><br />
          <span>{h.revision_no || '—'}</span>
        </div>
        <div className="wi-header-item">
          <label>Part No.</label><br />
          <span>{h.part_no || '—'}</span>
        </div>
        <div className="wi-header-item">
          <label>Cycle Time</label><br />
          <span>{h.cycle_time || '—'}</span>
        </div>
        <div className="wi-header-item">
          <label>Rev Date</label><br />
          <span>{h.revision_date || '—'}</span>
        </div>
        <div className="wi-header-item" style={{ gridColumn: '1 / -1' }}>
          <label>Part Name</label><br />
          <span>{h.part_name || '—'}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
        {/* Left */}
        <div>
          <div className="wi-section">
            <h3>🖼️ Process Reference Image</h3>
            <div style={{ height: 200, border: '2px dashed #aaa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 13, borderRadius: 8 }}>
              Insert part image here
            </div>
          </div>
          {wiData?.process_note && (
            <div className="alert alert-info">📌 {wiData.process_note}</div>
          )}
        </div>

        {/* Right */}
        <div>
          {instructions.length > 0 && (
            <div className="wi-section">
              <h3>📋 Detailed Work Instructions</h3>
              <ol>
                {instructions.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {tooling.length > 0 && (
            <div className="wi-section">
              <h3>🔧 Tooling / Equipment</h3>
              <ol>
                {tooling.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </div>
          )}

          {(incoming.length > 0 || finished.length > 0) && (
            <div className="wi-section">
              <h3>✅ Quality Parameters</h3>
              {incoming.length > 0 && (
                <>
                  <p style={{ fontStyle: 'italic', marginBottom: 6, fontSize: 12 }}>Incoming:</p>
                  <ol style={{ marginBottom: 10 }}>
                    {incoming.map((q, i) => <li key={i}>A{i + 1}) {q}</li>)}
                  </ol>
                </>
              )}
              {finished.length > 0 && (
                <>
                  <p style={{ fontStyle: 'italic', marginBottom: 6, fontSize: 12 }}>Finished:</p>
                  <ol>
                    {finished.map((q, i) => <li key={i}>B{i + 1}) {q}</li>)}
                  </ol>
                </>
              )}
            </div>
          )}

          {logistics.length > 0 && (
            <div className="wi-section">
              <h3>🚛 Logistics</h3>
              <ul>
                {logistics.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      {rework.length > 0 && (
        <div className="wi-section" style={{ marginTop: 14 }}>
          <h3>🔁 Rework Instructions</h3>
          <table className="rework-table">
            <thead>
              <tr>
                <th style={{ width: 180 }}>Defect</th>
                <th>Corrective Action</th>
              </tr>
            </thead>
            <tbody>
              {rework.map((rw, i) => (
                <tr key={i}>
                  <td><span className="defect-badge">{typeof rw === 'object' ? rw.defect : ''}</span></td>
                  <td>{typeof rw === 'object' ? (rw.rework || rw.action) : String(rw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {parts.length > 0 && (
        <div className="wi-section" style={{ marginTop: 14 }}>
          <h3>📦 Part Details</h3>
          <table className="rework-table">
            <thead>
              <tr><th>Sr.</th><th>Part No.</th><th>Part Description</th><th>Qty</th></tr>
            </thead>
            <tbody>
              {parts.map((p, i) => (
                <tr key={i}>
                  <td>{p.sr_no ?? i + 1}</td>
                  <td>{p.part_no}</td>
                  <td>{p.part_description || p.description}</td>
                  <td>{p.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="wi-section" style={{ marginTop: 14 }}>
        <h3>Footer Legend</h3>
        <div className="legend-bar">
          {['🚫 Don\'t Twist', '🔩 Specified Torque', '⚠️ Important Point',
            '🔧 Make Adjustment', '🧴 Apply Adhesive', '🛢️ Lubricate with Oil',
            '🟡 Lubricate with Grease', '🔵 Apply Sealant', '⭐ Vital Parts',
          ].map((item) => (
            <span key={item} className="legend-item">{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
