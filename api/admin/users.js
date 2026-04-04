import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, body) {
    res.status(status).setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
}

async function findAuthUserByEmail(adminClient, email) {
    let page = 1;
    const perPage = 200;

    while (true) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const users = data?.users || [];
        const match = users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
        if (match) return match;
        if (users.length < perPage) return null;
        page += 1;
    }
}

async function requireAdmin(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return { ok: false, status: 401, message: 'Missing bearer token' };

    const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user?.email) {
        return { ok: false, status: 401, message: 'Invalid session' };
    }

    const email = userData.user.email.toLowerCase();
    const { data: roleRow, error: roleError } = await adminClient
        .from('app_users')
        .select('role,is_active')
        .eq('email', email)
        .maybeSingle();

    if (roleError || !roleRow || !roleRow.is_active || roleRow.role !== 'admin') {
        return { ok: false, status: 403, message: 'Admin access required' };
    }

    return { ok: true, adminClient };
}

export default async function handler(req, res) {
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
        return json(res, 500, { error: 'Server env missing Supabase keys' });
    }

    if (req.method !== 'POST' && req.method !== 'PATCH') {
        return json(res, 405, { error: 'Method not allowed' });
    }

    const auth = await requireAdmin(req);
    if (!auth.ok) {
        return json(res, auth.status, { error: auth.message });
    }

    const { adminClient } = auth;

    try {
        if (req.method === 'POST') {
            const { email, password, role } = req.body || {};
            const normalizedEmail = (email || '').trim().toLowerCase();
            if (!normalizedEmail || !password || !['admin', 'staff'].includes(role)) {
                return json(res, 400, { error: 'Invalid payload' });
            }

            let authUser = await findAuthUserByEmail(adminClient, normalizedEmail);
            if (!authUser) {
                const { data, error } = await adminClient.auth.admin.createUser({
                    email: normalizedEmail,
                    password,
                    email_confirm: true,
                });
                if (error) return json(res, 400, { error: error.message });
                authUser = data.user;
            } else {
                const { error } = await adminClient.auth.admin.updateUserById(authUser.id, {
                    password,
                    email_confirm: true,
                });
                if (error) return json(res, 400, { error: error.message });
            }

            const { data: appUser, error: upsertError } = await adminClient
                .from('app_users')
                .upsert({ email: normalizedEmail, role, is_active: true }, { onConflict: 'email' })
                .select('id,email,role,is_active,created_at')
                .single();

            if (upsertError) return json(res, 400, { error: upsertError.message });
            return json(res, 200, { user: appUser });
        }

        const { email, newPassword } = req.body || {};
        const normalizedEmail = (email || '').trim().toLowerCase();
        if (!normalizedEmail || !newPassword) {
            return json(res, 400, { error: 'Invalid payload' });
        }

        let authUser = await findAuthUserByEmail(adminClient, normalizedEmail);
        if (!authUser) {
            const { data, error } = await adminClient.auth.admin.createUser({
                email: normalizedEmail,
                password: newPassword,
                email_confirm: true,
            });
            if (error) return json(res, 400, { error: error.message });
            authUser = data.user;
        } else {
            const { error } = await adminClient.auth.admin.updateUserById(authUser.id, {
                password: newPassword,
                email_confirm: true,
            });
            if (error) return json(res, 400, { error: error.message });
        }

        return json(res, 200, { ok: true });
    } catch (error) {
        return json(res, 500, { error: error?.message || 'Unexpected server error' });
    }
}
