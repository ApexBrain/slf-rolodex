import { useEffect, useState } from 'react';
import { X, Send, Copy, Check, Mail, Download, Link2 } from 'lucide-react';

// Share a contact with someone outside the app (a client, another office) or a teammate.
// Only public details go out: office, person, phones, email, address, website, specialties.
// Internal fields (tier, "who", comments, critical note, mailing) are never included.

const clean = (v) => (v || '').toString().trim();

export function buildShare(contact, office) {
    const o = office || contact || {};
    const person = clean(contact?.contactName);
    const officeName = clean(o.officeName);
    const phones = [clean(contact?.phone1), clean(o.phone1), clean(o.phone2)]
        .filter((p, i, arr) => p && /\d{7,}/.test(p.replace(/\D/g, '')) && arr.findIndex((q) => q.replace(/\D/g, '') === p.replace(/\D/g, '')) === i);
    const email = clean(contact?.email) || clean(o.email);
    const street = clean(o.streetAddress);
    const city = clean(o.city);
    const state = clean(o.state);
    const zip = clean(o.zip);
    const cityLine = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const address = street || city ? [street, cityLine].filter(Boolean).join(', ') : '';
    const website = clean(o.website);
    const specialties = (o.specialties || []).filter(Boolean);
    const mapUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';

    const lines = [
        officeName || person,
        officeName && person && person !== officeName ? person : '',
        ...phones.map((p, i) => `${i === 0 ? 'Phone' : 'Phone ' + (i + 1)}: ${p}`),
        email && `Email: ${email}`,
        address && `Address: ${address}`,
        mapUrl && `Directions: ${mapUrl}`,
        website && `Website: ${website}`,
        specialties.length && `Specialties: ${specialties.join(', ')}`,
    ].filter(Boolean);
    const text = lines.join('\n');

    // vCard 3.0 so iPhone/Android/Outlook can save it straight into Contacts.
    const esc = (v) => clean(v).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const nameForCard = person || officeName;
    const parts = nameForCard.replace(/\b(dr|drs)\.?\s+/gi, '').replace(/,.*$/, '').trim().split(/\s+/);
    const last = person && parts.length > 1 ? parts[parts.length - 1] : '';
    const first = person && parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    const v = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        person ? `N:${esc(last)};${esc(first || nameForCard)};;;` : `N:;;;;`,
        `FN:${esc(nameForCard)}`,
        officeName && `ORG:${esc(officeName)}`,
        ...phones.map((p) => `TEL;TYPE=WORK,VOICE:${esc(p)}`),
        email && `EMAIL;TYPE=WORK,INTERNET:${esc(email)}`,
        address && `ADR;TYPE=WORK:;;${esc(street)};${esc(city)};${esc(state)};${esc(zip)};USA`,
        website && `URL:${esc(/^https?:\/\//i.test(website) ? website : `https://${website}`)}`,
        specialties.length && `NOTE:${esc(`Specialties: ${specialties.join(', ')}`)}`,
        !person && 'X-ABShowAs:COMPANY',
        'END:VCARD',
    ].filter(Boolean).join('\r\n') + '\r\n';
    const fileName = `${(officeName || person || 'contact').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'contact'}.vcf`;

    return { title: officeName || person || 'Contact', text, vcard: v, fileName };
}

function Option({ icon: Icon, title, sub, onClick, done }) {
    return (
        <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04] active:bg-white/[0.06] border-b border-white/[0.06] last:border-0 cursor-pointer">
            <span className="w-9 h-9 shrink-0 rounded-full bg-emerald/15 text-emerald flex items-center justify-center">
                {done ? <Check className="w-4 h-4" strokeWidth={3} /> : <Icon className="w-4 h-4" />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-white">{done || title}</span>
                {sub && <span className="block text-[12px] text-gray-500">{sub}</span>}
            </span>
        </button>
    );
}

export function ShareContactSheet({ open, onClose, contact, office, link }) {
    const [done, setDone] = useState('');
    const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

    useEffect(() => {
        if (!open) { setDone(''); return undefined; }
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;
    const share = buildShare(contact, office);
    const flash = (key) => { setDone(key); setTimeout(() => setDone(''), 1600); };

    const copy = async (value, key) => {
        try {
            await navigator.clipboard.writeText(value);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = value; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); } catch { /* ignore */ }
            ta.remove();
        }
        flash(key);
    };

    const nativeShare = async () => {
        const file = new File([share.vcard], share.fileName, { type: 'text/vcard' });
        const withFile = { title: share.title, text: share.text, files: [file] };
        try {
            if (navigator.canShare?.(withFile)) await navigator.share(withFile);
            else await navigator.share({ title: share.title, text: share.text });
            onClose();
        } catch (e) {
            if (e?.name !== 'AbortError') copy(share.text, 'copy');
        }
    };

    const download = () => {
        const url = URL.createObjectURL(new Blob([share.vcard], { type: 'text/vcard' }));
        const a = document.createElement('a');
        a.href = url; a.download = share.fileName; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        flash('vcf');
    };

    const mailto = `mailto:?subject=${encodeURIComponent(`Contact: ${share.title}`)}&body=${encodeURIComponent(share.text)}`;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="share-title">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-slate-dark border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-heavy animate-fade-in">
                <div className="sm:hidden mx-auto -mt-1 mb-3 w-10 h-1 rounded-full bg-white/20" />
                <div className="flex items-start gap-3 pr-10">
                    <div className="min-w-0">
                        <h2 id="share-title" className="text-[18px] font-bold text-white leading-tight truncate">Share {share.title}</h2>
                        <p className="text-[13px] text-gray-500">Only contact details are shared. Tier, comments and notes stay private.</p>
                    </div>
                </div>
                <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 cursor-pointer">
                    <X className="w-4 h-4" />
                </button>

                <pre className="mt-4 max-h-28 sm:max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-obsidian border border-white/5 p-3 text-[13px] leading-relaxed text-gray-300 font-sans">{share.text}</pre>

                <div className="mt-4 rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden">
                    {canNativeShare && (
                        <Option icon={Send} title="Send…" sub="Text, WhatsApp, email or any app, with a contact card they can save" onClick={nativeShare} />
                    )}
                    <Option icon={Copy} title="Copy contact info" sub="Paste it into a text, email or note" onClick={() => copy(share.text, 'copy')} done={done === 'copy' && 'Copied'} />
                    <Option icon={Mail} title="Email it" sub="Opens a new email with the details" onClick={() => { window.location.href = mailto; }} />
                    <Option icon={Download} title="Download contact card (.vcf)" sub="Adds it to Contacts on a phone or Outlook" onClick={download} done={done === 'vcf' && 'Downloaded'} />
                    {link && (
                        <Option icon={Link2} title="Copy link for a teammate" sub="Opens this contact in the Rolodex (they need to sign in)" onClick={() => copy(link, 'link')} done={done === 'link' && 'Link copied'} />
                    )}
                </div>
            </div>
        </div>
    );
}
