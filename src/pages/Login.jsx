import { useState } from 'react';
import { useStore } from '../store.js';

export function Login() {
    const signIn = useStore((s) => s.signIn);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorText, setErrorText] = useState('');

    const onSubmit = async (e) => {
        e.preventDefault();
        setErrorText('');
        setIsSubmitting(true);

        try {
            const result = await signIn(email.trim(), password);
            if (!result.ok) {
                setErrorText(result.error?.message || 'Unable to sign in.');
                return;
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-obsidian text-white flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-slate-dark border border-white/10 rounded-3xl p-7 shadow-card">
                <h1 className="text-2xl font-bold mb-2">SLF Rolodex</h1>
                <p className="text-sm text-gray-400 mb-6">Sign in to continue</p>

                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 uppercase tracking-widest">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full mt-1 bg-obsidian border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald transition-colors"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-gray-400 uppercase tracking-widest">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            className="w-full mt-1 bg-obsidian border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald transition-colors"
                        />
                    </div>

                    {errorText && (
                        <p className="text-sm text-red-400">{errorText}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-emerald hover:bg-emerald/90 text-obsidian font-bold rounded-xl py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Please wait...' : 'Sign In'}
                    </button>
                </form>
                <p className="mt-4 text-sm text-gray-400">
                    Accounts are created by an admin in User Management.
                </p>
            </div>
        </div>
    );
}
