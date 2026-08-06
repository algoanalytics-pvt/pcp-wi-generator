export default function WIPreview({ wiData }) {
  const h            = wiData?.header || wiData?.document || {};
  const instructions = wiData?.detailed_work_instructions || [];
  const tooling      = wiData?.tooling_equipments || wiData?.tooling_equipment || [];
  const qp           = wiData?.quality_parameters || {};
  const incoming     = Array.isArray(qp) ? [] : (qp.incoming || []);
  const finished     = Array.isArray(qp) ? [] : (qp.finished  || []);
  const rework       = wiData?.rework_instructions || [];
  const logistics    = wiData?.logistics || [];
  const parts        = wiData?.part_details || [];

  const headerFields = [
    { label: 'Factory / Area',     value: h.line_area || h.factory_line_area },
    { label: 'Stage',              value: h.stage_no },
    { label: 'WI No.',             value: h.work_instruction_no || h.wi_number },
    { label: 'Machine / Equipment',value: h.machine_equipment },
    { label: 'Stage Name',         value: h.stage_name },
    { label: 'Rev No.',            value: h.revision_no },
    { label: 'Part No.',           value: h.part_no },
    { label: 'Cycle Time',         value: h.cycle_time },
    { label: 'Rev Date',           value: h.revision_date },
  ];

  return (
    <div className="text-sm">
      {/* Header grid */}
      <div className="grid grid-cols-3 gap-3 bg-surface-2 rounded-xl p-4 mb-4 border border-border">
        {headerFields.map(({ label, value }) => (
          <div key={label}>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{label}</p>
            <p className="text-xs text-ink mt-0.5">{value || '—'}</p>
          </div>
        ))}
        <div className="col-span-3">
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Part Name</p>
          <p className="text-xs text-ink mt-0.5">{h.part_name || '—'}</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-[1fr_2fr] gap-4">
        {/* Left column */}
        <div className="space-y-3">
          {/* Process Image placeholder */}
          <div className="border border-border rounded-xl p-3">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
              🖼 Process Reference Image
            </p>
            <div className="h-36 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted/50 text-xs">
              Insert part image here
            </div>
          </div>
          {wiData?.process_note && (
            <div className="flex items-start gap-2 bg-info/10 border border-info/20 text-info text-xs rounded-xl px-3 py-2">
              <span>📌</span>
              <span>{wiData.process_note}</span>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-3">
          {instructions.length > 0 && (
            <Section title="📋 Detailed Work Instructions">
              <ol className="list-decimal list-outside pl-4 space-y-1">
                {instructions.map((step, i) => (
                  <li key={i} className="text-ink leading-relaxed">{step}</li>
                ))}
              </ol>
            </Section>
          )}

          {tooling.length > 0 && (
            <Section title="🔧 Tooling / Equipment">
              <ol className="list-decimal list-outside pl-4 space-y-1">
                {tooling.map((t, i) => <li key={i} className="text-ink">{t}</li>)}
              </ol>
            </Section>
          )}

          {(incoming.length > 0 || finished.length > 0) && (
            <Section title="✅ Quality Parameters">
              {incoming.length > 0 && (
                <>
                  <p className="text-xs text-muted italic mb-1">Incoming:</p>
                  <ol className="list-decimal list-outside pl-4 space-y-1 mb-2">
                    {incoming.map((q, i) => <li key={i} className="text-ink">A{i + 1}) {q}</li>)}
                  </ol>
                </>
              )}
              {finished.length > 0 && (
                <>
                  <p className="text-xs text-muted italic mb-1">Finished:</p>
                  <ol className="list-decimal list-outside pl-4 space-y-1">
                    {finished.map((q, i) => <li key={i} className="text-ink">B{i + 1}) {q}</li>)}
                  </ol>
                </>
              )}
            </Section>
          )}

          {logistics.length > 0 && (
            <Section title="🚛 Logistics">
              <ul className="list-disc list-outside pl-4 space-y-1">
                {logistics.map((item, i) => <li key={i} className="text-ink">{item}</li>)}
              </ul>
            </Section>
          )}
        </div>
      </div>

      {/* Rework table */}
      {rework.length > 0 && (
        <Section title="🔁 Rework Instructions" className="mt-4">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left pb-2 border-b-2 border-border text-muted uppercase tracking-wider font-bold w-40">Defect</th>
                <th className="text-left pb-2 border-b-2 border-border text-muted uppercase tracking-wider font-bold">Corrective Action</th>
              </tr>
            </thead>
            <tbody>
              {rework.map((rw, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4">
                    <span className="inline-block bg-warning/10 text-warning rounded-md px-2 py-0.5 text-[11px] font-semibold">
                      {typeof rw === 'object' ? rw.defect : ''}
                    </span>
                  </td>
                  <td className="py-2 text-ink">
                    {typeof rw === 'object' ? (rw.rework || rw.action) : String(rw)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Parts table */}
      {parts.length > 0 && (
        <Section title="📦 Part Details" className="mt-4">
          <table className="w-full text-xs">
            <thead>
              <tr>
                {['Sr.', 'Part No.', 'Part Description', 'Qty'].map(h => (
                  <th key={h} className="text-left pb-2 border-b-2 border-border text-muted uppercase tracking-wider font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parts.map((p, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4 text-muted">{p.sr_no ?? i + 1}</td>
                  <td className="py-2 pr-4 text-ink font-medium">{p.part_no}</td>
                  <td className="py-2 pr-4 text-ink">{p.part_description || p.description}</td>
                  <td className="py-2 text-muted">{p.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Legend */}
      <div className="mt-4 p-3 border border-border rounded-xl bg-surface-2">
        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Footer Legend</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {[
            "🚫 Don't Twist", "🔩 Specified Torque", "⚠️ Important Point",
            "🔧 Make Adjustment", "🧴 Apply Adhesive", "🛢️ Lubricate with Oil",
            "🟡 Lubricate with Grease", "🔵 Apply Sealant", "⭐ Vital Parts",
          ].map((item) => (
            <span key={item} className="text-[11px] text-muted">{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, className = '' }) {
  return (
    <div className={`border border-border rounded-xl p-3 ${className}`}>
      <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  );
}
