import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Pencil, Check, X, Mail, Globe, MapPin,
    Pin, Send, Building2, User, Activity, MoreHorizontal, Search, UserPlus, Tag, Plus, Trash2
} from 'lucide-react';
import { useStore } from '../store.js';

// ── Helpers ──
function relativeDate(isoString) {
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getFaviconUrl(url) {
    if (!url) return null;
    try {
        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http')) cleanUrl = 'http://' + cleanUrl;
        const dom = new URL(cleanUrl).hostname;
        return `https://s2.googleusercontent.com/s2/favicons?domain=${dom}&sz=64`;
    } catch (e) {
        return null;
    }
}

// ── Editable Field with pencil icon ──
function EditableField({ label, value, onSave, multiline = false }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value || '');
    const [isSaving, setIsSaving] = useState(false);
    const ref = useRef(null);

    useEffect(() => { setDraft(value || ''); }, [value]);
    useEffect(() => {
        if (editing && ref.current) {
            ref.current.focus();
            if (ref.current.select) ref.current.select();
        }
    }, [editing]);

    const save = async () => {
        if (isSaving) return;
        if ((draft || '') === (value || '')) {
            setEditing(false);
            return;
        }

        setIsSaving(true);
        try {
            const result = await onSave(draft);
            if (result?.ok === false) return;
            setEditing(false);
        } finally {
            setIsSaving(false);
        }
    };
    const cancel = () => { setDraft(value || ''); setEditing(false); };

    return (
        <div className="group border-b border-white/5 py-3 last:border-0 relative">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">{label}</label>
            {editing ? (
                <div className="flex items-start gap-2 mt-2">
                    {multiline ? (
                        <textarea
                            ref={ref}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save();
                                if (e.key === 'Escape') cancel();
                            }}
                            rows={3}
                            className="flex-1 bg-obsidian border border-white/10 rounded-xl px-4 py-3 text-base text-white resize-none outline-none focus:border-neon-yellow transition-colors"
                        />
                    ) : (
                        <input
                            ref={ref}
                            type="text"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') save();
                                if (e.key === 'Escape') cancel();
                            }}
                            className="flex-1 bg-obsidian border border-white/10 rounded-xl px-4 py-3 text-base text-white outline-none focus:border-neon-yellow transition-colors"
                        />
                    )}
                    <div className="flex flex-col gap-1">
                        <button
                            onClick={save}
                            disabled={isSaving}
                            className="p-2.5 rounded-xl bg-neon-yellow hover:opacity-80 text-obsidian transition-colors cursor-pointer disabled:opacity-60"
                        >
                            <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={cancel}
                            disabled={isSaving}
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer disabled:opacity-60"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-start gap-2 pr-8 mt-1">
                    {/* Render Phone Link if label contains "Phone" */}
                    {label.includes('Phone') && value ? (
                        <p className="text-[15px] text-white break-words leading-relaxed">
                            <a href={`tel:${value}`} className="hover:text-neon-yellow transition-colors underline decoration-white/20 underline-offset-4">
                                {value}
                            </a>
                        </p>
                    ) : (
                        <p className="text-[15px] text-white break-words leading-relaxed">{value || <span className="text-gray-600 italic">—</span>}</p>
                    )}
                    <button
                        onClick={() => setEditing(true)}
                        className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-white/5 transition-all cursor-pointer"
                        title="Edit"
                    >
                        <Pencil className="w-3.5 h-3.5 text-neon-yellow" />
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Main Detail Page ──
export function ContactDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const contacts = useStore((s) => s.contacts);
    const updateContact = useStore((s) => s.updateContact);
    const addContact = useStore((s) => s.addContact);
    const setStatus = useStore((s) => s.setStatus);
    const addComment = useStore((s) => s.addComment);
    const updatePinnedNote = useStore((s) => s.updatePinnedNote);
    const addSpecialty = useStore((s) => s.addSpecialty);
    const removeSpecialty = useStore((s) => s.removeSpecialty);
    const getStats = useStore((s) => s.getStats);
    const canDelete = useStore((s) => s.canDelete);
    const deleteContact = useStore((s) => s.deleteContact);
    const getOfficeContacts = useStore((s) => s.getOfficeContacts);

    const contact = contacts.find(c => c.id === Number(id)) || null;
    const stats = getStats();
    const allSpecialties = stats.allSpecialties || [];

    const [editingPinned, setEditingPinned] = useState(false);
    const [pinnedDraft, setPinnedDraft] = useState('');
    const [commentText, setCommentText] = useState('');
    const [newSpecialty, setNewSpecialty] = useState('');
    const [addingPerson, setAddingPerson] = useState(false);
    const [isCreatingPerson, setIsCreatingPerson] = useState(false);
    const [newPersonData, setNewPersonData] = useState({ name: '', email: '', phone1: '' });
    const pinnedRef = useRef(null);

    const relatedContacts = useMemo(() => {
        if (!contact || !contact.officeName) return [];
        return getOfficeContacts(contact);
    }, [contacts, contact?.officeName, contact?.city]);
    const officeContacts = relatedContacts.length > 0 ? relatedContacts : (contact ? [contact] : []);
    const officeRecord = officeContacts[0] || contact;

    useEffect(() => {
        if (officeRecord) {
            setPinnedDraft(officeRecord.pinnedNote || '');
            setEditingPinned(false);
        }
    }, [officeRecord?.id]);

    useEffect(() => {
        if (editingPinned && pinnedRef.current) pinnedRef.current.focus();
    }, [editingPinned]);

    if (!contact) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-slate-dark flex items-center justify-center mb-6 shadow-heavy border border-white/5">
                    <Search className="w-8 h-8 text-gray-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Contact Not Found</h2>
                <p className="text-gray-400 text-base mb-6">The record you are looking for doesn't exist.</p>
                <button onClick={() => navigate('/')} className="px-6 py-3 rounded-pill bg-white/5 hover:bg-white/10 text-white text-base font-medium transition-colors cursor-pointer">
                    Return to Dashboard
                </button>
            </div>
        );
    }

    const updateOfficeFields = async (updates) => {
        const results = await Promise.all(officeContacts.map((c) => updateContact(c.id, updates)));
        const hasFailure = results.some((result) => result?.ok === false);
        return hasFailure ? { ok: false } : { ok: true };
    };

    const savePinned = async () => {
        if (!officeContacts.length) return;
        const result = await updatePinnedNote(officeContacts.map((c) => c.id), pinnedDraft);
        if (result?.ok) setEditingPinned(false);
    };

    const handleSubmitComment = () => {
        if (!commentText.trim() || officeContacts.length === 0) return;
        addComment(officeContacts.map((c) => c.id), commentText.trim());
        setCommentText('');
    };

    const handleCreateContact = async () => {
        if (isCreatingPerson) return;
        setIsCreatingPerson(true);
        try {
            const newId = await addContact({
                officeName: officeRecord?.officeName || '',
                streetAddress: officeRecord?.streetAddress || '',
                city: officeRecord?.city || '',
                state: officeRecord?.state || '',
                zip: officeRecord?.zip || '',
                website: officeRecord?.website || '',
                mailing: officeRecord?.mailing || '',
                who: officeRecord?.who || '',
                comments: officeRecord?.comments || '',
                a: !!officeRecord?.a,
                b: !!officeRecord?.b,
                c: !!officeRecord?.c,
                pinnedNote: officeRecord?.pinnedNote || '',
                specialties: officeRecord?.specialties || [],
                notes: officeRecord?.notes || [],
            });
            if (newId) {
                navigate(`/contact/${newId}`);
                // Smoothly scroll to the top so they can edit the Primary Contact section
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } finally {
            setIsCreatingPerson(false);
        }
    };

    const handleDeleteContact = async () => {
        if (!contact) return;
        const ok = window.confirm(`Delete contact "${contact.contactName || contact.officeName || contact.id}"? This cannot be undone.`);
        if (!ok) return;

        const result = await deleteContact(contact.id);
        if (result?.ok) {
            navigate('/');
        }
    };

    const currentStatus = officeRecord?.a ? 'a' : officeRecord?.b ? 'b' : officeRecord?.c ? 'c' : '';
    const faviconUrl = getFaviconUrl(officeRecord?.website);

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
            {/* ── Floating Action Bar (Top) ── */}
            <div className="sticky top-6 z-50 flex items-center justify-between bg-slate-dark/80 backdrop-blur-md rounded-pill p-2 shadow-heavy border border-white/10">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 pl-4 pr-5 py-2.5 rounded-full text-base font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Dashboard
                </button>

                {/* Top Status Indicator */}
                <div className="pr-4 flex items-center gap-3">
                    {canDelete() && (
                        <button
                            onClick={handleDeleteContact}
                            className="w-10 h-10 rounded-full border border-red-500/40 text-red-400 hover:bg-red-500/15 transition-colors flex items-center justify-center cursor-pointer"
                            title="Delete Contact"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest hidden sm:inline-block">Status</span>
                    <div className="flex items-center gap-1 bg-obsidian rounded-pill p-1 border border-white/5">
                        {[
                            { key: 'a', label: 'A', activeClass: 'text-[#10B981] border-2 border-[#10B981] shadow-sm bg-obsidian', inactiveClass: 'text-gray-500 hover:text-white border-2 border-transparent' },
                            { key: 'b', label: 'B', activeClass: 'text-[#22C55E] border-2 border-[#22C55E] shadow-sm bg-obsidian', inactiveClass: 'text-gray-500 hover:text-white border-2 border-transparent' },
                            { key: 'c', label: 'C', activeClass: 'text-[#059669] border-2 border-[#059669] shadow-sm bg-obsidian', inactiveClass: 'text-gray-500 hover:text-white border-2 border-transparent' },
                            { key: '', label: 'None', activeClass: 'bg-slate-dark text-white border-2 border-white/10 shadow-sm', inactiveClass: 'text-gray-500 hover:text-white border-2 border-transparent' },
                        ].map((s) => {
                            const isActive = currentStatus === s.key;
                            return (
                                <button
                                    key={s.key}
                                    onClick={() => setStatus(officeContacts.map((c) => c.id), s.key)}
                                    className={`w-10 h-10 sm:w-auto sm:px-5 rounded-full sm:rounded-pill text-sm font-bold transition-all cursor-pointer flex items-center justify-center ${isActive ? s.activeClass : s.inactiveClass
                                        }`}
                                >
                                    {s.label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* ── Hero Profile ── */}
            <div className="bg-slate-dark rounded-5xl p-8 lg:p-10 shadow-card border border-white/5 relative overflow-hidden flex flex-col items-start gap-8">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <Building2 className="w-64 h-64 text-white" />
                </div>

                <div className="w-full relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                        {/* Avatar / Favicon */}
                        <div className="w-24 h-24 rounded-full bg-obsidian border-4 border-slate-dark shadow-heavy flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {faviconUrl ? (
                                <img src={faviconUrl} alt="Favicon" className="w-12 h-12 object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center ${faviconUrl ? 'hidden' : ''}`}>
                                <Building2 className="w-8 h-8 text-gray-500" />
                            </div>
                        </div>

                        <div className="flex-1">
                            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-2 tracking-tight">{officeRecord?.officeName || 'Unnamed Office'}</h1>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px] text-gray-400 font-medium tracking-wide">
                                {officeRecord?.city && <span className="flex items-center gap-1.5"><MapPin className="w-5 h-5 text-gray-500" /> {officeRecord.city}{officeRecord.state ? `, ${officeRecord.state}` : ''}</span>}
                                {officeRecord?.email && (
                                    <a href={`mailto:${officeRecord.email}`} className="flex items-center gap-1.5 hover:text-neon-yellow transition-colors">
                                        <Mail className="w-5 h-5 text-gray-500" /> Email
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Add Contact Button */}
                    <button
                        onClick={handleCreateContact}
                        disabled={isCreatingPerson}
                        className="flex-shrink-0 self-start md:self-auto bg-white/5 hover:bg-olive text-white hover:text-obsidian px-6 py-3 rounded-pill text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm border border-white/10 border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <UserPlus className="w-4 h-4" />
                        {isCreatingPerson ? 'Saving...' : 'Add Person to Office'}
                    </button>
                </div>
            </div>

            {/* ── Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── Left Column ── */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Company Info */}
                    <div className="bg-slate-dark rounded-4xl p-8 shadow-card border border-white/5">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                            <div className="w-10 h-10 rounded-full bg-obsidian flex items-center justify-center border border-white/10">
                                <Building2 className="w-4 h-4 text-emerald" />
                            </div>
                            <h3 className="text-lg font-bold text-white uppercase tracking-widest">Company Details</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                            <EditableField label="Office Name" value={officeRecord?.officeName} onSave={(v) => updateOfficeFields({ officeName: v })} />
                            <EditableField label="Street Address" value={officeRecord?.streetAddress} onSave={(v) => updateOfficeFields({ streetAddress: v })} />
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1">
                                <EditableField label="City" value={officeRecord?.city} onSave={(v) => updateOfficeFields({ city: v })} />
                                <EditableField label="State" value={officeRecord?.state} onSave={(v) => updateOfficeFields({ state: v })} />
                                <EditableField label="Zip" value={officeRecord?.zip} onSave={(v) => updateOfficeFields({ zip: v })} />
                            </div>
                            <EditableField label="Website" value={officeRecord?.website} onSave={(v) => updateOfficeFields({ website: v })} />
                            <EditableField label="Mailing" value={officeRecord?.mailing} onSave={(v) => updateOfficeFields({ mailing: v })} />
                            <EditableField label="WHO" value={officeRecord?.who} onSave={(v) => updateOfficeFields({ who: v })} />
                            <EditableField label="Phone 1" value={officeRecord?.phone1} onSave={(v) => updateOfficeFields({ phone1: v })} type="tel" />
                            <EditableField label="Phone 2" value={officeRecord?.phone2} onSave={(v) => updateOfficeFields({ phone2: v })} type="tel" />
                        </div>
                    </div>

                    {/* Critical Note */}
                    <div className="bg-danger/10 border border-danger/20 rounded-4xl p-6 shadow-inner relative group">
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-danger/20">
                            <div className="w-8 h-8 rounded-full bg-danger/20 flex items-center justify-center border border-danger/30">
                                <Pin className="w-3.5 h-3.5 text-danger" />
                            </div>
                            <h3 className="text-[15px] font-bold text-danger uppercase tracking-widest">Critical Note</h3>
                        </div>

                        <div className="relative">
                            {editingPinned ? (
                                <div className="space-y-3">
                                    <textarea
                                        ref={pinnedRef}
                                        value={pinnedDraft}
                                        onChange={(e) => setPinnedDraft(e.target.value)}
                                        className="w-full h-32 bg-obsidian/50 border border-danger/30 rounded-xl p-4 text-[15px] text-white outline-none focus:border-danger transition-colors resize-none leading-relaxed"
                                        placeholder="Add an important critical note..."
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => { setPinnedDraft(officeRecord?.pinnedNote || ''); setEditingPinned(false); }} className="px-4 py-2 rounded-full text-sm font-medium hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer transition-colors">Cancel</button>
                                        <button onClick={savePinned} className="px-5 py-2 rounded-full text-sm font-bold bg-danger hover:bg-red-600 text-white transition-colors shadow-sm cursor-pointer">
                                            Save Note
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="group/note">
                                    {officeRecord?.pinnedNote ? (
                                        <p className="text-[15px] text-white leading-relaxed whitespace-pre-wrap pr-8">
                                            {officeRecord.pinnedNote}
                                        </p>
                                    ) : (
                                        <p className="text-[15px] text-danger/60 italic">No critical note attached.</p>
                                    )}
                                    <button
                                        onClick={() => {
                                            setPinnedDraft(officeRecord?.pinnedNote || '');
                                            setEditingPinned(true);
                                        }}
                                        className="absolute right-0 top-0 p-2 rounded-full opacity-0 group-hover/note:opacity-100 hover:bg-danger/20 transition-all cursor-pointer"
                                        title="Edit Critical Note"
                                    >
                                        <Pencil className="w-3.5 h-3.5 text-danger" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Comments section */}
                    <div className="bg-slate-dark rounded-4xl shadow-card border border-white/5 flex flex-col h-[600px]">
                        <div className="p-6 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-obsidian flex items-center justify-center border border-white/10">
                                    <Activity className="w-4 h-4 text-emerald" />
                                </div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-widest">Comments</h3>
                                <span className="ml-auto bg-obsidian text-emerald text-xs font-bold px-3 py-1.5 rounded-full border border-white/5 shadow-inner">
                                    {officeRecord?.notes?.length || 0}
                                </span>
                            </div>
                        </div>

                        {/* Comment Input */}
                        <div className="p-6 bg-obsidian/20 border-b border-white/5 flex flex-col gap-3">
                            <textarea
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSubmitComment(); } }}
                                placeholder="Log a new comment..."
                                rows={2}
                                className="w-full bg-obsidian border border-white/10 rounded-2xl px-4 py-3 text-base text-white placeholder:text-gray-600 resize-none outline-none focus:border-olive transition-colors scrollbar-hide shadow-inner"
                            />
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono text-gray-600">⌘+Enter to save</span>
                                <button
                                    onClick={handleSubmitComment}
                                    disabled={!commentText.trim()}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-olive hover:bg-lime text-obsidian text-sm font-bold disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
                                >
                                    <Send className="w-4 h-4" />
                                    Post
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-auto p-4 space-y-3 custom-scrollbar">
                            {!officeRecord?.notes?.length ? (
                                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                                    <MoreHorizontal className="w-8 h-8 text-gray-700 mb-3" />
                                    <p className="text-gray-500 text-[15px]">No comments yet. Log activity above.</p>
                                </div>
                            ) : (
                                officeRecord.notes.map((note) => (
                                    <div key={note.id} className="bg-obsidian/50 border border-white/5 rounded-3xl p-5 hover:border-white/10 transition-colors">
                                        <p className="text-[15px] text-gray-300 leading-relaxed whitespace-pre-wrap">{note.text}</p>
                                        <p className="text-xs font-medium text-gray-500 mt-3 flex justify-end gap-2">
                                            {note.author && <span>{note.author.split('@')[0]} ·</span>}
                                            {relativeDate(note.timestamp)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Right Column ── */}
                <div className="space-y-6">

                    {/* Contacts */}
                    <div className="bg-slate-dark rounded-4xl p-8 shadow-card border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-olive/5 rounded-bl-full pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-obsidian flex items-center justify-center border border-white/10">
                                    <User className="w-4 h-4 text-emerald" />
                                </div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-widest">Contacts</h3>
                            </div>
                        </div>

                        <div className="mb-6 relative z-10 space-y-4">
                            <h4 className="text-xs font-bold text-emerald uppercase tracking-widest">People in This Office</h4>
                            {officeContacts
                                .slice()
                                .sort((a, b) => (a.contactName || '').localeCompare(b.contactName || '') || a.id - b.id)
                                .map((person) => (
                                    <div key={person.id} className="rounded-2xl border border-white/10 bg-obsidian/50 p-4">
                                        <div className="grid grid-cols-1 gap-1">
                                            <EditableField label="Contact Name" value={person.contactName} onSave={(v) => updateContact(person.id, { contactName: v })} />
                                            <EditableField label="Email Address" value={person.email} onSave={(v) => updateContact(person.id, { email: v })} />
                                            <EditableField label="Phone" value={person.phone1} onSave={(v) => updateContact(person.id, { phone1: v })} />
                                        </div>
                                    </div>
                                ))}
                        </div>
                        {/* Add Person Form */}
                        <div className="border-t border-white/5 pt-6 relative z-10">
                            {!addingPerson ? (
                                <button onClick={() => setAddingPerson(true)} className="flex items-center gap-2 text-sm font-bold text-emerald hover:text-emerald/80 transition-colors uppercase tracking-widest cursor-pointer w-full py-2 justify-center rounded-xl bg-emerald/10 hover:bg-emerald/20 border border-emerald/20">
                                    <UserPlus className="w-4 h-4" /> Add Person to Office
                                </button>
                            ) : (
                                <div className="bg-obsidian rounded-2xl p-4 border border-emerald/20 shadow-inner">
                                    <h4 className="text-sm font-bold text-white mb-4">New Colleague</h4>
                                    <div className="space-y-3 mb-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Name</label>
                                            <input type="text" value={newPersonData.name} onChange={e => setNewPersonData({ ...newPersonData, name: e.target.value })} className="w-full bg-slate-dark border border-white/10 rounded-xl px-4 py-2 text-[15px] text-white outline-none focus:border-emerald transition-colors" placeholder="e.g. Jane Doe" autoFocus />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Email</label>
                                            <input type="email" value={newPersonData.email} onChange={e => setNewPersonData({ ...newPersonData, email: e.target.value })} className="w-full bg-slate-dark border border-white/10 rounded-xl px-4 py-2 text-[15px] text-white outline-none focus:border-emerald transition-colors" placeholder="jane@example.com" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Phone</label>
                                            <input type="tel" value={newPersonData.phone1 || ''} onChange={e => setNewPersonData({ ...newPersonData, phone1: e.target.value })} className="w-full bg-slate-dark border border-white/10 rounded-xl px-4 py-2 text-[15px] text-white outline-none focus:border-emerald transition-colors" placeholder="(555) 123-4567" />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => { setAddingPerson(false); setNewPersonData({ name: '', email: '', phone1: '' }); }} className="px-4 py-2 rounded-pill text-sm font-medium hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer transition-colors">Cancel</button>
                                        <button onClick={async () => {
                                            if (!newPersonData.name.trim() || isCreatingPerson) return;
                                            setIsCreatingPerson(true);
                                            try {
                                                const newId = await addContact({
                                                    ...officeRecord,
                                                    contactName: newPersonData.name.trim(),
                                                    email: newPersonData.email.trim(),
                                                    phone1: newPersonData.phone1?.trim() || '',
                                                    phone2: '',
                                                });
                                                if (!newId) return;
                                                setAddingPerson(false);
                                                setNewPersonData({ name: '', email: '', phone1: '' });
                                            } finally {
                                                setIsCreatingPerson(false);
                                            }
                                        }} className="px-5 py-2 rounded-pill text-sm font-bold bg-emerald hover:bg-emerald/90 text-obsidian transition-colors shadow-sm cursor-pointer disabled:opacity-50" disabled={!newPersonData.name.trim() || isCreatingPerson}>{isCreatingPerson ? 'Saving...' : 'Save Colleague'}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Specialties */}
                    <div className="bg-slate-dark rounded-4xl p-8 shadow-card border border-white/5">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                            <div className="w-10 h-10 rounded-full bg-obsidian flex items-center justify-center border border-white/10">
                                <Tag className="w-4 h-4 text-emerald" />
                            </div>
                            <h3 className="text-lg font-bold text-white uppercase tracking-widest">Specialties</h3>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-6">
                            {(officeRecord?.specialties || []).map(s => (
                                <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 bg-obsidian border border-white/10 rounded-pill text-sm font-medium text-white shadow-sm">
                                    {s}
                                    <button
                                        onClick={() => removeSpecialty(officeContacts.map((c) => c.id), s)}
                                        className="text-gray-500 hover:text-danger hover:bg-white/5 rounded-full p-0.5 transition-colors cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                            {(!officeRecord?.specialties || officeRecord.specialties.length === 0) && (
                                <span className="text-gray-500 text-[15px] italic">No specialties added yet.</span>
                            )}
                        </div>

                        <div className="relative flex items-center gap-2">
                            <input
                                list="specialties-list"
                                type="text"
                                value={newSpecialty}
                                onChange={(e) => setNewSpecialty(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newSpecialty.trim()) {
                                        e.preventDefault();
                                        addSpecialty(officeContacts.map((c) => c.id), newSpecialty.trim());
                                        setNewSpecialty('');
                                    }
                                }}
                                placeholder="Add a specialty... (e.g. Pain Dr)"
                                className="flex-1 bg-obsidian border border-white/10 rounded-pill px-5 py-3 text-[15px] text-white placeholder-gray-500 outline-none focus:border-emerald/50 transition-colors"
                            />
                            <datalist id="specialties-list">
                                {allSpecialties.map(s => <option key={s} value={s} />)}
                            </datalist>
                            <button
                                onClick={() => {
                                    if (newSpecialty.trim()) {
                                        addSpecialty(officeContacts.map((c) => c.id), newSpecialty.trim());
                                        setNewSpecialty('');
                                    }
                                }}
                                disabled={!newSpecialty.trim()}
                                className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-dark text-white hover:bg-emerald hover:text-obsidian disabled:opacity-30 disabled:hover:bg-slate-dark disabled:hover:text-white transition-all cursor-pointer shadow-sm border border-white/10 border-transparent flex-shrink-0"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
