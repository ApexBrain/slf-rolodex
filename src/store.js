import { create } from 'zustand';
import { initialData } from './data.js';

export const useStore = create((set, get) => ({
    contacts: initialData,
    searchQuery: '', // Draft input text
    activeSearchQuery: '', // Applied on enter
    cityFilter: '',
    specialtyFilter: '', // Filter by a specific specialty
    statusFilter: '', // '', 'a', 'b', 'c', 'none'

    setSearch: (query) => set({ searchQuery: query }),
    executeSearch: () => set((state) => ({ activeSearchQuery: state.searchQuery })),
    setCityFilter: (city) => set({ cityFilter: city }),
    setSpecialtyFilter: (specialty) => set({ specialtyFilter: specialty }),
    setStatusFilter: (status) => set({ statusFilter: status }),

    updateContact: (id, updates) =>
        set((state) => ({
            contacts: state.contacts.map((c) =>
                c.id === id ? { ...c, ...updates } : c
            ),
        })),

    addContact: (newContact) => {
        let newId = null;
        set((state) => {
            const maxId = Math.max(...state.contacts.map(c => c.id || 0), 0);
            newId = maxId + 1;
            const createdContact = {
                phone1: '', phone2: '', email: '', contactName: '',
                ...newContact,
                id: newId,
                a: false, b: false, c: false,
                notes: [],
                specialties: [], // Initialize empty specialties array
                pinnedNote: ''
            };
            return { contacts: [createdContact, ...state.contacts] };
        });
        return newId;
    },

    setStatus: (id, status) =>
        set((state) => ({
            contacts: state.contacts.map((c) =>
                c.id === id
                    ? { ...c, a: status === 'a', b: status === 'b', c: status === 'c' }
                    : c
            ),
        })),

    addSpecialty: (id, specialty) =>
        set((state) => ({
            contacts: state.contacts.map((c) => {
                if (c.id === id) {
                    const current = c.specialties || [];
                    // Prevent duplicates (case-insensitive)
                    if (!current.some(s => s.toLowerCase() === specialty.toLowerCase())) {
                        return { ...c, specialties: [...current, specialty] };
                    }
                }
                return c;
            })
        })),

    removeSpecialty: (id, specialtyToRemove) =>
        set((state) => ({
            contacts: state.contacts.map((c) =>
                c.id === id
                    ? { ...c, specialties: (c.specialties || []).filter(s => s !== specialtyToRemove) }
                    : c
            ),
        })),

    addComment: (contactId, text) =>
        set((state) => ({
            contacts: state.contacts.map((c) =>
                c.id === contactId
                    ? {
                        ...c,
                        notes: [
                            {
                                id: Date.now(),
                                text: text,
                                timestamp: new Date().toISOString(),
                            },
                            ...c.notes,
                        ],
                    }
                    : c
            ),
        })),

    updatePinnedNote: (contactId, text) =>
        set((state) => ({
            contacts: state.contacts.map((c) =>
                c.id === contactId ? { ...c, pinnedNote: text } : c
            ),
        })),

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
                    c.officeName.toLowerCase().includes(q) ||
                    c.contactName.toLowerCase().includes(q) ||
                    c.city.toLowerCase().includes(q) ||
                    c.email.toLowerCase().includes(q) ||
                    c.who.toLowerCase().includes(q) ||
                    c.comments.toLowerCase().includes(q)
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
}));
