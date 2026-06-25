export default function TopBar({ trainingStatus }) {
  const ready = trainingStatus?.ready;
  return (
    <header className="topbar">
      <div className="topbar-logo">SI</div>
      <div>
        <div className="topbar-name">Sharada Industries</div>
        <div className="topbar-sub">PCP → Work Instruction Generator</div>
      </div>
      {trainingStatus && (
        <div
          className="topbar-badge"
          title={ready ? 'Training data loaded' : trainingStatus.errors?.join(' | ')}
          style={ready ? {} : { background: '#fff0f0', borderColor: '#f5a9a9', color: '#c0392b' }}
        >
          {ready ? '✅ Training Ready' : '⚠️ Training Missing'}
        </div>
      )}
    </header>
  );
}
