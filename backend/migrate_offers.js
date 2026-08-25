const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/zlecenia_db'
});

async function migrate() {
  try {
    console.log("Rozpoczynanie migracji: Moduł ofert...");

    // 1. Utworzenie tabeli offers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS offers (
        id SERIAL PRIMARY KEY,
        client_id INT REFERENCES clients(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'robocza',
        valid_until DATE,
        notes TEXT,
        total_net DECIMAL(12, 2) DEFAULT 0.00,
        total_vat DECIMAL(12, 2) DEFAULT 0.00,
        total_gross DECIMAL(12, 2) DEFAULT 0.00,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Tabela 'offers' została utworzona lub już istnieje.");

    // 2. Utworzenie tabeli offer_items
    await pool.query(`
      CREATE TABLE IF NOT EXISTS offer_items (
        id SERIAL PRIMARY KEY,
        offer_id INT REFERENCES offers(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        quantity DECIMAL(10, 2) DEFAULT 1.00,
        unit VARCHAR(20) DEFAULT 'szt.',
        unit_price_net DECIMAL(12, 2) DEFAULT 0.00,
        vat_rate INTEGER DEFAULT 23,
        net_amount DECIMAL(12, 2) DEFAULT 0.00,
        vat_amount DECIMAL(12, 2) DEFAULT 0.00,
        gross_amount DECIMAL(12, 2) DEFAULT 0.00
      );
    `);
    console.log("Tabela 'offer_items' została utworzona lub już istnieje.");

    console.log("Migracja ofert zakończona sukcesem!");
  } catch (err) {
    console.error("Błąd podczas migracji ofert:", err);
  } finally {
    await pool.end();
  }
}

migrate();
