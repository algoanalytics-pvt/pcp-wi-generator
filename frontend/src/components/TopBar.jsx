export default function TopBar({ trainingStatus }) {
  const ready = trainingStatus?.ready;
  return (
    <header className="topbar">
      <div className="topbar-logo">PCP</div>
      <div>
        <div className="topbar-name">Process Control Plan → Work Instruction Generator</div>
        <div className="topbar-sub">Convert PCPs to Work Instructions</div>
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
