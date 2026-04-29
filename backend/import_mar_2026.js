const pool = require('./db');

const revenues = [
  { contractor: "Nestcore", net_amount: 1626.02, vat_rate: 23, vat_amount: 373.98, gross_amount: 2000.00 },
  { contractor: "Rąbino wspólnota", net_amount: 365.86, vat_rate: 8, vat_amount: 29.27, gross_amount: 395.13 },
  { contractor: "Koszalińska 17 montaż domofonu", net_amount: 1388.89, vat_rate: 8, vat_amount: 111.11, gross_amount: 1500.00 },
  { contractor: "Koszalińska 14 naprawa domofonu", net_amount: 138.89, vat_rate: 8, vat_amount: 11.11, gross_amount: 150.00 },
  { contractor: "Jakubowski kamera", net_amount: 406.50, vat_rate: 23, vat_amount: 93.50, gross_amount: 500.00 },
  { contractor: "Wymiana wkładki 85G Koszalinska", net_amount: 370.37, vat_rate: 23, vat_amount: 85.19, gross_amount: 455.56 },
];

const expenses = [
  { contractor: "wkładka", net_amount: 94.31, vat_rate: 23, vat_amount: 21.69, gross_amount: 116.00 },
  { contractor: "wszamaj", net_amount: 284.55, vat_rate: 23, vat_amount: 65.45, gross_amount: 350.00 },
  { contractor: "ksiegowa", net_amount: 297.64, vat_rate: 23, vat_amount: 68.46, gross_amount: 366.10 },
  { contractor: "korekta klamki", net_amount: -30.89, vat_rate: 23, vat_amount: -7.10, gross_amount: -37.99 },
  { contractor: "Hurton domofon", net_amount: 333.05, vat_rate: 23, vat_amount: 76.60, gross_amount: 409.65 },
];

async function insertData() {
  try {
    for (let i = 0; i < revenues.length; i++) {
      const r = revenues[i];
      await pool.query(
        `INSERT INTO accounting_entries (date, number, contractor, description, net_amount, vat_rate, vat_amount, gross_amount, category, is_car_cost, entry_type) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        ['2026-03-15', `REV/03/26/${i+1}`, r.contractor, 'Import z tabeli', r.net_amount, r.vat_rate, r.vat_amount, r.gross_amount, 'Sprzedaż', false, 'revenue']
      );
    }
    
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      await pool.query(
        `INSERT INTO accounting_entries (date, number, contractor, description, net_amount, vat_rate, vat_amount, gross_amount, category, is_car_cost, entry_type) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        ['2026-03-15', `EXP/03/26/${i+1}`, e.contractor, 'Import z tabeli', e.net_amount, e.vat_rate, e.vat_amount, e.gross_amount, 'Inne', false, 'expense']
      );
    }
    
    console.log("Dane za marzec zostały dodane do bazy danych!");
  } catch (error) {
    console.error("Błąd podczas dodawania:", error);
  } finally {
    pool.end();
  }
}

insertData();
