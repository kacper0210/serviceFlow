const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/zlecenia_db'
});

async function migrate() {
  try {
    console.log("Starting migration: Accounting module...");
    
    // 1. Create expenses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        number TEXT NOT NULL,
        contractor TEXT,
        description TEXT,
        net_amount DECIMAL(12, 2) NOT NULL,
        vat_rate INTEGER DEFAULT 23,
        vat_amount DECIMAL(12, 2) NOT NULL,
        gross_amount DECIMAL(12, 2) NOT NULL,
        category TEXT DEFAULT 'Inne',
        is_car_cost BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Add vat_rate to orders
    const orderCols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'vat_rate'
    `);
    
    if (orderCols.rowCount === 0) {
      await pool.query(`ALTER TABLE orders ADD COLUMN vat_rate INTEGER DEFAULT 23`);
      console.log("Added vat_rate to orders table.");
    }

    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
