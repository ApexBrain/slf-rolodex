import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const adminUsers = [
    {
        email: 'chris@scrantonlawfirm.com',
        password: 'chris@scrantonlawfirm.com',
    },
    {
        email: 'andresl@scrantonlawfirm.com',
        password: 'andresl@scrantonlawfirm.com',
    },
];

async function findAuthUserByEmail(email) {
    let page = 1;
    const perPage = 200;

    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
        if (error) throw error;

        const users = data?.users || [];
        const match = users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
        if (match) return match;

        if (users.length < perPage) return null;
        page += 1;
    }
}

async function ensureAdminUser({ email, password }) {
    const normalizedEmail = email.toLowerCase();
    let authUser = await findAuthUserByEmail(normalizedEmail);

    if (!authUser) {
        const { data, error } = await supabase.auth.admin.createUser({
            email: normalizedEmail,
            password,
            email_confirm: true,
        });
        if (error) throw error;
        authUser = data.user;
        console.log(`Created auth user: ${normalizedEmail}`);
    } else {
        const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
            password,
            email_confirm: true,
        });
        if (error) throw error;
        console.log(`Updated auth user password: ${normalizedEmail}`);
    }

    const { error: upsertError } = await supabase
        .from('app_users')
        .upsert(
            {
                email: normalizedEmail,
                role: 'admin',
                is_active: true,
            },
            { onConflict: 'email' }
        );

    if (upsertError) throw upsertError;
    console.log(`Ensured admin role: ${normalizedEmail}`);
}

async function run() {
    try {
        for (const user of adminUsers) {
            await ensureAdminUser(user);
        }
        console.log('Admin user setup complete.');
    } catch (error) {
        console.error('Failed creating admin users:', error);
        process.exit(1);
    }
}

run();
