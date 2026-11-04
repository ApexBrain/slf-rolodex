import { X } from 'lucide-react';
import { useStore } from '../store.js';

export function Toast() {
    const toast = useStore((s) => s.toast);
    const dismiss = useStore((s) => s.dismissToast);
    if (!toast) return null;

    const tone = toast.type === 'error' ? 'border-red-500/50 text-red-200' : 'border-white/10 text-white';
    return (
        <div role="alert" aria-live="assertive" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
            <div className={`flex items-center gap-3 bg-slate-dark border rounded-full pl-5 pr-3 py-3 shadow-heavy ${tone}`}>
                <span className="text-sm font-medium">{toast.message}</span>
                <button onClick={dismiss} aria-label="Dismiss" className="p-1 rounded-full hover:bg-white/10 cursor-pointer">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
