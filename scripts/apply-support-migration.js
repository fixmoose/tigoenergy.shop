import pg from 'pg';
import fs from 'fs';

const connectionString = "postgresql://postgres.pvefofjswvsqjckuobju:p-v-e-f-o-f-j-s-w-v-s-q-j-c-k-u-o-b-j-u@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";

async function applyMigration() {
    const client = new pg.Client({ connectionString });
    try {
        await client.connect();
        const sql = fs.readFileSync('supabase/migrations/20260205_support_requests.sql', 'utf8');
        await client.query(sql);
        console.log("Migration applied successfully!");
    } catch (err) {
        console.error("Error applying migration:", err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

applyMigration();
