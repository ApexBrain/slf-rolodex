import {
    Building2,
    Users,
    Settings,
    Plus,
    X,
    BookOpen,
} from 'lucide-react';
import { useStore } from '../store.js';

const navItems = [
    { icon: Building2, label: 'Companies', active: true },
    { icon: Users, label: 'Contacts', active: false },
    { icon: Settings, label: 'Settings', active: false },
];

export function Sidebar() {
    const sidebarOpen = useStore((s) => s.sidebarOpen);
    const closeSidebar = useStore((s) => s.closeSidebar);

    return (
        <>
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed top-0 left-0 z-50 h-[100dvh] w-64 flex flex-col
          bg-charcoal/90 backdrop-blur-xl border-r border-glass-border
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
            >
                {/* Logo */}
                <div className="flex items-center justify-between px-5 py-5 border-b border-glass-border">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-accent/20 flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-indigo-hover" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-zinc-text tracking-tight">
                                SLF Rolodex
                            </h1>
                            <p className="text-[10px] text-zinc-dim font-medium uppercase tracking-widest">
                                Provider Directory
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={closeSidebar}
                        className="lg:hidden p-1 rounded-md hover:bg-white/5 text-zinc-dim"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    {navItems.map((item) => (
                        <button
                            key={item.label}
                            className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150 cursor-pointer
                ${item.active
                                    ? 'bg-indigo-accent/10 text-indigo-hover'
                                    : 'text-zinc-dim hover:text-zinc-text hover:bg-white/5'
                                }
              `}
                        >
                            <item.icon className="w-[18px] h-[18px]" />
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Add Record Button */}
                <div className="px-3 pb-4">
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-accent hover:bg-indigo-hover text-white text-sm font-semibold transition-all duration-150 cursor-pointer">
                        <Plus className="w-4 h-4" />
                        Add Record
                    </button>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-glass-border">
                    <p className="text-[10px] text-zinc-dim">
                        1,304 providers loaded
                    </p>
                </div>
            </aside>
        </>
    );
}
