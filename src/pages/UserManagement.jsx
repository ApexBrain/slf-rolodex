import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, Plus, Copy, Check, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useStore } from '../store.js';

// Same visual language as the contact card: large title, grouped rounded lists,
// small uppercase section labels, emerald actions, rows that expand to show their controls.

const MIN_PASSWORD = 8;

function generatePassword() {
    // 16 chars from an unambiguous alphabet; crypto-random.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*?';
    const bytes = new Uint32Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('');
}

function initialsFromEmail(email) {
    const local = (email || '').split('@')[0];
    const parts = local.split(/[._-]+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase() || '?';
}

function Segmented({ value, onChange, options, disabled }) {
    return (
        <div className={`inline-flex bg-white/[0.06] rounded-full p-1 gap-1 ${disabled ? 'opacity-50' : ''}`} role="group">
            {options.map(([k, l]) => (
                <button
                    key={k}
                    type="button"
                    disabled={disabled}
                    aria-pressed={value === k}
                    onClick={() => onChange(k)}
                    className={`h-8 px-4 rounded-full text-[13px] font-bold transition-colors ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${value === k ? 'bg-white text-obsidian' : 'text-gray-400 hover:text-white'}`}
                >
                    {l}
                </button>
            ))}
        </div>
    );
}

function Toggle({ checked, onChange, disabled, label }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative w-12 h-7 rounded-full transition-colors ${checked ? 'bg-emerald' : 'bg-white/15'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
        </button>
    );
}

function PasswordField({ value, onChange, placeholder, autoFocus }) {
    const [show, setShow] = useState(false);
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard blocked */ }
    };
    return (
        <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
                <input
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    autoComplete="new-password"
                    className={`w-full h-10 bg-obsidian border border-white/10 rounded-xl pl-3 pr-10 text-[16px] md:text-[15px] text-white outline-none focus:border-emerald/60 ${value ? 'font-mono' : ''}`}
                />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-gray-400 hover:text-white flex items-center justify-center cursor-pointer">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
            <button type="button" onClick={() => { onChange(generatePassword()); setShow(true); }} title="Generate a strong password" className="h-10 px-3 shrink-0 rounded-xl bg-white/5 hover:bg-white/10 text-[13px] font-semibold text-gray-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                <RefreshCw className="w-3.5 h-3.5" /> Generate
            </button>
            {value && (
                <button type="button" onClick={copy} aria-label="Copy password" title="Copy" className="w-10 h-10 shrink-0 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 flex items-center justify-center cursor-pointer">
                    {copied ? <Check className="w-4 h-4 text-emerald" /> : <Copy className="w-4 h-4" />}
                </button>
            )}
        </div>
    );
}

function Section({ title, right, children }) {
    return (
        <section>
            <div className="flex items-center justify-between px-1 mb-1.5 min-h-[20px]">
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
                {right}
            </div>
            <div className="bg-slate-dark rounded-2xl border border-white/5 overflow-hidden">{children}</div>
        </section>
    );
}

function UserRow({ u, isMe, open, onToggle, onRole, onActive, onPassword, onRemove }) {
    const [pw, setPw] = useState('');
    const [saving, setSaving] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    useEffect(() => { if (!open) { setPw(''); setConfirmRemove(false); } }, [open]);

    const savePw = async () => {
        if (pw.trim().length < MIN_PASSWORD || saving) return;
        setSaving(true);
        try {
            const ok = await onPassword(u.email, pw.trim());
            if (ok) setPw('');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="border-b border-white/[0.06] last:border-0">
            <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] cursor-pointer">
                <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold ${u.role === 'admin' ? 'bg-emerald/20 text-emerald ring-1 ring-emerald/50' : 'bg-white/10 text-gray-300'} ${u.is_active ? '' : 'opacity-40'}`}>
                    {initialsFromEmail(u.email)}
                </span>
                <span className="min-w-0 flex-1">
                    <span className={`block text-[15px] truncate ${u.is_active ? 'text-white' : 'text-gray-500 line-through'}`}>
                        {u.email}{isMe && <span className="ml-2 text-[12px] text-emerald font-semibold no-underline">you</span>}
                    </span>
                    <span className="block text-[13px] text-gray-500">
                        {u.role === 'admin' ? 'Admin' : 'Staff'} · {u.is_active ? 'Active' : 'Access off'}
                        {u.created_at && <> · added {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>}
                    </span>
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="px-4 pb-4 pt-1 space-y-4 bg-obsidian/30">
                    {isMe && (
                        <p className="text-[13px] text-gray-500">This is your account. To avoid locking yourself out, another admin has to change your role or access.</p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-[14px] text-white">Role</p>
                            <p className="text-[12px] text-gray-500">Admins can delete contacts, export and manage users.</p>
                        </div>
                        <Segmented value={u.role} onChange={(r) => onRole(u.id, r)} options={[['staff', 'Staff'], ['admin', 'Admin']]} disabled={isMe} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[14px] text-white">Access</p>
                            <p className="text-[12px] text-gray-500">{u.is_active ? 'Can sign in and use the Rolodex.' : 'Blocked. Turn on to restore access.'}</p>
                        </div>
                        <Toggle checked={!!u.is_active} onChange={(v) => onActive(u.id, v)} disabled={isMe} label="Access" />
                    </div>
                    <div>
                        <p className="text-[14px] text-white mb-1.5">Reset password</p>
                        <PasswordField value={pw} onChange={setPw} placeholder="New password" />
                        <div className="mt-2 flex items-center justify-between gap-3">
                            <p className="text-[12px] text-gray-500">At least {MIN_PASSWORD} characters. Share it privately.</p>
                            <button
                                type="button"
                                onClick={savePw}
                                disabled={pw.trim().length < MIN_PASSWORD || saving}
                                className="h-9 px-4 shrink-0 whitespace-nowrap rounded-full bg-emerald text-obsidian text-[14px] font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {saving ? 'Saving…' : 'Set password'}
                            </button>
                        </div>
                    </div>
                    {!isMe && (
                        <div className="pt-1">
                            {confirmRemove ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[14px] text-gray-300 mr-auto">Remove {u.email} from the Rolodex?</span>
                                    <button type="button" onClick={() => setConfirmRemove(false)} className="h-9 px-4 rounded-full text-[14px] text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer">Cancel</button>
                                    <button type="button" onClick={() => onRemove(u.id)} className="h-9 px-4 rounded-full bg-danger text-white text-[14px] font-bold hover:bg-red-600 cursor-pointer">Remove</button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => setConfirmRemove(true)} className="text-[14px] font-semibold text-danger hover:underline cursor-pointer">
                                    Remove user
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function UserManagement() {
    const navigate = useNavigate();
    const me = useStore((s) => s.user?.email?.toLowerCase());
    const users = useStore((s) => s.users);
    const fetchUsers = useStore((s) => s.fetchUsers);
    const createUserWithPassword = useStore((s) => s.createUserWithPassword);
    const updateUserRole = useStore((s) => s.updateUserRole);
    const updateUserPassword = useStore((s) => s.updateUserPassword);
    const setUserActive = useStore((s) => s.setUserActive);
    const deleteUser = useStore((s) => s.deleteUser);
    const notify = useStore((s) => s.notify);

    const [adding, setAdding] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('staff');
    const [isAdding, setIsAdding] = useState(false);
    const [errorText, setErrorText] = useState('');
    const [openId, setOpenId] = useState(null);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const groups = useMemo(() => {
        const sorted = [...users].sort((a, b) => a.email.localeCompare(b.email));
        return [
            ['Admins', sorted.filter((u) => u.role === 'admin')],
            ['Staff', sorted.filter((u) => u.role !== 'admin')],
        ];
    }, [users]);
    const activeCount = users.filter((u) => u.is_active).length;

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const canAdd = emailOk && password.trim().length >= MIN_PASSWORD && !isAdding;

    const onAddUser = async () => {
        if (!canAdd) return;
        setErrorText('');
        setIsAdding(true);
        try {
            const result = await createUserWithPassword({ email: email.trim(), password: password.trim(), role });
            if (!result.ok) {
                setErrorText(result.error?.message || 'Unable to add user.');
                return;
            }
            notify(`${email.trim()} can now sign in.`, 'success');
            setEmail(''); setPassword(''); setRole('staff'); setAdding(false);
        } finally {
            setIsAdding(false);
        }
    };

    const onRole = async (id, r) => {
        const res = await updateUserRole(id, r);
        if (res?.ok === false) notify('Could not change the role.', 'error');
    };
    const onActive = async (id, v) => {
        const res = await setUserActive(id, v);
        if (res?.ok === false) notify('Could not change access.', 'error');
    };
    const onPassword = async (targetEmail, newPassword) => {
        const res = await updateUserPassword({ email: targetEmail, newPassword });
        if (!res.ok) { notify(res.error?.message || 'Could not set the password.', 'error'); return false; }
        notify(`Password updated for ${targetEmail}.`, 'success');
        return true;
    };
    const onRemove = async (id) => {
        const res = await deleteUser(id);
        if (res?.ok === false) notify('Could not remove the user.', 'error');
        else setOpenId(null);
    };

    return (
        <div className="max-w-2xl mx-auto pb-12 animate-fade-in">
            <button onClick={() => navigate('/')} className="-ml-2 mb-2 flex items-center h-9 pr-3 text-[15px] text-emerald hover:opacity-80 cursor-pointer">
                <ChevronLeft className="w-5 h-5" strokeWidth={2.25} /> Contacts
            </button>

            <div className="flex items-end justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-[30px] font-bold leading-tight text-white tracking-tight">Users</h1>
                    <p className="text-[13px] text-gray-500">{users.length} {users.length === 1 ? 'person' : 'people'} · {activeCount} with access</p>
                </div>
                {!adding && (
                    <button onClick={() => { setAdding(true); setOpenId(null); }} className="h-10 pl-3 pr-4 rounded-full bg-emerald text-obsidian font-bold text-[14px] flex items-center gap-1.5 hover:bg-emerald/90 cursor-pointer">
                        <Plus className="w-4 h-4" strokeWidth={2.5} /> Add user
                    </button>
                )}
            </div>

            <div className="space-y-6">
                {adding && (
                    <Section title="New user">
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-[13px] text-gray-500 mb-1">Work email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@scrantonlawfirm.com"
                                    autoFocus
                                    className="w-full h-10 bg-obsidian border border-white/10 rounded-xl px-3 text-[16px] md:text-[15px] text-white outline-none focus:border-emerald/60"
                                />
                            </div>
                            <div>
                                <label className="block text-[13px] text-gray-500 mb-1">First password</label>
                                <PasswordField value={password} onChange={setPassword} placeholder={`At least ${MIN_PASSWORD} characters`} />
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <span className="text-[13px] text-gray-500">Role</span>
                                <Segmented value={role} onChange={setRole} options={[['staff', 'Staff'], ['admin', 'Admin']]} />
                            </div>
                            {errorText && <p className="text-[14px] text-red-400">{errorText}</p>}
                            <div className="flex justify-end gap-2 pt-1">
                                <button onClick={() => { setAdding(false); setErrorText(''); setEmail(''); setPassword(''); setRole('staff'); }} className="h-10 px-4 rounded-full text-[14px] text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer">Cancel</button>
                                <button onClick={onAddUser} disabled={!canAdd} className="h-10 px-5 rounded-full bg-emerald text-obsidian font-bold text-[14px] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                                    {isAdding ? 'Adding…' : 'Add user'}
                                </button>
                            </div>
                        </div>
                    </Section>
                )}

                {groups.map(([title, list]) => list.length > 0 && (
                    <Section key={title} title={title} right={<span className="text-[12px] text-gray-500">{list.length}</span>}>
                        {list.map((u) => (
                            <UserRow
                                key={u.id}
                                u={u}
                                isMe={u.email?.toLowerCase() === me}
                                open={openId === u.id}
                                onToggle={() => setOpenId(openId === u.id ? null : u.id)}
                                onRole={onRole}
                                onActive={onActive}
                                onPassword={onPassword}
                                onRemove={onRemove}
                            />
                        ))}
                    </Section>
                ))}

                {users.length === 0 && (
                    <Section title="Users">
                        <p className="px-4 py-6 text-[15px] text-gray-500">No users yet. Add the first one above.</p>
                    </Section>
                )}
            </div>
        </div>
    );
}
