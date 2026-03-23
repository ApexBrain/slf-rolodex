import { createClient } from '@supabase/supabase-js'
import { initialData } from '../src/data.js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing environment variables. Make sure .env.local exists.")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function migrate() {
    console.log(`Starting migration of ${initialData.length} records...`)

    // Chunk the data to avoid size limits (Supabase/Postgres limits)
    const chunkSize = 100
    for (let i = 0; i < initialData.length; i += chunkSize) {
        const chunk = initialData.slice(i, i + chunkSize).map(c => ({
            id: c.id,
            office_name: c.officeName,
            contact_name: c.contactName,
            email: c.email,
            a: c.a,
            b: c.b,
            c: c.c,
            who: c.who,
            mailing: c.mailing,
            street_address: c.streetAddress,
            city: c.city,
            zip: c.zip,
            state: c.state,
            phone1: c.phone1,
            phone2: c.phone2,
            phone3: c.phone3,
            phone4: c.phone4,
            website: c.website,
            comments: c.comments,
            pinned_note: c.pinnedNote,
            specialties: c.specialties || []
        }))

        const { error } = await supabase
            .from('contacts')
            .upsert(chunk, { onConflict: 'id' })

        if (error) {
            console.error(`Error migrating chunk starting at ${i}:`, error.message)
        } else {
            console.log(`Migrated chunk starting at ${i}...`)
        }
    }

    console.log("Migration complete!")
}

migrate()
