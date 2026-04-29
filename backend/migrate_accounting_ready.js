const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/zlecenia_db'
});

async function migrate() {
  try {
    console.log("Starting migration: Adding is_ready to accounting entries...");
    
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'accounting_entries' AND column_name = 'is_ready'
    `);
    
    if (cols.rowCount === 0) {
      await pool.query(`ALTER TABLE accounting_entries ADD COLUMN is_ready BOOLEAN DEFAULT FALSE`);
      console.log("Added is_ready column.");
    }

    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
