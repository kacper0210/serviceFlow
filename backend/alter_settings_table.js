const pool = require('./db');

async function alterTable() {
  try {
    await pool.query(`ALTER TABLE accounting_settings ADD COLUMN manual_profit NUMERIC(10,2);`);
    console.log("Column added");
  } catch(e) {
    console.log(e.message);
  }
  process.exit(0);
}

alterTable();
