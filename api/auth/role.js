import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, body) {
    res.status(status).setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return json(res, 405, { error: 'Method not allowed' });
    }

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
        return json(res, 500, { error: 'Server env missing Supabase keys' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return json(res, 401, { error: 'Missing bearer token' });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user?.email) {
        return json(res, 401, { error: 'Invalid session' });
    }

    const email = userData.user.email.toLowerCase();
    const { data: roleRow, error: roleError } = await adminClient
        .from('app_users')
        .select('role,is_active')
        .eq('email', email)
        .maybeSingle();

    if (roleError) {
        return json(res, 500, { error: roleError.message });
    }

    if (!roleRow || !roleRow.is_active) {
        return json(res, 200, { role: null });
    }

    return json(res, 200, { role: roleRow.role });
}
