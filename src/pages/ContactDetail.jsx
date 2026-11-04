import { useState, useEffect, useRef, useMemo, createContext, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Pencil, Check, X, Mail, Globe, Send, Search, UserPlus, Plus, Phone, ChevronLeft, MessageSquare, Navigation, Share
} from 'lucide-react';
import { ShareContactSheet } from '../components/ShareContact.jsx';
import { initialsFor, tierOf, TIER_AVATAR } from '../components/ContactList.jsx';
import { useStore } from '../store.js';

// ── Helpers ──
function relativeDate(isoString) {
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Fields are read-only until the user taps Edit (phone and desktop alike).
const EditContext = createContext(false);

const digits = (v) => (v || '').replace(/[^\d+]/g, '');
const isDialable = (v) => /\d{7,}/.test((v || '').replace(/\D/g, ''));
const webHref = (v) => (!v ? null : /^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`);
const mapsHref = (q) => (q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null);

function ActionButton({ href, onClick, icon: Icon, label, external }) {
    const inner = (
        <>
            <span className="w-12 h-12 rounded-full bg-white/[0.08] flex items-center justify-center group-hover:bg-white/[0.14] transition-colors">
                <Icon className="w-5 h-5" />
            </span>
            <span className="mt-1.5 text-[11px] font-medium">{label}</span>
        </>
    );
    if (onClick) {
        return (
            <button type="button" onClick={onClick} className="group flex flex-col items-center text-emerald active:opacity-60 cursor-pointer">
                {inner}
            </button>
        );
    }
    if (!href) return <span className="flex flex-col items-center text-gray-600 opacity-60" aria-disabled="true">{inner}</span>;
    return (
        <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} className="group flex flex-col items-center text-emerald active:opacity-60">
            {inner}
        </a>
    );
}

function InfoRow({ label, value, href, external }) {
    if (!value) return null;
    return (
        <div className="px-4 py-2.5 border-b border-white/[0.06] last:border-0">
            <p className="text-[13px] text-gray-500">{label}</p>
            {href ? (
                <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} className="block text-[16px] md:text-[15px] text-emerald break-words hover:underline active:opacity-60">{value}</a>
            ) : (
                <p className="text-[16px] md:text-[15px] text-white break-words whitespace-pre-wrap">{value}</p>
            )}
        </div>
    );
}

function Section({ title, right, children, tone }) {
    return (
        <section>
            <div className="flex items-center justify-between px-1 mb-1.5 min-h-[20px]">
                <h3 className={`text-[12px] font-semibold uppercase tracking-wider ${tone === 'danger' ? 'text-danger/90' : 'text-gray-500'}`}>{title}</h3>
                {right}
            </div>
            <div className={`rounded-2xl border overflow-hidden ${tone === 'danger' ? 'bg-danger/10 border-danger/25' : 'bg-slate-dark border-white/5'}`}>
                {children}
            </div>
        </section>
    );
}

// ── Editable field (shown in Edit mode): tap the value to change it ──
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
    const inputClass = 'flex-1 min-w-0 bg-obsidian border border-white/10 rounded-xl px-3 py-2 text-[16px] md:text-[15px] text-white outline-none focus:border-emerald/60 transition-colors';

    return (
        <div className="px-4 py-2.5 border-b border-white/[0.06] last:border-0">
            <label className="text-[13px] text-gray-500 block">{label}</label>
            {editing ? (
                <div className="flex items-start gap-2 mt-1.5">
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
                            className={`${inputClass} resize-none`}
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
                            className={inputClass}
                        />
                    )}
                    <button onClick={save} disabled={isSaving} aria-label="Save" className="w-9 h-9 shrink-0 rounded-full bg-emerald text-obsidian flex items-center justify-center cursor-pointer disabled:opacity-60">
                        <Check className="w-4 h-4" strokeWidth={3} />
                    </button>
                    <button onClick={cancel} disabled={isSaving} aria-label="Cancel" className="w-9 h-9 shrink-0 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 flex items-center justify-center cursor-pointer disabled:opacity-60">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <button type="button" onClick={() => setEditing(true)} className="group w-full flex items-center gap-2 text-left mt-0.5 cursor-text">
                    <span className={`flex-1 min-w-0 text-[16px] md:text-[15px] break-words ${value ? 'text-white' : 'text-gray-600'}`}>
                        {value || `Add ${label.toLowerCase()}`}
                    </span>
                    <Pencil className="w-3.5 h-3.5 shrink-0 text-neon-yellow opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
            )}
        </div>
    );
}

export function ContactDetail({ embedded = false }) {
    const { id } = useParams();
    const rootRef = useRef(null);
    useEffect(() => {
        if (embedded) rootRef.current?.closest('[data-pane]')?.scrollTo(0, 0);
        else window.scrollTo(0, 0);
    }, [id, embedded]);
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
    const [editMode, setEditMode] = useState(false);
    const [showAllNotes, setShowAllNotes] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    useEffect(() => { setEditMode(false); setShowAllNotes(false); setShareOpen(false); setAddingPerson(false); setEditingPinned(false); }, [id]);

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
    const tier = tierOf(officeRecord);
    const callNum = [contact.phone1, officeRecord?.phone1, officeRecord?.phone2].find(isDialable);
    const emailAddr = contact.email || officeRecord?.email || '';
    const cityLine = [officeRecord?.city, [officeRecord?.state, officeRecord?.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const fullAddress = officeRecord?.streetAddress || officeRecord?.city
        ? [officeRecord?.streetAddress, cityLine].filter(Boolean).join(', ')
        : '';
    const heroSub = [contact.contactName, [officeRecord?.city, officeRecord?.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
    const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'));

    const people = officeContacts
        .slice()
        .sort((a, b) => (a.contactName || '').localeCompare(b.contactName || '') || a.id - b.id);
    const notes = officeRecord?.notes || [];
    const visibleNotes = showAllNotes ? notes : notes.slice(0, 5);
    const officeIds = officeContacts.map((c) => c.id);
    const addSpecialtyNow = () => {
        if (!newSpecialty.trim()) return;
        addSpecialty(officeIds, newSpecialty.trim());
        setNewSpecialty('');
    };
    const savePerson = async () => {
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
    };
    const smallInput = 'w-full bg-obsidian border border-white/10 rounded-xl px-3 py-2 text-[16px] md:text-[15px] text-white outline-none focus:border-emerald/60 transition-colors';

    return (
        <EditContext.Provider value={editMode}>
        <div ref={rootRef} className={embedded ? 'min-h-full' : 'pb-12 animate-fade-in'}>
            {/* ── Top bar ── */}
            <div className={embedded
                ? 'sticky top-0 z-20 h-12 px-4 lg:px-6 flex items-center gap-2 bg-obsidian/90 backdrop-blur-md border-b border-white/5'
                : 'sticky top-14 z-30 -mx-3 -mt-4 px-1 h-11 flex items-center justify-between bg-obsidian/95 backdrop-blur-md border-b border-white/5'}>
                {!embedded && (
                    <button onClick={goBack} className="flex items-center h-10 pr-3 text-[16px] text-emerald active:opacity-60">
                        <ChevronLeft className="w-6 h-6" strokeWidth={2.25} /> Contacts
                    </button>
                )}
                {embedded && (
                    <span className="mr-auto min-w-0 truncate text-[13px] text-gray-500">
                        {editMode ? 'Editing. Click any field to change it.' : 'Up/Down arrows move through the list'}
                    </span>
                )}
                <button
                    onClick={() => setEditMode((v) => !v)}
                    className={`h-9 px-4 rounded-full text-[15px] font-semibold cursor-pointer transition-colors ${editMode ? 'bg-emerald text-obsidian hover:bg-emerald/90' : 'text-emerald hover:bg-white/5'}`}
                >
                    {editMode ? 'Done' : 'Edit'}
                </button>
            </div>

            <div className={embedded ? 'max-w-[1040px] mx-auto px-6 lg:px-10 pt-8 pb-16' : 'pt-4'}>
                {/* ── Card header ── */}
                <div className="flex flex-col items-center text-center">
                    <span className={`w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center text-[34px] md:text-[38px] font-bold ${TIER_AVATAR[tier]}`}>
                        {initialsFor(officeRecord)}
                    </span>
                    <h1 className="mt-3 px-4 text-[26px] md:text-[32px] font-bold leading-tight text-white tracking-tight break-words">
                        {officeRecord?.officeName || 'Unnamed Office'}
                    </h1>
                    {heroSub && <p className="mt-1 px-4 text-[15px] text-gray-400">{heroSub}</p>}
                    <div className="mt-3 inline-flex bg-white/[0.06] rounded-full p-1 gap-1" role="group" aria-label="Tier">
                        {[['a', 'A'], ['b', 'B'], ['c', 'C'], ['', 'None']].map(([k, l]) => (
                            <button
                                key={l}
                                onClick={() => setStatus(officeIds, k)}
                                aria-pressed={currentStatus === k}
                                className={`h-8 min-w-[44px] px-3 rounded-full text-[13px] font-bold transition-colors cursor-pointer ${currentStatus === k ? 'bg-white text-obsidian' : 'text-gray-400 hover:text-white'}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                    <div className="mt-5 w-full max-w-[480px] grid grid-cols-6 gap-0.5 px-0.5">
                        <ActionButton href={callNum ? `tel:${digits(callNum)}` : null} icon={Phone} label="call" />
                        <ActionButton href={callNum ? `sms:${digits(callNum)}` : null} icon={MessageSquare} label="text" />
                        <ActionButton href={emailAddr ? `mailto:${emailAddr}` : null} icon={Mail} label="email" />
                        <ActionButton href={mapsHref(fullAddress)} icon={Navigation} label="directions" external />
                        <ActionButton href={webHref(officeRecord?.website)} icon={Globe} label="website" external />
                        <ActionButton onClick={() => setShareOpen(true)} icon={Share} label="share" />
                    </div>
                </div>

                <div className="mt-7 grid grid-cols-1 xl:grid-cols-2 gap-5 xl:items-start">
                    <div className="space-y-5 min-w-0">
                        {/* ── Details ── */}
                        {editMode ? (
                            <Section title="Company details">
                                <EditableField label="Office name" value={officeRecord?.officeName} onSave={(v) => updateOfficeFields({ officeName: v })} />
                                <EditableField label="Phone" value={officeRecord?.phone1} onSave={(v) => updateOfficeFields({ phone1: v })} />
                                <EditableField label="Phone 2" value={officeRecord?.phone2} onSave={(v) => updateOfficeFields({ phone2: v })} />
                                <EditableField label="Street address" value={officeRecord?.streetAddress} onSave={(v) => updateOfficeFields({ streetAddress: v })} />
                                <EditableField label="City" value={officeRecord?.city} onSave={(v) => updateOfficeFields({ city: v })} />
                                <EditableField label="State" value={officeRecord?.state} onSave={(v) => updateOfficeFields({ state: v })} />
                                <EditableField label="Zip" value={officeRecord?.zip} onSave={(v) => updateOfficeFields({ zip: v })} />
                                <EditableField label="Website" value={officeRecord?.website} onSave={(v) => updateOfficeFields({ website: v })} />
                                <EditableField label="Mailing" value={officeRecord?.mailing} onSave={(v) => updateOfficeFields({ mailing: v })} />
                                <EditableField label="Who" value={officeRecord?.who} onSave={(v) => updateOfficeFields({ who: v })} />
                            </Section>
                        ) : (
                            <Section title="Details">
                                <InfoRow label="phone" value={officeRecord?.phone1} href={isDialable(officeRecord?.phone1) ? `tel:${digits(officeRecord.phone1)}` : null} />
                                <InfoRow label="phone 2" value={officeRecord?.phone2} href={isDialable(officeRecord?.phone2) ? `tel:${digits(officeRecord.phone2)}` : null} />
                                <InfoRow label="email" value={officeRecord?.email} href={officeRecord?.email ? `mailto:${officeRecord.email}` : null} />
                                <InfoRow label="address" value={fullAddress} href={mapsHref(fullAddress)} external />
                                <InfoRow label="website" value={officeRecord?.website} href={webHref(officeRecord?.website)} external />
                                <InfoRow label="mailing" value={officeRecord?.mailing} />
                                <InfoRow label="who" value={officeRecord?.who} />
                                {!officeRecord?.phone1 && !officeRecord?.phone2 && !officeRecord?.email && !fullAddress && !officeRecord?.website && (
                                    <button onClick={() => setEditMode(true)} className="w-full px-4 py-3 text-left text-[15px] text-gray-500 hover:text-white cursor-pointer">No details yet. Tap Edit to add them.</button>
                                )}
                            </Section>
                        )}

                        {/* ── People ── */}
                        <Section title="People in this office" right={<span className="text-[12px] text-gray-500">{people.length}</span>}>
                            {people.map((person) => editMode ? (
                                <div key={person.id} className="border-b border-white/10 last:border-0">
                                    <EditableField label="Name" value={person.contactName} onSave={(v) => updateContact(person.id, { contactName: v })} />
                                    <EditableField label="Email" value={person.email} onSave={(v) => updateContact(person.id, { email: v })} />
                                    <EditableField label="Phone" value={person.phone1} onSave={(v) => updateContact(person.id, { phone1: v })} />
                                </div>
                            ) : (
                                <div key={person.id} className="px-4 py-3 flex items-center gap-3 border-b border-white/[0.06] last:border-0">
                                    <span className="shrink-0 w-9 h-9 rounded-full bg-white/10 text-gray-300 text-[13px] font-bold flex items-center justify-center">
                                        {initialsFor({ officeName: person.contactName || '?' })}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[15px] text-white truncate">{person.contactName || <span className="text-gray-500 italic">No name</span>}</p>
                                        <div className="text-[13px] flex flex-wrap gap-x-3">
                                            {person.email && <a href={`mailto:${person.email}`} className="text-emerald truncate max-w-full hover:underline">{person.email}</a>}
                                            {person.phone1 && (isDialable(person.phone1)
                                                ? <a href={`tel:${digits(person.phone1)}`} className="text-emerald hover:underline">{person.phone1}</a>
                                                : <span className="text-gray-400">{person.phone1}</span>)}
                                        </div>
                                    </div>
                                    {isDialable(person.phone1) && (
                                        <a href={`tel:${digits(person.phone1)}`} aria-label={`Call ${person.contactName || ''}`} className="shrink-0 w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-emerald flex items-center justify-center">
                                            <Phone className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                            ))}
                            {addingPerson ? (
                                <div className="p-4 space-y-2.5 bg-obsidian/40 border-t border-white/[0.06]">
                                    <input type="text" value={newPersonData.name} onChange={(e) => setNewPersonData({ ...newPersonData, name: e.target.value })} className={smallInput} placeholder="Name" autoFocus />
                                    <input type="email" value={newPersonData.email} onChange={(e) => setNewPersonData({ ...newPersonData, email: e.target.value })} className={smallInput} placeholder="Email" />
                                    <input type="tel" value={newPersonData.phone1 || ''} onChange={(e) => setNewPersonData({ ...newPersonData, phone1: e.target.value })} className={smallInput} placeholder="Phone" />
                                    <div className="flex justify-end gap-2 pt-1">
                                        <button onClick={() => { setAddingPerson(false); setNewPersonData({ name: '', email: '', phone1: '' }); }} className="h-9 px-4 rounded-full text-[14px] text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer">Cancel</button>
                                        <button onClick={savePerson} disabled={!newPersonData.name.trim() || isCreatingPerson} className="h-9 px-4 rounded-full text-[14px] font-bold bg-emerald text-obsidian disabled:opacity-40 cursor-pointer">
                                            {isCreatingPerson ? 'Saving…' : 'Add person'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => setAddingPerson(true)} className="w-full px-4 py-3 flex items-center gap-2 text-[15px] text-emerald hover:bg-white/[0.03] border-t border-white/[0.06] cursor-pointer">
                                    <UserPlus className="w-4 h-4" /> Add person to this office
                                </button>
                            )}
                        </Section>
                    </div>

                    <div className="space-y-5 min-w-0">
                        {/* ── Critical note ── */}
                        {(officeRecord?.pinnedNote || editMode || editingPinned) && (
                            <Section
                                title="Critical note"
                                tone="danger"
                                right={!editingPinned && (
                                    <button onClick={() => { setPinnedDraft(officeRecord?.pinnedNote || ''); setEditingPinned(true); }} className="text-[13px] font-semibold text-danger/90 hover:text-danger cursor-pointer">
                                        {officeRecord?.pinnedNote ? 'Edit' : 'Add'}
                                    </button>
                                )}
                            >
                                {editingPinned ? (
                                    <div className="p-3 space-y-2">
                                        <textarea
                                            ref={pinnedRef}
                                            value={pinnedDraft}
                                            onChange={(e) => setPinnedDraft(e.target.value)}
                                            rows={4}
                                            className="w-full bg-obsidian/60 border border-danger/30 rounded-xl p-3 text-[16px] md:text-[15px] text-white outline-none focus:border-danger resize-none leading-relaxed"
                                            placeholder="Something everyone must know before contacting this office"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => { setPinnedDraft(officeRecord?.pinnedNote || ''); setEditingPinned(false); }} className="h-9 px-4 rounded-full text-[14px] text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer">Cancel</button>
                                            <button onClick={savePinned} className="h-9 px-4 rounded-full text-[14px] font-bold bg-danger text-white hover:bg-red-600 cursor-pointer">Save note</button>
                                        </div>
                                    </div>
                                ) : officeRecord?.pinnedNote ? (
                                    <p className="px-4 py-3 text-[15px] text-white leading-relaxed whitespace-pre-wrap">{officeRecord.pinnedNote}</p>
                                ) : (
                                    <p className="px-4 py-3 text-[15px] text-danger/60 italic">No critical note.</p>
                                )}
                            </Section>
                        )}

                        {/* ── Specialties ── */}
                        <Section
                            title="Specialties"
                            right={!editMode && (
                                <button onClick={() => setEditMode(true)} className="text-[13px] font-semibold text-emerald hover:underline cursor-pointer">Add</button>
                            )}
                        >
                            <div className="p-3 flex flex-wrap gap-2">
                                {(officeRecord?.specialties || []).map((sp) => (
                                    <span key={sp} className="inline-flex items-center gap-1 h-8 pl-3 pr-2 rounded-full bg-white/[0.06] border border-white/10 text-[14px] text-white">
                                        {sp}
                                        {editMode && (
                                            <button onClick={() => removeSpecialty(officeIds, sp)} aria-label={`Remove ${sp}`} className="w-5 h-5 rounded-full text-gray-400 hover:text-danger hover:bg-white/5 flex items-center justify-center cursor-pointer">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </span>
                                ))}
                                {!officeRecord?.specialties?.length && <span className="px-1 py-1 text-[15px] text-gray-500">None yet.</span>}
                            </div>
                            {editMode && (
                                <div className="px-3 pb-3 flex items-center gap-2">
                                    <input
                                        list="specialties-list"
                                        type="text"
                                        value={newSpecialty}
                                        onChange={(e) => setNewSpecialty(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpecialtyNow(); } }}
                                        placeholder="Add a specialty (e.g. Pain Dr)"
                                        className={`${smallInput} flex-1`}
                                    />
                                    <datalist id="specialties-list">
                                        {allSpecialties.map((sp) => <option key={sp} value={sp} />)}
                                    </datalist>
                                    <button onClick={addSpecialtyNow} disabled={!newSpecialty.trim()} aria-label="Add specialty" className="w-10 h-10 shrink-0 rounded-full bg-emerald text-obsidian disabled:opacity-30 flex items-center justify-center cursor-pointer">
                                        <Plus className="w-5 h-5" strokeWidth={2.5} />
                                    </button>
                                </div>
                            )}
                        </Section>

                        {/* ── Comments ── */}
                        <Section title="Comments" right={<span className="text-[12px] text-gray-500">{notes.length}</span>}>
                            <div className="p-3 border-b border-white/[0.06]">
                                <textarea
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSubmitComment(); } }}
                                    placeholder="Log a call, visit or referral…"
                                    rows={2}
                                    className="w-full bg-obsidian border border-white/10 rounded-xl px-3 py-2.5 text-[16px] md:text-[15px] text-white placeholder:text-gray-600 resize-none outline-none focus:border-emerald/60 transition-colors"
                                />
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="hidden md:inline text-[12px] text-gray-600">⌘/Ctrl + Enter to post</span>
                                    <button
                                        onClick={handleSubmitComment}
                                        disabled={!commentText.trim()}
                                        className="ml-auto h-9 px-4 rounded-full bg-emerald text-obsidian text-[14px] font-bold flex items-center gap-1.5 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        <Send className="w-4 h-4" /> Post
                                    </button>
                                </div>
                            </div>
                            {notes.length === 0 ? (
                                <p className="px-4 py-4 text-[15px] text-gray-500">No comments yet.</p>
                            ) : (
                                <>
                                    {visibleNotes.map((note) => (
                                        <div key={note.id} className="px-4 py-3 border-b border-white/[0.06] last:border-0">
                                            <p className="text-[15px] text-gray-200 leading-relaxed whitespace-pre-wrap break-words">{note.text}</p>
                                            <p className="mt-1 text-[12px] text-gray-500">
                                                {note.author && <>{note.author.split('@')[0]} · </>}{relativeDate(note.timestamp)}
                                            </p>
                                        </div>
                                    ))}
                                    {notes.length > 5 && (
                                        <button onClick={() => setShowAllNotes((v) => !v)} className="w-full px-4 py-2.5 text-[14px] font-semibold text-emerald hover:bg-white/[0.03] cursor-pointer">
                                            {showAllNotes ? 'Show fewer' : `Show all ${notes.length}`}
                                        </button>
                                    )}
                                </>
                            )}
                        </Section>
                    </div>
                </div>

                {/* ── Delete (Edit mode, admins) ── */}
                {editMode && canDelete() && (
                    <button
                        onClick={handleDeleteContact}
                        className="mt-8 w-full xl:w-auto xl:px-8 xl:mx-auto xl:flex h-12 rounded-2xl bg-slate-dark border border-white/5 text-[16px] font-semibold text-danger hover:bg-danger/10 items-center justify-center cursor-pointer"
                    >
                        Delete this contact
                    </button>
                )}
            </div>
            <ShareContactSheet
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                contact={contact}
                office={officeRecord}
                link={`${window.location.origin}/contact/${contact.id}`}
            />
        </div>
        </EditContext.Provider>
    );
}
