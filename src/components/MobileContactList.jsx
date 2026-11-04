import { useMemo, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { Search, X, Plus, ChevronDown } from 'lucide-react';

// Phone-style contacts list (shown below the md breakpoint). Alphabetical, sectioned by letter,
// with sticky section headers and an A–Z side index, like the built-in Contacts app.

const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

export function initialsFor(contact) {
    const source = (contact?.officeName || contact?.contactName || '').replace(/\b(dr|drs)\.?\s+/gi, '');
    const words = source.match(/[A-Za-z0-9]+/g) || [];
    const picked = words.filter((w) => !/^(the|of|and|inc|llc|dc|md)$/i.test(w));
    const use = picked.length ? picked : words;
    return ((use[0]?.[0] || '') + (use[1]?.[0] || '')).toUpperCase() || '#';
}

export function tierOf(contact) {
    return contact?.a ? 'A' : contact?.b ? 'B' : contact?.c ? 'C' : '';
}

export const TIER_AVATAR = {
    A: 'bg-emerald/20 text-emerald ring-1 ring-emerald/50',
    B: 'bg-[#22C55E]/15 text-[#4ADE80] ring-1 ring-[#22C55E]/40',
    C: 'bg-[#059669]/20 text-[#34D399] ring-1 ring-[#059669]/40',
    '': 'bg-white/10 text-gray-300',
};

function letterFor(contact) {
    const ch = (contact.officeName || contact.contactName || '').trim().charAt(0).toUpperCase();
    return ch >= 'A' && ch <= 'Z' ? ch : '#';
}

function Chip({ active, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`shrink-0 h-8 px-3.5 rounded-full text-[13px] font-semibold border transition-colors ${active
                ? 'bg-white text-obsidian border-white'
                : 'bg-white/5 text-gray-300 border-white/10 active:bg-white/10'}`}
        >
            {children}
        </button>
    );
}

function SelectChip({ value, onChange, placeholder, options }) {
    return (
        <label className={`relative shrink-0 h-8 pl-3.5 pr-8 rounded-full text-[13px] font-semibold border flex items-center max-w-[160px] ${value
            ? 'bg-white text-obsidian border-white'
            : 'bg-white/5 text-gray-300 border-white/10'}`}>
            <span className="truncate">{value || placeholder}</span>
            <ChevronDown className="absolute right-2.5 w-3.5 h-3.5 pointer-events-none" />
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 opacity-0 w-full"
                aria-label={placeholder}
            >
                <option value="">{placeholder}</option>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </label>
    );
}

export function MobileContactList({
    contacts, totalCount, stats,
    searchQuery, setSearch,
    statusFilter, setStatusFilter,
    cityFilter, setCityFilter,
    specialtyFilter, setSpecialtyFilter,
    onClear, onNew, onOpen,
}) {
    const barRef = useRef(null);
    const sectionRefs = useRef({});
    const [barHeight, setBarHeight] = useState(112);
    const [activeLetter, setActiveLetter] = useState(null);
    const [indexTop, setIndexTop] = useState(0);

    // keep the A–Z index below the search bar, whether the bar is stuck or not
    useEffect(() => {
        let raf = 0;
        const update = () => {
            raf = 0;
            const r = barRef.current?.getBoundingClientRect();
            if (r) setIndexTop(Math.round(r.bottom) + 6);
        };
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
    }, [barHeight]);

    useLayoutEffect(() => {
        if (!barRef.current) return;
        const ro = new ResizeObserver(() => setBarHeight(barRef.current?.offsetHeight || 112));
        ro.observe(barRef.current);
        return () => ro.disconnect();
    }, []);

    const sections = useMemo(() => {
        const sorted = [...contacts].sort((x, y) =>
            (x.officeName || x.contactName || '').localeCompare(y.officeName || y.contactName || '', undefined, { sensitivity: 'base' })
            || (x.contactName || '').localeCompare(y.contactName || ''));
        const map = new Map();
        for (const c of sorted) {
            const l = letterFor(c);
            if (!map.has(l)) map.set(l, []);
            map.get(l).push(c);
        }
        return LETTERS.filter((l) => map.has(l)).map((l) => ({ letter: l, items: map.get(l) }));
    }, [contacts]);

    const available = useMemo(() => new Set(sections.map((s) => s.letter)), [sections]);
    const filtersOn = !!(statusFilter || cityFilter || specialtyFilter || searchQuery);

    // 56px app header + sticky search bar
    const stickyTop = 56 + barHeight;

    const jumpTo = (letter) => {
        // nearest available letter at or after the touched one
        const start = LETTERS.indexOf(letter);
        const target = LETTERS.slice(start).find((l) => available.has(l)) || [...available].pop();
        const el = target && sectionRefs.current[target];
        if (!el) return;
        setActiveLetter(target);
        // Off-screen rows use an estimated height, so re-measure and correct a few frames in a row.
        let frames = 0, stable = 0;
        const settle = () => {
            const delta = el.getBoundingClientRect().top - (stickyTop - 1);
            if (Math.abs(delta) > 0.5) { window.scrollBy(0, delta); stable = 0; } else stable++;
            if (++frames < 20 && stable < 3) requestAnimationFrame(settle);
        };
        settle();
    };

    const onIndexTouch = (e) => {
        const t = e.touches?.[0];
        if (!t) return;
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const l = el?.getAttribute?.('data-letter');
        if (l && l !== activeLetter) jumpTo(l);
    };

    const tierChips = [
        { key: '', label: 'All' },
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
        { key: 'c', label: 'C' },
        { key: 'none', label: 'No tier' },
    ];

    return (
        <div className="-mx-3 -mt-4">
            {/* Large title */}
            <div className="px-4 pt-4 pb-1 flex items-end justify-between">
                <div>
                    <h1 className="text-[30px] font-bold leading-tight text-white tracking-tight">Contacts</h1>
                    <p className="text-[13px] text-gray-500">
                        {contacts.length === totalCount
                            ? `${totalCount.toLocaleString()} contacts`
                            : `${contacts.length.toLocaleString()} of ${totalCount.toLocaleString()}`}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onNew}
                    aria-label="New contact"
                    className="mb-1 w-10 h-10 rounded-full bg-emerald text-obsidian flex items-center justify-center active:scale-95 transition-transform"
                >
                    <Plus className="w-5 h-5" strokeWidth={2.5} />
                </button>
            </div>

            {/* Sticky search + filter chips */}
            <div ref={barRef} className="sticky top-14 z-20 bg-obsidian/95 backdrop-blur-md px-4 pt-2 pb-2.5 border-b border-white/5">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="search"
                        inputMode="search"
                        enterKeyHint="search"
                        value={searchQuery}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search"
                        className="w-full h-10 bg-white/[0.08] rounded-xl pl-9 pr-9 text-[16px] text-white placeholder:text-gray-500 outline-none [&::-webkit-search-cancel-button]:hidden"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            aria-label="Clear search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-600 text-obsidian flex items-center justify-center"
                        >
                            <X className="w-3.5 h-3.5" strokeWidth={3} />
                        </button>
                    )}
                </div>
                <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                    {tierChips.map((t) => (
                        <Chip key={t.key} active={statusFilter === t.key} onClick={() => setStatusFilter(t.key)}>{t.label}</Chip>
                    ))}
                    <SelectChip
                        value={cityFilter}
                        onChange={setCityFilter}
                        placeholder="City"
                        options={(stats.cities || []).map((c) => ({ value: c.name, label: `${c.name} (${c.count})` }))}
                    />
                    <SelectChip
                        value={specialtyFilter}
                        onChange={setSpecialtyFilter}
                        placeholder="Specialty"
                        options={(stats.allSpecialties || []).map((s) => ({ value: s, label: s }))}
                    />
                    {filtersOn && (
                        <button type="button" onClick={onClear} className="shrink-0 h-8 px-3 text-[13px] font-semibold text-emerald">
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Sections */}
            <div className="pr-6">
                {sections.map(({ letter, items }) => (
                    <section key={letter} ref={(el) => { sectionRefs.current[letter] = el; }}>
                        <div
                            className="sticky z-10 px-4 py-1 bg-[#1a1d1b] text-[13px] font-bold text-gray-400 border-b border-white/5"
                            style={{ top: stickyTop - 1 }}
                        >
                            {letter}
                        </div>
                        <ul>
                            {items.map((c) => {
                                const tier = tierOf(c);
                                const sub = [c.contactName, c.city].filter(Boolean).join(' · ');
                                return (
                                    <li key={c.id} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 64px' }}>
                                        <button
                                            type="button"
                                            onClick={() => onOpen(c.id)}
                                            className="w-full flex items-center gap-3 pl-4 text-left active:bg-white/5"
                                        >
                                            <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold ${TIER_AVATAR[tier]}`}>
                                                {initialsFor(c)}
                                            </span>
                                            <span className="min-w-0 flex-1 py-2.5 pr-3 border-b border-white/[0.06] flex items-center gap-2">
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-[16px] text-white truncate">
                                                        {c.officeName || c.contactName || <span className="italic text-gray-500">Unnamed</span>}
                                                    </span>
                                                    {sub && <span className="block text-[13px] text-gray-500 truncate">{sub}</span>}
                                                </span>
                                                {tier && <span className="shrink-0 text-[12px] font-bold text-gray-500">{tier}</span>}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}

                {sections.length === 0 && (
                    <div className="px-6 py-16 text-center">
                        <p className="text-[17px] text-white font-semibold">No results</p>
                        <p className="text-[14px] text-gray-500 mt-1">
                            {filtersOn ? 'Try a different search or clear the filters.' : 'No contacts yet.'}
                        </p>
                        {filtersOn && (
                            <button type="button" onClick={onClear} className="mt-4 text-emerald font-semibold text-[15px]">Clear filters</button>
                        )}
                    </div>
                )}
            </div>

            {/* A–Z index */}
            {sections.length > 0 && (
                <nav
                    aria-label="Jump to letter"
                    className="fixed right-0.5 z-30 flex flex-col items-center justify-center select-none touch-none"
                    style={{ top: indexTop || stickyTop + 6, bottom: 16 }}
                    onTouchStart={onIndexTouch}
                    onTouchMove={onIndexTouch}
                    onTouchEnd={() => setActiveLetter(null)}
                >
                    {LETTERS.map((l) => (
                        <button
                            key={l}
                            type="button"
                            data-letter={l}
                            onClick={() => jumpTo(l)}
                            className={`w-5 flex-1 max-h-[18px] text-[10px] leading-none font-bold flex items-center justify-center ${available.has(l) ? 'text-emerald' : 'text-gray-700'}`}
                        >
                            {l}
                        </button>
                    ))}
                </nav>
            )}
        </div>
    );
}
