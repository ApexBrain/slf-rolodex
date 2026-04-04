import fs from 'fs';
import path from 'path';
import pkg from 'pg';
import dotenv from 'dotenv';

const { Client } = pkg;
dotenv.config({ path: '.env.local' });

const rawConnectionString = process.env.SUPABASE_POSTGRES_URL_NON_POOLING;
if (!rawConnectionString) {
    console.error('Missing SUPABASE_POSTGRES_URL_NON_POOLING in .env.local');
    process.exit(1);
}

const connectionString = rawConnectionString.replace('?sslmode=require', '');
const sqlPath = path.resolve(process.cwd(), 'scripts/setup_user_management.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
});

async function run() {
    try {
        await client.connect();
        await client.query(sql);
        console.log('User management schema and policies applied successfully.');
    } catch (error) {
        console.error('Failed applying user management SQL:', error);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}

run();
