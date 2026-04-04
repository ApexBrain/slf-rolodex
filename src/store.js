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

    setSearch: (query) => set({ searchQuery: query }),
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
            phone1: newContact.phone1 || '',
            phone2: newContact.phone2 || '',
            email: newContact.email || '',
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
            set({ contacts: previousContacts });
            return { ok: false, error };
        }

        return { ok: true };
    },

    setStatus: async (id, status) => {
        const a = status === 'a';
        const b = status === 'b';
        const c = status === 'c';
        
        set((state) => ({
            contacts: state.contacts.map((contact) =>
                contact.id === id ? { ...contact, a, b, c } : contact
            ),
        }));

        await supabase.from('contacts').update({ a, b, c }).eq('id', id);
    },

    addSpecialty: async (id, specialty) => {
        let currentArray = [];
        set((state) => ({
            contacts: state.contacts.map((c) => {
                if (c.id === id) {
                    currentArray = c.specialties || [];
                    if (!currentArray.some(s => s.toLowerCase() === specialty.toLowerCase())) {
                        currentArray = [...currentArray, specialty];
                        return { ...c, specialties: currentArray };
                    }
                }
                return c;
            })
        }));

        if (currentArray.length > 0) {
            await supabase.from('contacts').update({ specialties: currentArray }).eq('id', id);
        }
    },

    removeSpecialty: async (id, specialtyToRemove) => {
        let newArray = [];
        set((state) => ({
            contacts: state.contacts.map((c) => {
                if (c.id === id) {
                    newArray = (c.specialties || []).filter(s => s !== specialtyToRemove);
                    return { ...c, specialties: newArray };
                }
                return c;
            }),
        }));

        await supabase.from('contacts').update({ specialties: newArray }).eq('id', id);
    },

    addNote: async (contactId, noteInput) => {
        const text = typeof noteInput === 'string' ? noteInput : noteInput?.text || '';
        const category = typeof noteInput === 'object' ? noteInput?.category || 'note' : 'note';
        const trimmedText = text.trim();

        if (!trimmedText) return;

        const newNote = {
            id: Date.now(),
            text: trimmedText,
            category,
            timestamp: new Date().toISOString(),
        };

        let previousNotesArray = [];
        let newNotesArray = [];

        set((state) => ({
            contacts: state.contacts.map((c) => {
                if (c.id === contactId) {
                    previousNotesArray = c.notes || [];
                    newNotesArray = [newNote, ...previousNotesArray];
                    return { ...c, notes: newNotesArray };
                }
                return c;
            }),
        }));

        const { error } = await supabase.from('contacts').update({ notes: newNotesArray }).eq('id', contactId);
        if (error) {
            console.error('Error adding note:', error);
            set((state) => ({
                contacts: state.contacts.map((c) =>
                    c.id === contactId ? { ...c, notes: previousNotesArray } : c
                ),
            }));
        }
    },

    addComment: async (contactId, text) => {
        await get().addNote(contactId, { text, category: 'note' });
    },

    updatePinnedNote: async (contactId, text) => {
        set((state) => ({
            contacts: state.contacts.map((c) =>
                c.id === contactId ? { ...c, pinnedNote: text } : c
            ),
        }));

        await supabase.from('contacts').update({ pinned_note: text }).eq('id', contactId);
    },

    getContact: (id) => {
        return get().contacts.find((c) => c.id === Number(id)) || null;
    },

    getFilteredContacts: () => {
        const state = get();
        let list = state.contacts;

        // Text search
        const q = state.activeSearchQuery.toLowerCase().trim();
        if (q) {
            list = list.filter(
                (c) =>
                    (c.officeName?.toLowerCase() || '').includes(q) ||
                    (c.contactName?.toLowerCase() || '').includes(q) ||
                    (c.city?.toLowerCase() || '').includes(q) ||
                    (c.email?.toLowerCase() || '').includes(q) ||
                    (c.who?.toLowerCase() || '').includes(q) ||
                    (c.comments?.toLowerCase() || '').includes(q)
            );
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
