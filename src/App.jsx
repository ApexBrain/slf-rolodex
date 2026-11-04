import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard.jsx';
import { Login } from './pages/Login.jsx';
import { UserManagement } from './pages/UserManagement.jsx';
import { useStore } from './store.js';
import { Toast } from './components/Toast.jsx';

export default function App() {
    const location = useLocation();
    const isWorkspace = location.pathname === '/' || location.pathname.startsWith('/contact/');
    const initializeAuth = useStore((s) => s.initializeAuth);
    const onAuthStateChange = useStore((s) => s.onAuthStateChange);
    const loadCurrentUserRole = useStore((s) => s.loadCurrentUserRole);
    const fetchContacts = useStore((s) => s.fetchContacts);
    const signOut = useStore((s) => s.signOut);
    const session = useStore((s) => s.session);
    const user = useStore((s) => s.user);
    const role = useStore((s) => s.role);
    const canManageUsers = useStore((s) => s.canManageUsers);
    const isLoading = useStore((s) => s.isLoading);
    const isAuthLoading = useStore((s) => s.isAuthLoading);
    const [isResolvingRole, setIsResolvingRole] = useState(false);
    const [contactsLoadedForUser, setContactsLoadedForUser] = useState('');

    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);

    useEffect(() => {
        const { data: subscription } = onAuthStateChange(async (event, nextSession) => {
            const nextUser = nextSession?.user || null;
            useStore.setState({ session: nextSession || null, user: nextUser });
            if (!nextUser) {
                useStore.setState({ role: null, contacts: [], isLoading: false });
                setContactsLoadedForUser('');
                return;
            }
            if (event === 'SIGNED_OUT') {
                useStore.setState({ role: null, contacts: [], isLoading: false });
                setContactsLoadedForUser('');
            }
        });

        return () => subscription?.subscription?.unsubscribe?.();
    }, [onAuthStateChange]);

    useEffect(() => {
        if (!session || !role) return;
        const key = `${session.user?.id || 'unknown'}:${role}`;
        if (contactsLoadedForUser === key) return;

        const load = async () => {
            await fetchContacts();
            setContactsLoadedForUser(key);
        };
        load();
    }, [session, role, fetchContacts, contactsLoadedForUser]);

    useEffect(() => {
        if (!session || role) return;
        let cancelled = false;
        let timeoutId = null;

        const resolveRole = async () => {
            setIsResolvingRole(true);
            try {
                for (let attempt = 0; attempt < 5; attempt += 1) {
                    const resolved = await loadCurrentUserRole(session.user);
                    if (cancelled) return;
                    if (resolved) {
                        return;
                    }
                    await new Promise((r) => setTimeout(r, 700));
                }
            } finally {
                if (!cancelled) setIsResolvingRole(false);
            }
        };

        timeoutId = setTimeout(() => {
            if (!cancelled) setIsResolvingRole(false);
        }, 15000);

        resolveRole();
        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [session, role, loadCurrentUserRole, fetchContacts]);

    if (isAuthLoading) {
        return (
            <div className="min-h-screen bg-obsidian flex items-center justify-center animate-fade-in">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-white/10 border-t-emerald rounded-full animate-spin"></div>
                    <p className="text-gray-400 font-medium tracking-widest text-sm uppercase">Loading Session...</p>
                </div>
            </div>
        );
    }

    if (!session) {
        return <Login />;
    }

    if (!role) {
        if (isResolvingRole) {
            return (
                <div className="min-h-screen bg-obsidian flex items-center justify-center animate-fade-in">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-white/10 border-t-emerald rounded-full animate-spin"></div>
                        <p className="text-gray-400 font-medium tracking-widest text-sm uppercase">Finalizing Access...</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-obsidian text-white flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-slate-dark border border-white/10 rounded-3xl p-6">
                    <h2 className="text-xl font-bold mb-2">Access Pending</h2>
                    <p className="text-sm text-gray-400 mb-5">
                        Your account does not have an assigned role yet. Ask an admin to add your email in User Management.
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={async () => {
                                await loadCurrentUserRole(user);
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald/20 hover:bg-emerald/30 text-emerald transition-colors"
                        >
                            Retry Access Check
                        </button>
                        <button
                            onClick={signOut}
                            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-obsidian flex items-center justify-center animate-fade-in">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-white/10 border-t-emerald rounded-full animate-spin"></div>
                    <p className="text-gray-400 font-medium tracking-widest text-sm uppercase">Loading Database...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-obsidian text-white selection:bg-lime selection:text-obsidian">
            <header className="bg-slate-dark border-b border-white/5 sticky top-0 z-40">
                <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <Link to="/" className="text-sm font-bold tracking-widest uppercase text-white whitespace-nowrap">
                            SLF Rolodex
                        </Link>
                        {canManageUsers() && (
                            <Link
                                to="/users"
                                className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-200 transition-colors whitespace-nowrap"
                            >
                                <span className="sm:hidden">Users</span><span className="hidden sm:inline">User Management</span>
                            </Link>
                        )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <span className="hidden md:inline text-xs text-gray-400">{user?.email} ({role})</span>
                        <button
                            onClick={signOut}
                            className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors whitespace-nowrap"
                            title={`${user?.email || ''} (${role})`}
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            <main className={isWorkspace ? 'px-3 pt-4 pb-8 md:p-0' : 'max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8'}>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/contact/:id" element={<Dashboard />} />
                    <Route
                        path="/users"
                        element={canManageUsers() ? <UserManagement /> : <Navigate to="/" replace />}
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
            <Toast />
        </div>
    );
}
