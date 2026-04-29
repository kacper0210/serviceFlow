const pool = require('./db');

async function createTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounting_settings (
      id SERIAL PRIMARY KEY,
      year INT NOT NULL,
      month INT NOT NULL,
      carried_vat NUMERIC(10,2) DEFAULT 0,
      UNIQUE(year, month)
    )
  `);
  console.log("Tabela accounting_settings utworzona");
  process.exit(0);
}

createTable();
