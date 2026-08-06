const VARIANTS = {
  success: 'bg-success/10 text-success border border-success/25',
  warning: 'bg-warning/10 text-warning border border-warning/25',
  error:   'bg-danger/10 text-danger border border-danger/25',
  info:    'bg-info/10 text-info border border-info/25',
  gray:    'bg-surface-2 text-muted border border-border',
};

export default function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
