import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, Menu, ArrowUpDown } from 'lucide-react';
import { useStore } from '../store.js';
import { Badge } from './Badge.jsx';

const PAGE_SIZE = 50;

export function DataTable() {
    const contacts = useStore((s) => s.contacts);
    const searchQuery = useStore((s) => s.searchQuery);
    const setSearch = useStore((s) => s.setSearch);
    const selectContact = useStore((s) => s.selectContact);
    const toggleSidebar = useStore((s) => s.toggleSidebar);
    const getFilteredContacts = useStore((s) => s.getFilteredContacts);

    const [page, setPage] = useState(0);
    const [sortKey, setSortKey] = useState(null);
    const [sortDir, setSortDir] = useState('asc');
    const searchRef = useRef(null);

    const filtered = useMemo(() => getFilteredContacts(), [contacts, searchQuery]);

    const sorted = useMemo(() => {
        if (!sortKey) return filtered;
        return [...filtered].sort((a, b) => {
            const va = (a[sortKey] || '').toLowerCase();
            const vb = (b[sortKey] || '').toLowerCase();
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filtered, sortKey, sortDir]);

    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
    const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    useEffect(() => {
        setPage(0);
    }, [searchQuery]);

    // Cmd+K shortcut
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const columns = [
        { key: 'officeName', label: 'Office Name', width: 'w-[22%] min-w-[180px]' },
        { key: 'contactName', label: 'Contact', width: 'w-[18%] min-w-[150px]' },
        { key: 'tags', label: 'Tags', width: 'w-[16%] min-w-[130px]', noSort: true },
        { key: 'city', label: 'Location', width: 'w-[14%] min-w-[100px]' },
        { key: 'phone1', label: 'Phone', width: 'w-[14%] min-w-[120px]' },
        { key: 'mailing', label: 'Mailing', width: 'w-[8%] min-w-[80px]' },
    ];

    return (
        <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden">
            {/* Top Bar */}
            <div className="flex items-center gap-3 px-4 lg:px-6 py-4 border-b border-glass-border bg-charcoal/40 backdrop-blur-xl">
                {/* Mobile hamburger */}
                <button
                    onClick={toggleSidebar}
                    className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-zinc-dim"
                >
                    <Menu className="w-5 h-5" />
                </button>

                {/* Search */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-dim" />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search providers..."
                        value={searchQuery}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white/5 border border-glass-border rounded-lg pl-10 pr-16 py-2.5 text-sm text-zinc-text placeholder:text-zinc-dim focus:bg-white/[0.07] focus:border-indigo-accent/40 transition-all duration-150"
                    />
                    <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-glass-border bg-white/5 text-[10px] text-zinc-dim font-mono">
                        ⌘K
                    </kbd>
                </div>

                {/* Results count */}
                <div className="hidden sm:block text-xs text-zinc-dim whitespace-nowrap">
                    {sorted.length.toLocaleString()} records
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-charcoal/95 backdrop-blur-xl border-b border-glass-border">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={`${col.width} text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-dim ${!col.noSort ? 'cursor-pointer hover:text-zinc-text select-none' : ''}`}
                                    onClick={() => !col.noSort && handleSort(col.key)}
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        {col.label}
                                        {!col.noSort && sortKey === col.key && (
                                            <ArrowUpDown className="w-3 h-3 text-indigo-accent" />
                                        )}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {pageData.map((contact, idx) => (
                            <tr
                                key={contact.id}
                                onClick={() => selectContact(contact.id)}
                                className="border-b border-glass-border/50 cursor-pointer transition-colors duration-100 hover:bg-white/[0.03] group"
                            >
                                <td className="px-4 py-3">
                                    <div className="text-sm font-medium text-zinc-text group-hover:text-indigo-hover transition-colors duration-100 truncate">
                                        {contact.officeName || '—'}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="text-sm text-zinc-muted truncate">
                                        {contact.contactName || '—'}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                        {contact.a && <Badge label="A" variant="a" />}
                                        {contact.b && <Badge label="B" variant="b" />}
                                        {contact.c && <Badge label="C" variant="c" />}
                                        {contact.who && (
                                            <Badge label={contact.who} variant="who" />
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="text-sm text-zinc-muted truncate">
                                        {[contact.city, contact.state].filter(Boolean).join(', ') || '—'}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="text-sm text-zinc-muted font-mono text-[13px]">
                                        {contact.phone1 || '—'}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {contact.mailing && (
                                        <Badge
                                            label={contact.mailing}
                                            variant={contact.mailing.toLowerCase().includes('deliver') ? 'deliver' : 'mail'}
                                        />
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {pageData.length === 0 && (
                    <div className="flex items-center justify-center py-20 text-zinc-dim text-sm">
                        No records found matching "{searchQuery}"
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-t border-glass-border bg-charcoal/40 backdrop-blur-xl">
                    <span className="text-xs text-zinc-dim">
                        Page {page + 1} of {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="p-1.5 rounded-md hover:bg-white/5 text-zinc-dim disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        {/* Page numbers */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                                pageNum = i;
                            } else if (page < 3) {
                                pageNum = i;
                            } else if (page > totalPages - 4) {
                                pageNum = totalPages - 5 + i;
                            } else {
                                pageNum = page - 2 + i;
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setPage(pageNum)}
                                    className={`w-8 h-8 rounded-md text-xs font-medium transition-all cursor-pointer ${page === pageNum
                                            ? 'bg-indigo-accent text-white'
                                            : 'text-zinc-dim hover:bg-white/5 hover:text-zinc-text'
                                        }`}
                                >
                                    {pageNum + 1}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="p-1.5 rounded-md hover:bg-white/5 text-zinc-dim disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
