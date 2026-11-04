import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, MapPin, X, Download, Plus, Phone, AlertTriangle } from 'lucide-react';
import { useStore, findPossibleDuplicates } from '../store.js';

function StatusBadge({ contact }) {
    const getActiveStyles = () => {
        if (contact.a) return "text-[#10B981] border-[#10B981]";
        if (contact.b) return "text-[#22C55E] border-[#22C55E]";
        if (contact.c) return "text-[#059669] border-[#059669]";
        return "";
    };

    if (contact.a || contact.b || contact.c) {
        return (
            <span className={`flex items-center justify-center w-8 h-8 rounded-full text-[15px] font-black shadow-sm border-2 bg-obsidian ${getActiveStyles()}`}>
                {contact.a ? 'A' : contact.b ? 'B' : 'C'}
            </span>
        );
    }

    return <span className="flex items-center justify-center w-8 h-8 rounded-full text-[15px] bg-slate-dark text-gray-500 font-bold border border-white/10 shadow-none" title="None">—</span>;
}

export function Dashboard() {
    const contacts = useStore((s) => s.contacts);
    const searchQuery = useStore((s) => s.searchQuery);
    const setSearch = useStore((s) => s.setSearch);
    const executeSearch = useStore((s) => s.executeSearch);
    const activeSearchQuery = useStore((s) => s.activeSearchQuery);

    const cityFilter = useStore((s) => s.cityFilter);
    const setCityFilter = useStore((s) => s.setCityFilter);
    const statusFilter = useStore((s) => s.statusFilter);
    const setStatusFilter = useStore((s) => s.setStatusFilter);
    const specialtyFilter = useStore((s) => s.specialtyFilter);
    const setSpecialtyFilter = useStore((s) => s.setSpecialtyFilter);

    const getFilteredContacts = useStore((s) => s.getFilteredContacts);
    const getStats = useStore((s) => s.getStats);
    const canExport = useStore((s) => s.canExport);
    const addContact = useStore((s) => s.addContact);
    const navigate = useNavigate();

    const searchRef = useRef(null);
    useEffect(() => {
        const onKey = (e) => {
            const tag = (e.target.tagName || '').toLowerCase();
            if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const [page, setPage] = useState(0);
    const PAGE_SIZE = 150;

    const [showNewModal, setShowNewModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newContact, setNewContact] = useState({ officeName: '', contactName: '', email: '', phone1: '', city: '', state: '' });

    const handleCreateContact = async () => {
        if (!newContact.officeName.trim() || isCreating) return;
        setIsCreating(true);
        try {
            const newId = await addContact(newContact);
            if (newId) {
                setShowNewModal(false);
                setNewContact({ officeName: '', contactName: '', email: '', phone1: '', city: '', state: '' });
                navigate(`/contact/${newId}`);
            }
        } finally {
            setIsCreating(false);
        }
    };

    const possibleDuplicates = useMemo(
        () => (showNewModal ? findPossibleDuplicates(contacts, newContact) : []),
        [showNewModal, contacts, newContact.officeName, newContact.city, newContact.email, newContact.phone1]
    );

    const stats = useMemo(() => getStats(), [contacts]);
    const filtered = useMemo(() => getFilteredContacts(), [contacts, activeSearchQuery, cityFilter, statusFilter, specialtyFilter]);
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    useEffect(() => { setPage(0); }, [activeSearchQuery, cityFilter, statusFilter, specialtyFilter]);

    const statusButtons = [
        { key: '', label: 'All' },
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
        { key: 'c', label: 'C' },
        { key: 'none', label: 'None' },
    ];

    const clearFilters = () => {
        setSearch('');
        setTimeout(() => executeSearch(), 0); // Need timeout so state updates before executing
        setCityFilter('');
        setStatusFilter('');
        setSpecialtyFilter('');
    };

    const exportToCSV = () => {
        if (!filtered || filtered.length === 0) return;

        const headers = ['Business Name', 'Contact Name', 'City', 'State', 'Specialties', 'Phone', 'Status', 'Who'];
        const csvRows = [headers.join(',')];

        const escapeCsv = (val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        for (const contact of filtered) {
            const status = contact.a ? 'A' : contact.b ? 'B' : contact.c ? 'C' : 'None';
            const row = [
                escapeCsv(contact.officeName),
                escapeCsv(contact.contactName),
                escapeCsv(contact.city),
                escapeCsv(contact.state),
                escapeCsv(contact.specialties?.join('; ')),
                escapeCsv(contact.phone1),
                escapeCsv(status),
                escapeCsv(contact.who)
            ];
            csvRows.push(row.join(','));
        }

        const csvData = csvRows.join('\n');
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'slf-rolodex-export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 animate-fade-in">

            {/* ── Page Header & Filters ── */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-slate-dark/50 backdrop-blur-md rounded-3xl p-3 border border-white/5 shadow-card">
                {/* Logo */}
                <div className="md:border-r border-white/10 md:pr-4 py-2 self-center">
                    <img
                        src="/SLF_Black_Book_Logo.png"
                        alt="SLF Rolodex"
                        className="w-[250px] object-contain"
                    />
                </div>

                {/* Filters Container (2 Rows) */}
                <div className="flex flex-col flex-1 gap-3 w-full">
                    {/* Top Row: Search & City */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                ref={searchRef}
                                placeholder="Search name, city, phone, specialty...   ( / )"
                                value={searchQuery}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        executeSearch();
                                    }
                                }}
                                className="w-full bg-obsidian/50 border border-white/5 rounded-pill pl-11 pr-5 py-2.5 text-[15px] text-white placeholder:text-gray-500 outline-none focus:border-neon-yellow/30 transition-colors"
                            />
                        </div>

                        {/* City dropdown */}
                        <div className="relative min-w-[150px]">
                            <select
                                value={cityFilter}
                                onChange={(e) => setCityFilter(e.target.value)}
                                className="w-full appearance-none bg-obsidian/50 border border-white/5 rounded-pill px-4 py-2 pr-9 text-[14px] text-white outline-none focus:border-emerald/30 cursor-pointer transition-colors hover:border-white/10"
                            >
                                <option value="">All Cities</option>
                                {stats.cities.map((c) => (
                                    <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
                                ))}
                            </select>
                            <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                        </div>
                    </div>

                    {/* Bottom Row: Specialty, Status & Clear Filters */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Specialty dropdown */}
                            <div className="relative min-w-[170px]">
                                <select
                                    value={specialtyFilter}
                                    onChange={(e) => setSpecialtyFilter(e.target.value)}
                                    className="w-full appearance-none bg-obsidian/50 border border-white/5 rounded-pill px-4 py-2 pr-9 text-[14px] text-white outline-none focus:border-emerald/30 cursor-pointer transition-colors hover:border-white/10"
                                >
                                    <option value="">All Specialties</option>
                                    {stats.allSpecialties?.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Status pills */}
                            <div className="flex items-center gap-1 bg-obsidian/50 rounded-pill p-1 border border-white/5">
                                {statusButtons.map((btn) => {
                                    const isActive = statusFilter === btn.key;
                                    const getActiveStyles = () => {
                                        if (btn.key === 'a') return 'bg-[#10B981]/10 text-[#10B981] border-[#10B981] shadow-sm';
                                        if (btn.key === 'b') return 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E] shadow-sm';
                                        if (btn.key === 'c') return 'bg-[#059669]/10 text-[#059669] border-[#059669] shadow-sm';
                                        if (btn.key === 'none') return 'bg-white/10 text-white border-white/20 shadow-sm';
                                        return 'bg-white text-obsidian shadow-sm'; // Default for 'All'
                                    };

                                    return (
                                        <button
                                            key={btn.key}
                                            onClick={() => setStatusFilter(btn.key)}
                                            className={`px-4 py-1.5 rounded-pill text-[13px] font-bold transition-all border-2 cursor-pointer ${isActive
                                                ? getActiveStyles()
                                                : 'text-gray-500 border-transparent hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            {btn.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Clear Filters */}
                            {(cityFilter || statusFilter || specialtyFilter || activeSearchQuery || searchQuery) && (
                                <button
                                    onClick={clearFilters}
                                    className="flex items-center justify-center w-9 h-9 rounded-full bg-white/5 hover:bg-danger/20 text-gray-500 hover:text-white transition-colors cursor-pointer"
                                    title="Clear filters"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}

                            {/* Add New Contact */}
                            <button
                                onClick={() => setShowNewModal(true)}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-pill text-[13px] font-bold bg-emerald/10 hover:bg-emerald/20 text-emerald border border-emerald/30 hover:border-emerald/50 transition-all cursor-pointer"
                                title="Add new contact"
                            >
                                <Plus className="w-4 h-4" />
                                New Contact
                            </button>

                            {/* Export to CSV (admin only) */}
                            {canExport() && (
                                <button
                                    onClick={exportToCSV}
                                    className="flex items-center gap-2 px-4 py-1.5 rounded-pill text-[13px] font-bold bg-white/5 hover:bg-emerald/20 text-white border border-white/10 hover:border-emerald/50 transition-all cursor-pointer"
                                    title="Export to CSV"
                                >
                                    <Download className="w-4 h-4" />
                                    Export
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <p className="px-2 -mb-2 text-[13px] text-gray-500">
                {filtered.length === contacts.length
                    ? `${contacts.length.toLocaleString()} contacts`
                    : `${filtered.length.toLocaleString()} of ${contacts.length.toLocaleString()} contacts`}
            </p>

            {/* ── Contact List ── */}
            <div className="bg-slate-dark rounded-4xl shadow-card border border-white/5 overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_80px] gap-4 px-6 py-4 bg-white/5 border-b border-white/5 text-[13px] font-bold text-gray-400 uppercase tracking-widest">
                    <span>Business Name</span>
                    <span>Contact</span>
                    <span>City</span>
                    <span>Specialties</span>
                    <span>Phone</span>
                    <span className="text-center">Status</span>
                </div>

                {/* Rows */}
                <div className="divide-y divide-white/5">
                    {pageData.map((contact) => (
                        <div
                            key={contact.id}
                            role="link"
                            tabIndex={0}
                            onClick={() => navigate(`/contact/${contact.id}`)}
                            onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/contact/${contact.id}`); }}
                            className="w-full grid grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_80px] gap-4 px-6 py-5 text-left hover:bg-white/5 transition-colors cursor-pointer group items-center"
                        >
                            <span className="text-base font-medium text-white truncate group-hover:text-emerald transition-colors">
                                {contact.officeName || <span className="text-gray-500 italic">Unnamed</span>}
                            </span>
                            <span className="text-[15px] text-gray-400 truncate group-hover:text-gray-200 transition-colors">
                                {contact.contactName || '—'}
                            </span>
                            <span className="text-[15px] text-gray-500 truncate">{contact.city || '—'}</span>
                            <div className="flex flex-wrap gap-1">
                                {contact.specialties?.length > 0 ? (
                                    contact.specialties.map(s => (
                                        <span key={s} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[12px] text-gray-300 truncate max-w-[120px]" title={s}>
                                            {s}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-[15px] text-gray-600">—</span>
                                )}
                            </div>
                            {contact.phone1 && /\d{7,}/.test(contact.phone1.replace(/\D/g, '')) ? (
                                <a
                                    href={`tel:${contact.phone1.replace(/[^\d+]/g, '')}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 text-[15px] text-gray-400 font-medium truncate hover:text-emerald transition-colors"
                                    title="Call"
                                >
                                    <Phone className="w-3.5 h-3.5 shrink-0" />{contact.phone1}
                                </a>
                            ) : (
                                <span className="text-[15px] text-gray-500 font-medium truncate">{contact.phone1 || '—'}</span>
                            )}
                            <div className="flex justify-center items-center">
                                <StatusBadge contact={contact} />
                            </div>
                        </div>
                    ))}

                    {pageData.length === 0 && (
                        <div className="px-6 py-20 text-center flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-obsidian flex items-center justify-center mb-4 border border-white/5">
                                <Search className="w-6 h-6 text-gray-600" />
                            </div>
                            <p className="text-base text-white font-medium">No contacts match your filters</p>
                            <p className="text-[15px] text-gray-500 mt-1">Try adjusting your search or clearing filters.</p>
                        </div>
                    )}
                </div>

                {/* Pagination - Dark Mode Pill Style */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 bg-obsidian border-t border-white/5">
                        <span className="text-[13px] text-gray-500 font-medium">
                            {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                        </span>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-dark text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    // Simple logic to show 5 pages around the current page
                                    let showPage = i;
                                    if (totalPages > 5) {
                                        if (page > 2) showPage = page - 2 + i;
                                        if (showPage >= totalPages) showPage = totalPages - 5 + i;
                                    }

                                    return (
                                        <button
                                            key={showPage}
                                            onClick={() => setPage(showPage)}
                                            className={`w-9 h-9 rounded-full text-[13px] font-bold transition-all cursor-pointer ${page === showPage ? 'bg-emerald text-obsidian shadow-sm' : 'text-gray-400 bg-slate-dark hover:bg-white/10 hover:text-white'
                                                }`}
                                        >
                                            {showPage + 1}
                                        </button>
                                    )
                                })}
                            </div>

                            <button
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-dark text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {/* ── New Contact Modal ── */}
            {showNewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isCreating && setShowNewModal(false)} />
                    <div
                        className="relative bg-slate-dark border border-white/10 rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 animate-fade-in"
                        onKeyDown={(e) => {
                            if (e.key === 'Escape' && !isCreating) setShowNewModal(false);
                        }}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-white">New Contact</h2>
                            <button
                                onClick={() => !isCreating && setShowNewModal(false)}
                                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {[
                                { key: 'officeName', label: 'Office / Business Name *', placeholder: 'Acme Corp' },
                                { key: 'contactName', label: 'Contact Name', placeholder: 'Jane Doe' },
                                { key: 'email', label: 'Email', placeholder: 'jane@acme.com' },
                                { key: 'phone1', label: 'Phone', placeholder: '(555) 123-4567' },
                                { key: 'city', label: 'City', placeholder: 'Los Angeles' },
                                { key: 'state', label: 'State', placeholder: 'CA' },
                            ].map((field) => (
                                <div key={field.key}>
                                    <label className="block text-[12px] text-gray-400 font-semibold uppercase tracking-wider mb-1">{field.label}</label>
                                    <input
                                        type="text"
                                        value={newContact[field.key]}
                                        onChange={(e) => setNewContact((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateContact(); }}
                                        placeholder={field.placeholder}
                                        className="w-full bg-obsidian/50 border border-white/10 rounded-xl px-4 py-2.5 text-[15px] text-white placeholder:text-gray-600 outline-none focus:border-emerald/40 transition-colors"
                                        autoFocus={field.key === 'officeName'}
                                    />
                                </div>
                            ))}
                        </div>

                        {possibleDuplicates.length > 0 && (
                            <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
                                <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-300">
                                    <AlertTriangle className="w-4 h-4" /> This may already exist
                                </p>
                                <ul className="mt-2 space-y-1">
                                    {possibleDuplicates.map((c) => (
                                        <li key={c.id}>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/contact/${c.id}`)}
                                                className="text-[13px] text-amber-100 hover:underline text-left cursor-pointer"
                                            >
                                                {c.officeName || 'Unnamed'}{c.contactName ? ` · ${c.contactName}` : ''}{c.city ? ` · ${c.city}` : ''}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowNewModal(false)}
                                disabled={isCreating}
                                className="px-5 py-2 rounded-pill text-[14px] font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateContact}
                                disabled={!newContact.officeName.trim() || isCreating}
                                className="px-5 py-2 rounded-pill text-[14px] font-bold bg-emerald text-obsidian hover:bg-emerald/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {isCreating ? 'Creating...' : 'Create Contact'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
