export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 select-none';

  const variants = {
    primary:
      'bg-accent text-white hover:bg-accent-strong active:scale-[0.98] focus-visible:ring-accent disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm shadow-accent/20',
    secondary:
      'bg-surface text-ink border border-border hover:bg-surface-2 active:scale-[0.98] focus-visible:ring-border disabled:opacity-50 disabled:cursor-not-allowed',
    ghost:
      'text-muted hover:text-ink hover:bg-surface-2 active:scale-[0.98] focus-visible:ring-border',
    danger:
      'bg-danger text-white hover:bg-danger/95 active:scale-[0.98] focus-visible:ring-danger disabled:opacity-50 disabled:cursor-not-allowed shadow-sm',
    success:
      'bg-success text-white hover:bg-success/95 active:scale-[0.98] focus-visible:ring-success disabled:opacity-50 disabled:cursor-not-allowed shadow-sm',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-sm',
    xl: 'w-full px-6 py-3.5 text-sm',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
