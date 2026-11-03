import { create } from 'zustand';
import { supabase } from './supabase.js';

const mapDbContactToClient = (c) => ({
    id: c.id,
    officeName: c.office_name || '',
    contactName: c.contact_name || '',
    email: c.email || '',
    a: !!c.a,
    b: !!c.b,
    c: !!c.c,
    who: c.who || '',
    mailing: c.mailing || '',
    streetAddress: c.street_address || '',
    city: c.city || '',
    state: c.state || '',
    zip: c.zip || '',
    phone1: c.phone1 || '',
    phone2: c.phone2 || '',
    phone3: c.phone3 || '',
    phone4: c.phone4 || '',
    website: c.website || '',
    comments: c.comments || '',
    pinnedNote: c.pinned_note || '',
    specialties: c.specialties || [],
    notes: c.notes || []
});


const toIds = (ids) => (Array.isArray(ids) ? ids : [ids]);
const snapshot = (contacts, ids) => contacts.filter((c) => ids.includes(c.id));
const restore = (set, previous) =>
    set((state) => ({
        contacts: state.contacts.map((c) => previous.find((p) => p.id === c.id) || c),
    }));

const digitsOnly = (v) => (v || '').replace(/\D/g, '');

// (555) 123-4567 for any 10-digit (or 1+10) number; anything else is left exactly as typed.
export const formatPhone = (value) => {
    const d = digitsOnly(value);
    const ten = d.length === 11 && d[0] === '1' ? d.slice(1) : d;
    return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : value;
};

// Possible existing matches for a contact about to be created.
export const findPossibleDuplicates = (contacts, candidate) => {
    const name = (candidate.officeName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const city = (candidate.city || '').toLowerCase().trim();
    const email = (candidate.email || '').toLowerCase().trim();
    const phone = digitsOnly(candidate.phone1);
    return contacts
        .filter((c) => {
            if (email.includes('@') && (c.email || '').toLowerCase().trim() === email) return true;
            if (phone.length >= 10 && [c.phone1, c.phone2, c.phone3, c.phone4].some((p) => digitsOnly(p).slice(-10) === phone.slice(-10))) return true;
            const cn = (c.officeName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return name.length > 3 && cn === name && (!city || (c.city || '').toLowerCase().trim() === city);
        })
        .slice(0, 5);
};

export const officeKey = (c) => {
    const name = (c?.officeName || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!name) return '';
    return `${name}|${(c.city || '').toLowerCase().trim()}`;
};

export const useStore = create((set, get) => ({
    contacts: [],
    session: null,
    user: null,
    role: null,
    users: [],
    isLoading: true,
    isAuthLoading: true,
    searchQuery: '', // Draft input text
    activeSearchQuery: '', // Applied on enter
    cityFilter: '',
    specialtyFilter: '', // Filter by a specific specialty
    statusFilter: '', // '', 'a', 'b', 'c', 'none'

    initializeAuth: async () => {
        set({ isAuthLoading: true });
        try {
            const sessionResult = await Promise.race([
                supabase.auth.getSession(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('getSession timeout')), 12000)),
            ]);

            const { data, error } = sessionResult;
            if (error) {
                console.error('Error loading auth session:', error);
                set({ session: null, user: null, role: null });
                return;
            }

            const session = data?.session || null;
            const user = session?.user || null;
            set({ session, user });

            if (!user) {
                set({ role: null, contacts: [], isLoading: false });
                return;
            }

            await get().loadCurrentUserRole(user);
        } catch (error) {
            console.error('Auth initialization failed:', error);
            set({ session: null, user: null, role: null, contacts: [], isLoading: false });
        } finally {
            set({ isAuthLoading: false });
        }
    },

    onAuthStateChange: (handler) => supabase.auth.onAuthStateChange(handler),

    loadCurrentUserRole: async (user) => {
        const email = user?.email?.toLowerCase();
        if (!email) {
            set({ role: null });
            return null;
        }

        const token = get().session?.access_token;
        if (token) {
            try {
                const response = await Promise.race([
                    fetch('/api/auth/role', {
                        method: 'GET',
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('role api timeout')), 8000)),
                ]);

                const payload = await response.json().catch(() => ({}));
                if (response.ok && (payload.role === 'admin' || payload.role === 'staff')) {
                    set({ role: payload.role });
                    return payload.role;
                }
            } catch (error) {
                console.error('Error loading role via API:', error);
            }
        }

        try {
            const rpcResult = await Promise.race([
                supabase.rpc('current_app_role'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('role rpc timeout')), 8000)),
            ]);

            const { data, error } = rpcResult;
            if (!error && (data === 'admin' || data === 'staff')) {
                set({ role: data });
                return data;
            }

            if (error) {
                console.error('Error loading user role via RPC:', error);
            }
        } catch (error) {
            console.error('Role RPC failed:', error);
        }

        let tableResult;
        try {
            tableResult = await Promise.race([
                supabase
                    .from('app_users')
                    .select('id,email,role,is_active')
                    .ilike('email', email)
                    .maybeSingle(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('role table lookup timeout')), 8000)),
            ]);
        } catch (error) {
            console.error('Role table lookup failed:', error);
            set({ role: null });
            return null;
        }

        const { data, error } = tableResult;

        if (error) {
            console.error('Error loading user role via table:', error);
            set({ role: null });
            return null;
        }

        if (!data || !data.is_active) {
            set({ role: null });
            return null;
        }

        set({ role: data.role });
        return data.role;
    },

    signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, error };

        const session = data?.session || null;
        const user = session?.user || null;
        set({ session, user });
        await get().loadCurrentUserRole(user);
        return { ok: true };
    },

    signOut: async () => {
        await supabase.auth.signOut();
        set({
            session: null,
            user: null,
            role: null,
            users: [],
            contacts: [],
            isLoading: false,
        });
    },

    fetchUsers: async () => {
        const { data, error } = await supabase
            .from('app_users')
            .select('id,email,role,is_active,created_at')
            .order('email', { ascending: true });

        if (error) {
            console.error('Error fetching users:', error);
            return [];
        }

        set({ users: data || [] });
        return data || [];
    },

    addUser: async ({ email, role }) => {
        const normalizedEmail = (email || '').trim().toLowerCase();
        if (!normalizedEmail) return { ok: false, reason: 'missing_email' };

        const { data, error } = await supabase
            .from('app_users')
            .insert({
                email: normalizedEmail,
                role,
                is_active: true,
            })
            .select('id,email,role,is_active,created_at')
            .single();

        if (error || !data) {
            console.error('Error adding user:', error);
            return { ok: false, error };
        }

        set((state) => ({ users: [...state.users, data].sort((a, b) => a.email.localeCompare(b.email)) }));
        return { ok: true, data };
    },

    createUserWithPassword: async ({ email, password, role }) => {
        const token = get().session?.access_token;
        if (!token) return { ok: false, error: { message: 'No active session' } };

        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ email, password, role }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { ok: false, error: { message: payload.error || 'Unable to create user' } };
        }

        const data = payload.user;
        set((state) => ({ users: [...state.users, data].sort((a, b) => a.email.localeCompare(b.email)) }));
        return { ok: true, data };
    },

    updateUserPassword: async ({ email, newPassword }) => {
        const token = get().session?.access_token;
        if (!token) return { ok: false, error: { message: 'No active session' } };

        const response = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ email, newPassword }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { ok: false, error: { message: payload.error || 'Unable to update password' } };
        }

        return { ok: true };
    },

    updateUserRole: async (id, role) => {
        const { data, error } = await supabase
            .from('app_users')
            .update({ role })
            .eq('id', id)
            .select('id,email,role,is_active,created_at')
            .single();

        if (error || !data) {
            console.error('Error updating user role:', error);
            return { ok: false, error };
        }

        set((state) => ({
            users: state.users.map((u) => (u.id === id ? data : u)),
        }));
        return { ok: true, data };
    },

    setUserActive: async (id, isActive) => {
        const { data, error } = await supabase
            .from('app_users')
            .update({ is_active: isActive })
            .eq('id', id)
            .select('id,email,role,is_active,created_at')
            .single();

        if (error || !data) {
            console.error('Error updating user status:', error);
            return { ok: false, error };
        }

        set((state) => ({
            users: state.users.map((u) => (u.id === id ? data : u)),
        }));
        return { ok: true, data };
    },

    deleteUser: async (id) => {
        const { error } = await supabase.from('app_users').delete().eq('id', id);
        if (error) {
            console.error('Error deleting user:', error);
            return { ok: false, error };
        }

        set((state) => ({ users: state.users.filter((u) => u.id !== id) }));
        return { ok: true };
    },

    fetchContacts: async () => {
        set({ isLoading: true });
        const pageSize = 1000;
        const maxPages = 20;
        let from = 0;
        let allRows = [];
        let fetchError = null;

        try {
            for (let page = 0; page < maxPages; page += 1) {
                const to = from + pageSize - 1;
                const result = await Promise.race([
                    supabase
                        .from('contacts')
                        .select('*')
                        .order('id', { ascending: true })
                        .range(from, to),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('contacts fetch timeout')), 10000)),
                ]);

                const { data, error } = result;
                if (error) {
                    fetchError = error;
                    break;
                }

                const rows = data || [];
                allRows = [...allRows, ...rows];

                if (rows.length < pageSize) break;
                from += pageSize;
            }
        } catch (error) {
            fetchError = error;
        }

        if (fetchError) {
            console.error('Error fetching contacts:', fetchError);
            set({ isLoading: false });
            return;
        }

        const mappedData = allRows.map(mapDbContactToClient);
        set({ contacts: mappedData, isLoading: false });
    },

    setSearch: (query) => set({ searchQuery: query, activeSearchQuery: query }),
    executeSearch: () => set((state) => ({ activeSearchQuery: state.searchQuery })),
    setCityFilter: (city) => set({ cityFilter: city }),
    setSpecialtyFilter: (specialty) => set({ specialtyFilter: specialty }),
    setStatusFilter: (status) => set({ statusFilter: status }),

    updateContact: async (id, updates) => {
        const previousContact = get().contacts.find((c) => c.id === id);

        // Optimistic UI update
        set((state) => ({
            contacts: state.contacts.map((c) =>
                c.id === id ? { ...c, ...updates } : c
            ),
        }));

        // Map camelCase keys back to DB columns
        const fieldMap = {
            officeName: 'office_name',
            contactName: 'contact_name',
            streetAddress: 'street_address',
            pinnedNote: 'pinned_note',
            email: 'email',
            city: 'city',
            state: 'state',
            zip: 'zip',
            website: 'website',
            mailing: 'mailing',
            who: 'who',
            phone1: 'phone1',
            phone2: 'phone2',
            phone3: 'phone3',
            phone4: 'phone4',
            comments: 'comments',
            a: 'a',
            b: 'b',
            c: 'c',
            specialties: 'specialties',
            notes: 'notes',
        };

        ['phone1', 'phone2', 'phone3', 'phone4'].forEach((k) => {
            if (typeof updates[k] === 'string') updates = { ...updates, [k]: formatPhone(updates[k].trim()) };
        });

        const dbUpdates = {};
        Object.entries(fieldMap).forEach(([clientKey, dbKey]) => {
            if (clientKey in updates) {
                dbUpdates[dbKey] = updates[clientKey];
            }
        });

        if (Object.keys(dbUpdates).length === 0) {
            console.warn('updateContact called without supported fields:', updates);
            return { ok: false, reason: 'unsupported_fields' };
        }

        const { data, error } = await supabase
            .from('contacts')
            .update(dbUpdates)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('Error updating contact:', error);
            get().notify('Could not save your changes. They were reverted.', 'error');
            if (previousContact) {
                set((state) => ({
                    contacts: state.contacts.map((c) => (c.id === id ? previousContact : c)),
                }));
            }
            return { ok: false, error };
        }

        const savedContact = mapDbContactToClient(data);
        set((state) => ({
            contacts: state.contacts.map((c) => (c.id === id ? savedContact : c)),
        }));
        return { ok: true, data: savedContact };
    },

    addContact: async (newContact) => {
        const payload = {
            office_name: newContact.officeName || '',
            contact_name: newContact.contactName || '',
            street_address: newContact.streetAddress || '',
            city: newContact.city || '',
            state: newContact.state || '',
            zip: newContact.zip || '',
            website: newContact.website || '',
            mailing: newContact.mailing || '',
            phone1: formatPhone((newContact.phone1 || '').trim()),
            phone2: formatPhone((newContact.phone2 || '').trim()),
            email: (newContact.email || '').trim().toLowerCase(),
            who: newContact.who || '',
            comments: newContact.comments || '',
            a: !!newContact.a,
            b: !!newContact.b,
            c: !!newContact.c,
            pinned_note: newContact.pinnedNote || '',
            specialties: newContact.specialties || [],
            notes: newContact.notes || [],
        };

        const { data, error } = await supabase.from('contacts').insert(payload).select().single();
        if (error || !data) {
            console.error("Error adding contact", error);
            get().notify('Could not create the contact.', 'error');
            return null;
        }

        const createdContact = mapDbContactToClient(data);

        set((state) => ({ contacts: [createdContact, ...state.contacts] }));
        return data.id;
    },

    deleteContact: async (id) => {
        const previousContacts = get().contacts;
        set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) }));

        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) {
            console.error('Error deleting contact:', error);
            get().notify('Could not delete the contact.', 'error');
            set({ contacts: previousContacts });
            return { ok: false, error };
        }

        return { ok: true };
    },

    // ── Office-level writes ─────────────────────────────────────────────
    // `ids` may be a single contact id or an array (every contact in the same office).
    // Each action: optimistic update -> one DB call -> rollback + toast on failure.
    setStatus: async (ids, status) => {
        const idList = toIds(ids);
        const patch = { a: status === 'a', b: status === 'b', c: status === 'c' };
        const rollback = snapshot(get().contacts, idList);

        set((state) => ({
            contacts: state.contacts.map((c) => (idList.includes(c.id) ? { ...c, ...patch } : c)),
        }));

        const { error } = await supabase.from('contacts').update(patch).in('id', idList);
        if (error) {
            console.error('Error setting status:', error);
            restore(set, rollback);
            get().notify('Could not save the tier. Nothing was changed.', 'error');
            return { ok: false, error };
        }
        return { ok: true };
    },

    addSpecialty: async (ids, specialty) => {
        const idList = toIds(ids);
        const value = (specialty || '').trim();
        if (!value) return { ok: false, reason: 'empty' };
        const rollback = snapshot(get().contacts, idList);

        set((state) => ({
            contacts: state.contacts.map((c) => {
                if (!idList.includes(c.id)) return c;
                const current = c.specialties || [];
                if (current.some((x) => x.toLowerCase() === value.toLowerCase())) return c;
                return { ...c, specialties: [...current, value] };
            }),
        }));

        const { error } = await supabase.rpc('add_contact_specialty', { p_contact_ids: idList, p_specialty: value });
        if (error) {
            console.error('Error adding specialty:', error);
            restore(set, rollback);
            get().notify('Could not add the specialty.', 'error');
            return { ok: false, error };
        }
        return { ok: true };
    },

    removeSpecialty: async (ids, specialty) => {
        const idList = toIds(ids);
        const rollback = snapshot(get().contacts, idList);

        set((state) => ({
            contacts: state.contacts.map((c) =>
                idList.includes(c.id) ? { ...c, specialties: (c.specialties || []).filter((x) => x !== specialty) } : c
            ),
        }));

        const { error } = await supabase.rpc('remove_contact_specialty', { p_contact_ids: idList, p_specialty: specialty });
        if (error) {
            console.error('Error removing specialty:', error);
            restore(set, rollback);
            get().notify('Could not remove the specialty.', 'error');
            return { ok: false, error };
        }
        return { ok: true };
    },

    addNote: async (ids, noteInput) => {
        const idList = toIds(ids);
        const text = (typeof noteInput === 'string' ? noteInput : noteInput?.text || '').trim();
        if (!text) return { ok: false, reason: 'empty' };

        const note = {
            id: Date.now(),
            text,
            category: typeof noteInput === 'object' ? noteInput?.category || 'note' : 'note',
            timestamp: new Date().toISOString(),
        };
        const author = get().user?.email?.toLowerCase() || '';
        const rollback = snapshot(get().contacts, idList);

        set((state) => ({
            contacts: state.contacts.map((c) =>
                idList.includes(c.id) ? { ...c, notes: [{ ...note, author }, ...(c.notes || [])] } : c
            ),
        }));

        // Atomic server-side prepend: two people saving at once can no longer overwrite each other.
        const { error } = await supabase.rpc('append_contact_note', { p_contact_ids: idList, p_note: note });
        if (error) {
            console.error('Error adding note:', error);
            restore(set, rollback);
            get().notify('Note was not saved. Please try again.', 'error');
            return { ok: false, error };
        }
        return { ok: true };
    },

    addComment: async (ids, text) => get().addNote(ids, { text, category: 'note' }),

    updatePinnedNote: async (ids, text) => {
        const idList = toIds(ids);
        const rollback = snapshot(get().contacts, idList);

        set((state) => ({
            contacts: state.contacts.map((c) => (idList.includes(c.id) ? { ...c, pinnedNote: text } : c)),
        }));

        const { error } = await supabase.from('contacts').update({ pinned_note: text }).in('id', idList);
        if (error) {
            console.error('Error saving pinned note:', error);
            restore(set, rollback);
            get().notify('Could not save the pinned note.', 'error');
            return { ok: false, error };
        }
        return { ok: true };
    },

    // ── Toasts ──────────────────────────────────────────────────────────
    toast: null,
    notify: (message, type = 'info') => {
        const id = Date.now();
        set({ toast: { id, message, type } });
        setTimeout(() => {
            if (get().toast?.id === id) set({ toast: null });
        }, 5000);
    },
    dismissToast: () => set({ toast: null }),

    // Contacts that belong to the same practice: same name AND same city.
    // (Name alone merged unrelated practices, e.g. "Angkor Chiropractic" in Modesto and San Jose.)
    getOfficeContacts: (contact) => {
        if (!contact) return [];
        const key = officeKey(contact);
        if (!key) return [contact];
        return get().contacts.filter((c) => officeKey(c) === key);
    },

    getContact: (id) => {
        return get().contacts.find((c) => c.id === Number(id)) || null;
    },

    getFilteredContacts: () => {
        const state = get();
        let list = state.contacts;

        // Live multi-term search (every word must match somewhere). Phones match by digits only.
        const q = state.activeSearchQuery.toLowerCase().trim();
        if (q) {
            const terms = q.split(/\s+/).filter(Boolean);
            list = list.filter((c) => {
                const text = [
                    c.officeName, c.contactName, c.city, c.email, c.who, c.comments,
                    c.streetAddress, c.zip, c.website, (c.specialties || []).join(' '),
                ].join(' ').toLowerCase();
                const phones = [c.phone1, c.phone2, c.phone3, c.phone4].map(digitsOnly).join(' ');
                return terms.every((t) => {
                    if (text.includes(t)) return true;
                    const td = digitsOnly(t);
                    return td.length >= 3 && phones.includes(td);
                });
            });
        }

        // City filter
        if (state.cityFilter) {
            list = list.filter((c) => c.city === state.cityFilter);
        }

        // Specialty filter
        if (state.specialtyFilter) {
            list = list.filter((c) => c.specialties && c.specialties.includes(state.specialtyFilter));
        }

        // Status filter
        if (state.statusFilter === 'a') list = list.filter((c) => c.a);
        else if (state.statusFilter === 'b') list = list.filter((c) => c.b);
        else if (state.statusFilter === 'c') list = list.filter((c) => c.c);
        else if (state.statusFilter === 'none') list = list.filter((c) => !c.a && !c.b && !c.c);

        // Sort by status A -> B -> C -> None
        const statusWeight = (c) => {
            if (c.a) return 1;
            if (c.b) return 2;
            if (c.c) return 3;
            return 4; // None
        };

        list = [...list].sort((c1, c2) => {
            const w1 = statusWeight(c1);
            const w2 = statusWeight(c2);
            if (w1 !== w2) return w1 - w2;
            return (c1.officeName || '').localeCompare(c2.officeName || '');
        });

        return list;
    },

    getStats: () => {
        const contacts = get().contacts;
        const total = contacts.length;
        const statusA = contacts.filter((c) => c.a).length;
        const statusB = contacts.filter((c) => c.b).length;
        const statusC = contacts.filter((c) => c.c).length;
        const none = total - statusA - statusB - statusC;

        // City counts
        const cityMap = {};
        contacts.forEach((c) => {
            if (c.city) cityMap[c.city] = (cityMap[c.city] || 0) + 1;
        });
        const cities = Object.entries(cityMap)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));

        // Unique Specialties
        const specialtySet = new Set();
        contacts.forEach((c) => {
            if (c.specialties) {
                c.specialties.forEach(s => specialtySet.add(s));
            }
        });
        const allSpecialties = Array.from(specialtySet).sort();

        return { total, statusA, statusB, statusC, none, cities, allSpecialties };
    },

    canExport: () => get().role === 'admin',
    canDelete: () => get().role === 'admin',
    canManageUsers: () => get().role === 'admin',
}));
