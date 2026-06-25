const VARIANTS = {
  success:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning:  'bg-amber-50 text-amber-700 border border-amber-200',
  error:    'bg-red-50 text-red-600 border border-red-200',
  info:     'bg-indigo-50 text-indigo-700 border border-indigo-200',
  orange:   'bg-orange-50 text-orange-700 border border-orange-200',
  gray:     'bg-gray-100 text-gray-600 border border-gray-200',
  indigo:   'bg-indigo-600 text-white',
};

export default function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
