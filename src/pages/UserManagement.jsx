import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store.js';

export function UserManagement() {
    const navigate = useNavigate();
    const users = useStore((s) => s.users);
    const fetchUsers = useStore((s) => s.fetchUsers);
    const createUserWithPassword = useStore((s) => s.createUserWithPassword);
    const updateUserRole = useStore((s) => s.updateUserRole);
    const updateUserPassword = useStore((s) => s.updateUserPassword);
    const setUserActive = useStore((s) => s.setUserActive);
    const deleteUser = useStore((s) => s.deleteUser);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('staff');
    const [isAdding, setIsAdding] = useState(false);
    const [passwordDrafts, setPasswordDrafts] = useState({});
    const [isSavingPasswordEmail, setIsSavingPasswordEmail] = useState('');
    const [errorText, setErrorText] = useState('');

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const onAddUser = async () => {
        if (!email.trim()) return;
        setErrorText('');
        setIsAdding(true);
        try {
            const result = await createUserWithPassword({ email, password, role });
            if (!result.ok) {
                setErrorText(result.error?.message || 'Unable to add user.');
                return;
            }
            setEmail('');
            setPassword('');
            setRole('staff');
        } finally {
            setIsAdding(false);
        }
    };

    const onSavePassword = async (targetEmail) => {
        const newPassword = (passwordDrafts[targetEmail] || '').trim();
        if (!newPassword) return;
        setIsSavingPasswordEmail(targetEmail);
        try {
            const result = await updateUserPassword({ email: targetEmail, newPassword });
            if (!result.ok) {
                setErrorText(result.error?.message || `Unable to update password for ${targetEmail}`);
                return;
            }
            setPasswordDrafts((prev) => ({ ...prev, [targetEmail]: '' }));
        } finally {
            setIsSavingPasswordEmail('');
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Dashboard
                </button>
                <h1 className="text-xl font-bold">User Management</h1>
            </div>

            <div className="bg-slate-dark border border-white/10 rounded-3xl p-5 space-y-4">
                <h2 className="text-sm uppercase tracking-widest text-gray-400 font-bold">Add User</h2>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_160px_auto] gap-3">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="staff@example.com"
                        className="bg-obsidian border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald"
                    />
                    <input
                        type="text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Initial password"
                        className="bg-obsidian border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald"
                    />
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="bg-obsidian border border-white/10 rounded-xl px-3 py-3 outline-none focus:border-emerald"
                    >
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button
                        onClick={onAddUser}
                        disabled={isAdding || !email.trim() || !password.trim()}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald text-obsidian font-bold hover:bg-emerald/90 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4" />
                        {isAdding ? 'Adding...' : 'Add User'}
                    </button>
                </div>
                {errorText && <p className="text-sm text-red-400">{errorText}</p>}
            </div>

            <div className="bg-slate-dark border border-white/10 rounded-3xl overflow-hidden">
                <div className="grid grid-cols-[1.3fr_120px_140px_1fr_80px] gap-3 px-5 py-3 bg-white/5 text-xs uppercase tracking-widest text-gray-400 font-bold">
                    <span>Email</span>
                    <span>Role</span>
                    <span>Status</span>
                    <span>Password</span>
                    <span className="text-right">Delete</span>
                </div>
                <div className="divide-y divide-white/5">
                    {users.map((u) => (
                        <div key={u.id} className="grid grid-cols-[1.3fr_120px_140px_1fr_80px] gap-3 px-5 py-4 items-center">
                            <span className="text-sm text-white truncate">{u.email}</span>
                            <select
                                value={u.role}
                                onChange={(e) => updateUserRole(u.id, e.target.value)}
                                className="bg-obsidian border border-white/10 rounded-lg px-2 py-1.5 text-sm"
                            >
                                <option value="staff">staff</option>
                                <option value="admin">admin</option>
                            </select>
                            <button
                                onClick={() => setUserActive(u.id, !u.is_active)}
                                className={`px-2 py-1.5 rounded-lg text-sm font-medium ${u.is_active ? 'bg-emerald/20 text-emerald' : 'bg-red-500/20 text-red-300'}`}
                            >
                                {u.is_active ? 'active' : 'disabled'}
                            </button>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={passwordDrafts[u.email] || ''}
                                    onChange={(e) => setPasswordDrafts((prev) => ({ ...prev, [u.email]: e.target.value }))}
                                    placeholder="New password"
                                    className="w-full bg-obsidian border border-white/10 rounded-lg px-2 py-1.5 text-sm"
                                />
                                <button
                                    onClick={() => onSavePassword(u.email)}
                                    disabled={!passwordDrafts[u.email]?.trim() || isSavingPasswordEmail === u.email}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald/20 text-emerald hover:bg-emerald/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSavingPasswordEmail === u.email ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => deleteUser(u.id)}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-300 transition-colors"
                                    title="Delete user access"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {users.length === 0 && (
                        <div className="px-5 py-8 text-sm text-gray-500">No users configured yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
