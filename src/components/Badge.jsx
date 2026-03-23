export function Badge({ label, variant = 'default', className = '' }) {
    const variants = {
        default: 'bg-gray-100 text-gray-600',
        a: 'bg-emerald-100 text-emerald-700',
        b: 'bg-blue-100 text-blue-700',
        c: 'bg-amber-100 text-amber-700',
        who: 'bg-violet-100 text-violet-700',
        deliver: 'bg-rose-100 text-rose-700',
        mail: 'bg-sky-100 text-sky-700',
        // Dark mode variants
        'a-dark': 'bg-emerald-500/15 text-emerald-400',
        'b-dark': 'bg-blue-500/15 text-blue-400',
        'c-dark': 'bg-amber-500/15 text-amber-400',
        'who-dark': 'bg-violet-500/15 text-violet-400',
        'deliver-dark': 'bg-rose-500/15 text-rose-400',
        'mail-dark': 'bg-sky-500/15 text-sky-400',
        'lime': 'bg-neon-lime text-jet',
        'outline': 'bg-transparent border border-white/20 text-white/60',
        'white': 'bg-white text-jet',
    };

    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase rounded-pill ${variants[variant] || variants.default} ${className}`}
        >
            {label}
        </span>
    );
}
