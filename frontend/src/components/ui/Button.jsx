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
      'bg-ink text-white hover:brightness-110 active:scale-[0.98] active:opacity-85 focus-visible:ring-ink disabled:bg-border disabled:text-muted disabled:cursor-not-allowed shadow-sm',
    accent:
      'bg-accent text-white hover:bg-accent-strong active:scale-[0.98] focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-accent/25',
    secondary:
      'bg-surface text-accent border border-accent hover:bg-accent/5 active:scale-[0.98] focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed',
    ghost:
      'text-muted hover:text-ink hover:bg-surface-2 active:scale-[0.98] focus-visible:ring-border',
    danger:
      'bg-danger text-white hover:bg-danger/95 active:scale-[0.98] focus-visible:ring-danger disabled:opacity-50 disabled:cursor-not-allowed shadow-sm',
    success:
      'bg-success text-white hover:bg-success/95 active:scale-[0.98] focus-visible:ring-success disabled:opacity-50 disabled:cursor-not-allowed shadow-sm',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-6 py-3 text-base',
    xl: 'w-full px-6 py-3.5 text-base',
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
