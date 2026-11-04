// Offline data-quality report. Reads .private/data.js, writes CSVs to .private/.
// Nothing here touches the database: it only proposes changes for human review.
import { initialData as d } from '../.private/data.js';
import { writeFileSync } from 'node:fs';

const digits = (s) => (s || '').replace(/\D/g, '');
const norm = (s) => (s || '').toLowerCase().replace(/\b(dr|md|dc|d\.c|inc|llc|the)\b/g, '').replace(/[^a-z0-9]/g, '');
const normStreet = (s) =>
    (s || '').toLowerCase().replace(/\b(suite|ste|unit|apt)\b.*$/, '').replace(/#.*$/, '')
        .replace(/\bstreet\b/g, 'st').replace(/\bavenue\b/g, 'ave').replace(/\broad\b/g, 'rd')
        .replace(/\bboulevard\b/g, 'blvd').replace(/\bdrive\b/g, 'dr').replace(/[^a-z0-9]/g, '');
export const formatPhone = (s) => {
    const x = digits(s);
    const ten = x.length === 11 && x[0] === '1' ? x.slice(1) : x;
    return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : null;
};
const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
const status = (c) => (c.a ? 'A' : c.b ? 'B' : c.c ? 'C' : '');

// 1. Empty rows
const empty = d.filter((c) => !c.officeName && !c.contactName && !c.email && !c.phone1 && !c.streetAddress);

// 2. Duplicate clusters. A duplicate = the same PERSON entered twice, not two doctors in one building.
const personKey = (name) => {
    const t = (name || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[.,]/g, ' ')
        .split(/\s+/).filter((w) => w && !/^(dr|md|dc|do|dds|ba|bs|phd|esq|jr|sr|ii|iii|qme|dpm|pt|np|pa)$/.test(w));
    return t.length >= 2 ? t[t.length - 1] + '|' + t[0][0] : '';
};
const live = d.filter((c) => !empty.includes(c));
const parent = new Map(live.map((c) => [c.id, c.id]));
const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
const reasons = new Map();
const link = (a, b, why) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
    for (const id of [a, b]) (reasons.get(id) || reasons.set(id, new Set()).get(id)).add(why);
};
const email = (c) => ((c.email || '').trim().toLowerCase().includes('@') ? c.email.trim().toLowerCase() : '');
const phone = (c) => (digits(c.phone1).length === 10 ? digits(c.phone1) : '');
// Pairwise inside buckets of the same person key
const buckets = new Map();
for (const c of live) { const k = personKey(c.contactName); if (k) (buckets.get(k) || buckets.set(k, []).get(k)).push(c); }
for (const g of buckets.values()) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    const x = g[i], y = g[j], why = [];
    if (email(x) && email(x) === email(y)) why.push('same email');
    if (phone(x) && phone(x) === phone(y)) why.push('same phone');
    if (normStreet(x.streetAddress).length > 5 && normStreet(x.streetAddress) === normStreet(y.streetAddress) && x.zip === y.zip) why.push('same street');
    if (norm(x.officeName).length > 4 && norm(x.officeName) === norm(y.officeName) && x.city === y.city) why.push('same office name');
    if (why.length) link(x.id, y.id, why.join(' + '));
}
const clusters = new Map();
for (const c of live) { const r = find(c.id); (clusters.get(r) || clusters.set(r, []).get(r)).push(c); }
const dupGroups = [...clusters.values()].filter((g) => g.length > 1);

// Informational: same phone, different people -> shared clinic, NOT duplicates
const phoneOnly = new Map();
for (const c of live) { const p = phone(c); if (p) (phoneOnly.get(p) || phoneOnly.set(p, []).get(p)).push(c); }
const sharedPhone = [...phoneOnly.values()].filter((g) => g.length > 1 && new Set(g.map((c) => find(c.id))).size > 1);

const header = ['group', 'confidence', 'status_conflict', 'why', 'id', 'office', 'contact', 'status', 'city', 'street', 'phone1', 'email', 'who', 'comments'];
const rows = [header];
dupGroups.forEach((g, i) => {
    const why = [...new Set(g.flatMap((c) => [...(reasons.get(c.id) || [])]))];
    const signals = new Set(why.flatMap((w) => w.split(' + ')));
    const conf = signals.size >= 2 ? 'high' : 'medium';
    const conflict = new Set(g.map(status).filter(Boolean)).size > 1 ? 'YES' : '';
    g.forEach((c) => rows.push([i + 1, conf, conflict, [...signals].join(' + '), c.id, c.officeName, c.contactName, status(c), c.city, c.streetAddress, c.phone1, c.email, c.who, c.comments]));
});
writeFileSync('.private/duplicate_candidates.csv', csv(rows));

// 3. Phone normalization proposals
const phoneRows = [['id', 'office', 'field', 'current', 'proposed']];
let fixable = 0, unfixable = 0;
for (const c of live) for (const f of ['phone1', 'phone2', 'phone3', 'phone4']) {
    const v = c[f]; if (!v) continue;
    const p = formatPhone(v);
    if (p && p !== v) { phoneRows.push([c.id, c.officeName, f, v, p]); fixable++; }
    else if (!p) { phoneRows.push([c.id, c.officeName, f, v, 'NEEDS REVIEW']); unfixable++; }
}
writeFileSync('.private/phone_normalization.csv', csv(phoneRows));

// 4. Junk values
const junkRows = [['id', 'office', 'field', 'value']];
for (const c of live) {
    if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) junkRows.push([c.id, c.officeName, 'email', c.email]);
    if (/\?/.test(c.who || '')) junkRows.push([c.id, c.officeName, 'who', c.who]);
    if (c.state && c.state !== 'CA') junkRows.push([c.id, c.officeName, 'state', c.state]);
    if (!c.city && c.officeName) junkRows.push([c.id, c.officeName, 'city', '(blank)']);
}
writeFileSync('.private/junk_values.csv', csv(junkRows));

console.log({
    totalRecords: d.length, emptyRows: empty.length, emptyRowIds: empty.map((c) => c.id),
    duplicateGroups: dupGroups.length, recordsInDuplicateGroups: dupGroups.reduce((n, g) => n + g.length, 0),
    highConfidenceGroups: new Set(rows.filter((r, i) => i && r[1] === 'high').map((r) => r[0])).size,
    statusConflictGroups: new Set(rows.filter((r, i) => i && r[2] === 'YES').map((r) => r[0])).size,
    boilerplateComments: live.filter((c) => /Email Addresses Okay|United States/.test(c.comments)).length,
    sharedPhoneOnlyGroups: sharedPhone.length,
    phonesToReformat: fixable, phonesNeedingReview: unfixable, junkFlags: junkRows.length - 1,
});
