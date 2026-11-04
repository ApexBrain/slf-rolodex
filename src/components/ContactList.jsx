import { useMemo, useRef, useState, useLayoutEffect, useEffect, useCallback } from 'react';
import { Search, X, Plus, ChevronDown, Download, Table2 } from 'lucide-react';

// Contacts-app style list. Alphabetical, sectioned by letter, sticky letter headers, A–Z index.
//  variant="page": phone screen; the window scrolls, sticky under the 56px app header.
//  variant="pane": desktop left pane; scrolls inside its own container, highlights the selected contact,
//                  arrow keys move the selection.

const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const APP_HEADER = 56;

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
            className={`shrink-0 h-8 px-3.5 rounded-full text-[13px] font-semibold border transition-colors cursor-pointer ${active
                ? 'bg-white text-obsidian border-white'
                : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 active:bg-white/10'}`}
        >
            {children}
        </button>
    );
}

function SelectChip({ value, onChange, placeholder, options }) {
    return (
        <label className={`relative shrink-0 h-8 pl-3.5 pr-8 rounded-full text-[13px] font-semibold border flex items-center max-w-[170px] cursor-pointer ${value
            ? 'bg-white text-obsidian border-white'
            : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'}`}>
            <span className="truncate">{value || placeholder}</span>
            <ChevronDown className="absolute right-2.5 w-3.5 h-3.5 pointer-events-none" />
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 opacity-0 w-full cursor-pointer"
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

function IconButton({ onClick, label, children, primary }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${primary
                ? 'bg-emerald text-obsidian hover:bg-emerald/90'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'}`}
        >
            {children}
        </button>
    );
}

export function ContactList({
    variant = 'page',
    contacts, totalCount, stats,
    searchQuery, setSearch, searchRef,
    statusFilter, setStatusFilter,
    cityFilter, setCityFilter,
    specialtyFilter, setSpecialtyFilter,
    onClear, onNew, onOpen,
    selectedId, onExport, onTableView,
}) {
    const isPane = variant === 'pane';
    const barRef = useRef(null);
    const scrollerRef = useRef(null);
    const sectionRefs = useRef({});
    const [barHeight, setBarHeight] = useState(112);
    const [indexTop, setIndexTop] = useState(0);

    // Phone: keep the A–Z index below the search bar, whether the bar is stuck or not.
    useEffect(() => {
        if (isPane) return undefined;
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
    }, [barHeight, isPane]);

    useLayoutEffect(() => {
        if (isPane || !barRef.current) return undefined;
        const ro = new ResizeObserver(() => setBarHeight(barRef.current?.offsetHeight || 112));
        ro.observe(barRef.current);
        return () => ro.disconnect();
    }, [isPane]);

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

    const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);
    const available = useMemo(() => new Set(sections.map((s) => s.letter)), [sections]);
    const filtersOn = !!(statusFilter || cityFilter || specialtyFilter || searchQuery);

    // Where a section header sits once stuck.
    const stickyTop = isPane ? 0 : APP_HEADER + barHeight;

    const jumpTo = (letter) => {
        const start = LETTERS.indexOf(letter);
        const target = LETTERS.slice(start).find((l) => available.has(l)) || [...available].pop();
        const el = target && sectionRefs.current[target];
        if (!el) return;
        const scroller = scrollerRef.current;
        // Off-screen rows use an estimated height, so re-measure and correct a few frames in a row.
        let frames = 0, stable = 0;
        const settle = () => {
            const ref = isPane ? scroller.getBoundingClientRect().top : stickyTop - 1;
            const delta = el.getBoundingClientRect().top - ref;
            if (Math.abs(delta) > 0.5) {
                if (isPane) scroller.scrollTop += delta; else window.scrollBy(0, delta);
                stable = 0;
            } else stable++;
            if (++frames < 20 && stable < 3) requestAnimationFrame(settle);
        };
        settle();
    };

    const onIndexTouch = (e) => {
        const t = e.touches?.[0];
        if (!t) return;
        const l = document.elementFromPoint(t.clientX, t.clientY)?.getAttribute?.('data-letter');
        if (l) jumpTo(l);
    };

    // Desktop: keep the selected contact visible and let ↑/↓ move through the list.
    useEffect(() => {
        if (!isPane || selectedId == null) return;
        const row = scrollerRef.current?.querySelector(`[data-id="${selectedId}"]`);
        if (!row) return;
        const s = scrollerRef.current.getBoundingClientRect();
        const r = row.getBoundingClientRect();
        if (r.top < s.top + 30 || r.bottom > s.bottom) row.scrollIntoView({ block: 'center' });
    }, [isPane, selectedId, sections]);

    const onKey = useCallback((e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
        if (!flat.length) return;
        e.preventDefault();
        const i = flat.findIndex((c) => c.id === selectedId);
        const next = e.key === 'ArrowDown' ? Math.min(flat.length - 1, i + 1) : Math.max(0, i - 1);
        onOpen(flat[i === -1 ? 0 : next].id);
    }, [flat, selectedId, onOpen]);

    useEffect(() => {
        if (!isPane) return undefined;
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isPane, onKey]);

    const tierChips = [
        { key: '', label: 'All' },
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
        { key: 'c', label: 'C' },
        { key: 'none', label: 'No tier' },
    ];

    const countText = contacts.length === totalCount
        ? `${totalCount.toLocaleString()} contacts`
        : `${contacts.length.toLocaleString()} of ${totalCount.toLocaleString()}`;

    const searchBox = (
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
                ref={searchRef}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                value={searchQuery}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); e.currentTarget.blur(); } }}
                placeholder={isPane ? 'Search   ( / )' : 'Search'}
                className="w-full h-10 bg-white/[0.08] rounded-xl pl-9 pr-9 text-[16px] md:text-[15px] text-white placeholder:text-gray-500 outline-none focus:bg-white/[0.11] [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
                <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-600 text-obsidian flex items-center justify-center cursor-pointer"
                >
                    <X className="w-3.5 h-3.5" strokeWidth={3} />
                </button>
            )}
        </div>
    );

    const chips = (
        <div className={`mt-2 flex gap-2 ${isPane ? 'flex-wrap' : 'overflow-x-auto no-scrollbar -mx-4 px-4'}`}>
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
                <button type="button" onClick={onClear} className="shrink-0 h-8 px-3 text-[13px] font-semibold text-emerald cursor-pointer hover:underline">
                    Clear
                </button>
            )}
        </div>
    );

    const list = (
        <>
            {sections.map(({ letter, items }) => (
                <section key={letter} ref={(el) => { sectionRefs.current[letter] = el; }}>
                    <div
                        className={`sticky z-10 px-4 py-1 text-[13px] font-bold text-gray-400 border-b border-white/5 ${isPane ? 'bg-[#181b19]' : 'bg-[#1a1d1b]'}`}
                        style={{ top: isPane ? 0 : stickyTop - 1 }}
                    >
                        {letter}
                    </div>
                    <ul>
                        {items.map((c) => {
                            const tier = tierOf(c);
                            const sub = [c.contactName, c.city].filter(Boolean).join(' · ');
                            const selected = isPane && c.id === selectedId;
                            return (
                                <li key={c.id} data-id={c.id} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 62px' }}>
                                    <button
                                        type="button"
                                        onClick={() => onOpen(c.id)}
                                        aria-current={selected ? 'true' : undefined}
                                        className={`w-full flex items-center gap-3 pl-4 text-left cursor-pointer transition-colors ${selected
                                            ? 'bg-emerald/[0.14]'
                                            : 'hover:bg-white/[0.04] active:bg-white/5'}`}
                                    >
                                        <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold ${TIER_AVATAR[tier]}`}>
                                            {initialsFor(c)}
                                        </span>
                                        <span className={`min-w-0 flex-1 py-2.5 pr-3 flex items-center gap-2 border-b ${selected ? 'border-transparent' : 'border-white/[0.06]'}`}>
                                            <span className="min-w-0 flex-1">
                                                <span className={`block text-[16px] md:text-[15px] truncate ${selected ? 'text-white font-semibold' : 'text-white'}`}>
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
                        <button type="button" onClick={onClear} className="mt-4 text-emerald font-semibold text-[15px] cursor-pointer">Clear filters</button>
                    )}
                </div>
            )}
        </>
    );

    const index = sections.length > 0 && (
        <nav
            aria-label="Jump to letter"
            className={`${isPane ? 'absolute right-0 top-0 bottom-0 py-2' : 'fixed right-0.5 z-30'} flex flex-col items-center justify-center select-none touch-none`}
            style={isPane ? undefined : { top: indexTop || stickyTop + 6, bottom: 16 }}
            onTouchStart={onIndexTouch}
            onTouchMove={onIndexTouch}
        >
            {LETTERS.map((l) => (
                <button
                    key={l}
                    type="button"
                    data-letter={l}
                    onClick={() => jumpTo(l)}
                    tabIndex={-1}
                    className={`w-5 flex-1 max-h-[18px] text-[10px] leading-none font-bold flex items-center justify-center cursor-pointer ${available.has(l) ? 'text-emerald hover:text-white' : 'text-gray-700'}`}
                >
                    {l}
                </button>
            ))}
        </nav>
    );

    if (isPane) {
        return (
            <div className="h-full flex flex-col">
                <div className="px-4 pt-4 pb-3 border-b border-white/5">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="min-w-0">
                            <h1 className="text-[22px] font-bold leading-tight text-white tracking-tight">Contacts</h1>
                            <p className="text-[12px] text-gray-500">{countText}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {onTableView && (
                                <IconButton onClick={onTableView} label="Table view"><Table2 className="w-4 h-4" /></IconButton>
                            )}
                            {onExport && (
                                <IconButton onClick={onExport} label="Export to CSV"><Download className="w-4 h-4" /></IconButton>
                            )}
                            <IconButton onClick={onNew} label="New contact" primary><Plus className="w-5 h-5" strokeWidth={2.5} /></IconButton>
                        </div>
                    </div>
                    {searchBox}
                    {chips}
                </div>
                <div className="relative flex-1 min-h-0">
                    <div ref={scrollerRef} className="h-full overflow-y-auto pr-5 custom-scrollbar">
                        {list}
                    </div>
                    {index}
                </div>
            </div>
        );
    }

    return (
        <div className="-mx-3 -mt-4">
            {/* Large title */}
            <div className="px-4 pt-4 pb-1 flex items-end justify-between">
                <div>
                    <h1 className="text-[30px] font-bold leading-tight text-white tracking-tight">Contacts</h1>
                    <p className="text-[13px] text-gray-500">{countText}</p>
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
                {searchBox}
                {chips}
            </div>

            <div className="pr-6">{list}</div>
            {index}
        </div>
    );
}
