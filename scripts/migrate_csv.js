import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import { parse } from 'csv-parse/sync'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase credentials in .env.local")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function migrate() {
    console.log("Loading CSV data...")
    const content = fs.readFileSync('Data/ChiroOrthoPainAttorney List - Copy(Sheet1).csv', 'utf8')
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    })

    console.log(`Parsed ${records.length} rows from CSV.`)

    // We will build the new inserts
    const newContacts = []

    records.forEach(r => {
        // Map common fields
        const officeName = r['Office Name'] || ''
        if (!officeName.trim()) return // Skip empty rows

        const a = r['A'] === '1'
        const b = r['B'] === '1'
        const c = r['C'] === '1'
        
        const streetAddress = r['Address'] || ''
        const city = r['City'] || ''
        const state = r['State'] || ''
        const zip = r['Zip Code'] || ''
        const phone1 = r['Phone 1'] || ''
        const phone2 = r['Phone 2'] || ''
        const phone3 = r['Phone 3'] || ''
        const who = r['WHO'] || ''
        const website = r['Office Website'] || ''
        const comments = r['Notes'] || ''
        const email = r['Email'] || ''
        const specialtiesRaw = r['Specialties'] || ''
        const specialties = specialtiesRaw ? specialtiesRaw.split(',').map(s => s.trim()).filter(Boolean) : []

        // Extract contact names
        const doc1 = r["Doctor's/ Attorney's Name"]?.trim() || ''
        const doc2 = r["Doctor's/ Attorney's Name 2"]?.trim() || ''

        // Create base object to duplicate
        const baseContact = {
            office_name: officeName,
            email: email,
            a: a,
            b: b,
            c: c,
            who: who,
            street_address: streetAddress,
            city: city,
            state: state,
            zip: zip,
            phone1: phone1,
            phone2: phone2,
            phone3: phone3,
            specialties: specialties,
            website: website,
            comments: comments,
            notes: [],
        }

        if (doc1 || (!doc1 && !doc2)) {
            newContacts.push({
                ...baseContact,
                contact_name: doc1
            })
        }

        if (doc2) {
            newContacts.push({
                ...baseContact,
                contact_name: doc2
            })
        }
    })

    console.log(`Generated ${newContacts.length} total contact records (supporting multiple people per office).`)

    console.log("\nDeleting all existing records from Supabase...")
    // In Supabase JS, to delete all records without a specific ID match, we can match explicitly where id is not null
    const { error: delError } = await supabase.from('contacts').delete().neq('id', -1)
    
    if (delError) {
        console.error("Failed to delete existing records:", delError)
        return
    }
    console.log("Successfully deleted existing records.")

    console.log("\nInserting new records in batches...")
    const batchSize = 100
    for (let i = 0; i < newContacts.length; i += batchSize) {
        const batch = newContacts.slice(i, i + batchSize)

        const { error: insError } = await supabase.from('contacts').insert(batch)
        
        if (insError) {
            console.error(`Failed to insert batch ${i} to ${i + batchSize}:`, insError)
        } else {
            console.log(`Inserted batch ${i} to ${Math.min(i + batchSize, newContacts.length)}...`)
        }
    }

    console.log("\nMigration complete! Your Rolodex is fully updated.")
}

migrate()
