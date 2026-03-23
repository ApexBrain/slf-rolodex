import { useState, useRef, useEffect, useMemo } from 'react';
import {
    X,
    Pin,
    Phone,
    Mail,
    Handshake,
    StickyNote,
    Search,
    Globe,
    MapPin,
    Send,
    Edit3,
    Check,
} from 'lucide-react';
import { useStore } from '../store.js';
import { Badge } from './Badge.jsx';

const NOTE_CATEGORIES = [
    { key: 'call', icon: '📞', label: 'Call' },
    { key: 'email', icon: '✉️', label: 'Email' },
    { key: 'meeting', icon: '🤝', label: 'Meeting' },
    { key: 'note', icon: '📝', label: 'Note' },
];

function getInitials(name) {
    if (!name) return '?';
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();
}

function relativeTime(isoString) {
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diff = now - then;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

// Inline editable field
function EditableField({ value, onSave, label, multiline = false }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef(null);

    useEffect(() => {
        setDraft(value);
    }, [value]);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select?.();
        }
    }, [editing]);

    const save = () => {
        onSave(draft);
        setEditing(false);
    };

    if (editing) {
        const Tag = multiline ? 'textarea' : 'input';
        return (
            <div className="flex items-start gap-2">
                <Tag
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            save();
                        }
                        if (e.key === 'Escape') {
                            setDraft(value);
                            setEditing(false);
                        }
                    }}
                    onBlur={save}
                    rows={multiline ? 3 : undefined}
                    className="flex-1 bg-white/5 border border-indigo-accent/40 rounded-md px-2 py-1.5 text-sm text-zinc-text resize-none"
                />
            </div>
        );
    }

    return (
        <div
            onClick={() => setEditing(true)}
            className="field-editable text-sm text-zinc-text min-h-[28px] flex items-center"
            title="Click to edit"
        >
            {value || <span className="text-zinc-dim italic">Empty</span>}
        </div>
    );
}

// Details Tab
function DetailsTab({ contact }) {
    const updateContact = useStore((s) => s.updateContact);

    const fields = [
        { key: 'email', label: 'Email', icon: Mail },
        { key: 'phone1', label: 'Phone 1', icon: Phone },
        { key: 'phone2', label: 'Phone 2', icon: Phone },
        { key: 'phone3', label: 'Phone 3', icon: Phone },
        { key: 'phone4', label: 'Phone 4', icon: Phone },
        { key: 'website', label: 'Website', icon: Globe },
        { key: 'streetAddress', label: 'Street Address', icon: MapPin },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'zip', label: 'Zip' },
        { key: 'mailing', label: 'Mailing' },
        { key: 'who', label: 'WHO' },
        { key: 'comments', label: 'Comments', multiline: true },
    ];

    return (
        <div className="space-y-1 py-2">
            {/* Tag toggles */}
            <div className="px-1 pb-3 flex items-center gap-2">
                <span className="text-[11px] text-zinc-dim uppercase tracking-wider font-semibold mr-1">Tags:</span>
                {['a', 'b', 'c'].map((tag) => (
                    <button
                        key={tag}
                        onClick={() => updateContact(contact.id, { [tag]: !contact[tag] })}
                        className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide border transition-all duration-150 cursor-pointer ${contact[tag]
                                ? tag === 'a'
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : tag === 'b'
                                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-white/5 text-zinc-dim border-glass-border hover:border-glass-border-hover'
                            }`}
                    >
                        {tag}
                    </button>
                ))}
            </div>

            {/* Fields */}
            {fields.map((f) => (
                <div key={f.key} className="grid grid-cols-[110px_1fr] items-start gap-2 px-1 py-1">
                    <label className="text-[11px] text-zinc-dim uppercase tracking-wider font-semibold pt-1.5 flex items-center gap-1.5">
                        {f.icon && <f.icon className="w-3 h-3" />}
                        {f.label}
                    </label>
                    <EditableField
                        value={contact[f.key]}
                        onSave={(val) => updateContact(contact.id, { [f.key]: val })}
                        multiline={f.multiline}
                    />
                </div>
            ))}
        </div>
    );
}

// Activity Tab (Notes Engine)
function ActivityTab({ contact }) {
    const addNote = useStore((s) => s.addNote);
    const [noteText, setNoteText] = useState('');
    const [noteCategory, setNoteCategory] = useState('note');
    const [timelineFilter, setTimelineFilter] = useState('');
    const inputRef = useRef(null);

    const filteredNotes = useMemo(() => {
        if (!timelineFilter.trim()) return contact.notes;
        const q = timelineFilter.toLowerCase();
        return contact.notes.filter(
            (n) =>
                n.text.toLowerCase().includes(q) ||
                n.category.toLowerCase().includes(q)
        );
    }, [contact.notes, timelineFilter]);

    const handleSubmit = () => {
        if (!noteText.trim()) return;
        addNote(contact.id, { text: noteText.trim(), category: noteCategory });
        setNoteText('');
        setNoteCategory('note');
    };

    return (
        <div className="flex flex-col h-full">
            {/* Note Input */}
            <div className="p-3 border-b border-glass-border/50 space-y-2">
                {/* Category selector */}
                <div className="flex items-center gap-1">
                    {NOTE_CATEGORIES.map((cat) => (
                        <button
                            key={cat.key}
                            onClick={() => setNoteCategory(cat.key)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-100 cursor-pointer ${noteCategory === cat.key
                                    ? 'bg-indigo-accent/15 text-indigo-hover border border-indigo-accent/30'
                                    : 'text-zinc-dim hover:text-zinc-text hover:bg-white/5 border border-transparent'
                                }`}
                        >
                            {cat.icon} {cat.label}
                        </button>
                    ))}
                </div>

                {/* Text input */}
                <div className="relative">
                    <textarea
                        ref={inputRef}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        placeholder="Add a note..."
                        rows={2}
                        className="w-full bg-white/5 border border-glass-border rounded-lg px-3 py-2.5 text-sm text-zinc-text placeholder:text-zinc-dim resize-none focus:border-indigo-accent/40 transition-all"
                    />
                    <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-zinc-dim">⌘+Enter to submit</span>
                        <button
                            onClick={handleSubmit}
                            disabled={!noteText.trim()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-accent hover:bg-indigo-hover text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                        >
                            <Send className="w-3 h-3" />
                            Add
                        </button>
                    </div>
                </div>
            </div>

            {/* Timeline search */}
            {contact.notes.length > 0 && (
                <div className="px-3 pt-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-dim" />
                        <input
                            type="text"
                            value={timelineFilter}
                            onChange={(e) => setTimelineFilter(e.target.value)}
                            placeholder="Filter timeline..."
                            className="w-full bg-white/5 border border-glass-border rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-text placeholder:text-zinc-dim focus:border-indigo-accent/40 transition-all"
                        />
                    </div>
                </div>
            )}

            {/* Timeline */}
            <div className="flex-1 overflow-auto px-3 py-3 space-y-0">
                {filteredNotes.length === 0 ? (
                    <div className="text-center py-12 text-zinc-dim text-sm">
                        {contact.notes.length === 0
                            ? 'No notes yet. Add the first one above.'
                            : 'No notes match your filter.'}
                    </div>
                ) : (
                    filteredNotes.map((note, idx) => {
                        const cat = NOTE_CATEGORIES.find((c) => c.key === note.category) || NOTE_CATEGORIES[3];
                        return (
                            <div key={note.id} className="relative pl-6 pb-4 group">
                                {/* Timeline line */}
                                {idx < filteredNotes.length - 1 && (
                                    <div className="absolute left-[9px] top-6 bottom-0 w-px bg-glass-border" />
                                )}
                                {/* Dot */}
                                <div className="absolute left-0 top-1 w-[18px] h-[18px] rounded-full bg-charcoal border-2 border-glass-border flex items-center justify-center text-[9px]">
                                    {cat.icon}
                                </div>
                                {/* Content */}
                                <div className="bg-white/[0.02] border border-glass-border/50 rounded-lg px-3 py-2.5 hover:bg-white/[0.04] transition-colors duration-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-semibold text-zinc-dim uppercase tracking-wider">
                                            {cat.label}
                                        </span>
                                        <span className="text-[10px] text-zinc-dim">
                                            {relativeTime(note.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-zinc-text leading-relaxed whitespace-pre-wrap">
                                        {note.text}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// Main SlideOver
export function SlideOver() {
    const drawerOpen = useStore((s) => s.drawerOpen);
    const closeDrawer = useStore((s) => s.closeDrawer);
    const selectedContactId = useStore((s) => s.selectedContactId);
    const contacts = useStore((s) => s.contacts);
    const updatePinnedNote = useStore((s) => s.updatePinnedNote);

    const contact = contacts.find((c) => c.id === selectedContactId);

    const [activeTab, setActiveTab] = useState('details');
    const [editingPinned, setEditingPinned] = useState(false);
    const [pinnedDraft, setPinnedDraft] = useState('');
    const pinnedRef = useRef(null);

    useEffect(() => {
        if (contact) {
            setPinnedDraft(contact.pinnedNote);
            setEditingPinned(false);
            setActiveTab('details');
        }
    }, [selectedContactId]);

    useEffect(() => {
        if (editingPinned && pinnedRef.current) {
            pinnedRef.current.focus();
        }
    }, [editingPinned]);

    const savePinned = () => {
        if (contact) {
            updatePinnedNote(contact.id, pinnedDraft);
        }
        setEditingPinned(false);
    };

    if (!contact) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-40 transition-all duration-300 ${drawerOpen
                        ? 'bg-black/50 backdrop-blur-sm opacity-100'
                        : 'opacity-0 pointer-events-none'
                    }`}
                onClick={closeDrawer}
            />

            {/* Panel */}
            <div
                className={`fixed top-0 right-0 z-50 h-[100dvh] w-full sm:w-[500px] flex flex-col bg-charcoal/95 backdrop-blur-2xl border-l border-glass-border shadow-2xl shadow-black/50 transition-transform duration-350 ${drawerOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                style={{
                    transitionTimingFunction: drawerOpen
                        ? 'cubic-bezier(0.32, 0.72, 0, 1)'
                        : 'cubic-bezier(0.72, 0, 0.68, 0.28)',
                    transitionDuration: drawerOpen ? '400ms' : '300ms',
                }}
            >
                {/* Header */}
                <div className="flex items-center gap-4 px-5 py-4 border-b border-glass-border">
                    <div className="w-11 h-11 rounded-xl bg-indigo-accent/20 border border-indigo-accent/30 flex items-center justify-center text-sm font-bold text-indigo-hover flex-shrink-0">
                        {getInitials(contact.contactName || contact.officeName)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-zinc-text truncate">
                            {contact.officeName || 'Unnamed'}
                        </h2>
                        <p className="text-sm text-zinc-muted truncate">
                            {contact.contactName || 'No contact'}
                        </p>
                    </div>
                    <button
                        onClick={closeDrawer}
                        className="p-2 rounded-lg hover:bg-white/5 text-zinc-dim transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Pinned Note */}
                <div className="mx-4 mt-3 mb-1">
                    <div
                        className={`rounded-lg border p-3 transition-all duration-150 ${editingPinned
                                ? 'bg-indigo-accent/10 border-indigo-accent/30'
                                : 'bg-indigo-accent/5 border-indigo-accent/15 hover:border-indigo-accent/25 cursor-pointer'
                            }`}
                        onClick={() => !editingPinned && setEditingPinned(true)}
                    >
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <Pin className="w-3 h-3 text-indigo-hover" />
                            <span className="text-[10px] font-semibold text-indigo-hover uppercase tracking-wider">
                                Pinned Note
                            </span>
                            {editingPinned && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        savePinned();
                                    }}
                                    className="ml-auto p-1 rounded hover:bg-white/10 text-indigo-hover cursor-pointer"
                                >
                                    <Check className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        {editingPinned ? (
                            <textarea
                                ref={pinnedRef}
                                value={pinnedDraft}
                                onChange={(e) => setPinnedDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        savePinned();
                                    }
                                    if (e.key === 'Escape') {
                                        setPinnedDraft(contact.pinnedNote);
                                        setEditingPinned(false);
                                    }
                                }}
                                onBlur={savePinned}
                                rows={3}
                                className="w-full bg-transparent text-sm text-zinc-text resize-none placeholder:text-zinc-dim border-none outline-none"
                                placeholder="Add important rules or notes about this contact..."
                            />
                        ) : (
                            <p className="text-sm text-zinc-text leading-relaxed">
                                {contact.pinnedNote || (
                                    <span className="text-zinc-dim italic">
                                        Click to add a pinned note...
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center border-b border-glass-border px-4 mt-2">
                    {[
                        { key: 'details', label: 'Details' },
                        { key: 'activity', label: 'Activity' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 cursor-pointer ${activeTab === tab.key
                                    ? 'text-indigo-hover border-indigo-accent'
                                    : 'text-zinc-dim border-transparent hover:text-zinc-text'
                                }`}
                        >
                            {tab.label}
                            {tab.key === 'activity' && contact.notes.length > 0 && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-indigo-accent/15 text-indigo-hover text-[10px] font-bold">
                                    {contact.notes.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-auto">
                    {activeTab === 'details' ? (
                        <div className="px-4 py-2">
                            <DetailsTab contact={contact} />
                        </div>
                    ) : (
                        <ActivityTab contact={contact} />
                    )}
                </div>
            </div>
        </>
    );
}
