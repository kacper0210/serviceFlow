const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/zlecenia_db'
});

async function migrate() {
  try {
    console.log("Starting migration: Refactoring accounting to manual entries...");
    
    // 1. Rename table expenses to accounting_entries
    await pool.query(`ALTER TABLE expenses RENAME TO accounting_entries`);
    console.log("Renamed table to accounting_entries.");

    // 2. Add type column (revenue/expense)
    await pool.query(`ALTER TABLE accounting_entries ADD COLUMN entry_type TEXT DEFAULT 'expense'`);
    
    // 3. Set existing ones as expenses
    await pool.query(`UPDATE accounting_entries SET entry_type = 'expense'`);

    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
