const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/zlecenia_db'
});

async function migrate() {
  try {
    console.log("Starting migration: KSeF Integration tables...");

    // Add persistent session columns to ksef_settings if missing
    await pool.query(`
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT;
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS access_token_iv VARCHAR(100);
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS access_token_tag VARCHAR(100);
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS encrypted_refresh_token TEXT;
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS refresh_token_iv VARCHAR(100);
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS refresh_token_tag VARCHAR(100);
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS access_token_expires_at BIGINT;
      ALTER TABLE ksef_settings ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP;
    `);

    // 2. Create ksef_invoices table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ksef_invoices (
        id SERIAL PRIMARY KEY,
        ksef_reference_number VARCHAR(100) UNIQUE,
        invoice_number VARCHAR(100) NOT NULL,
        contractor_name VARCHAR(255) NOT NULL,
        contractor_nip VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        net_amount DECIMAL(12, 2) NOT NULL,
        vat_rate INTEGER DEFAULT 23,
        vat_amount DECIMAL(12, 2) NOT NULL,
        gross_amount DECIMAL(12, 2) NOT NULL,
        is_imported BOOLEAN DEFAULT FALSE,
        is_car_cost BOOLEAN DEFAULT FALSE,
        suggested_category VARCHAR(100),
        accounting_entry_id INTEGER REFERENCES accounting_entries(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE ksef_invoices ADD COLUMN IF NOT EXISTS is_car_cost BOOLEAN DEFAULT FALSE;
      ALTER TABLE ksef_invoices ADD COLUMN IF NOT EXISTS suggested_category VARCHAR(100);
    `);
    console.log("Created/updated table 'ksef_invoices'.");

    console.log("KSeF migration completed successfully!");
  } catch (err) {
    console.error("KSeF migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
