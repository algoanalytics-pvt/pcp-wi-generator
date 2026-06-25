export default function Card({ children, className = '', padding = true }) {
  return (
    <div
      className={`bg-surface border border-border rounded-2xl shadow-sm ${
        padding ? 'p-6' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
