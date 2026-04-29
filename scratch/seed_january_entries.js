const pool = require("../backend/db");


async function seedData() {
  const entries = [
    // PRZYCHODY (8% i 23% VAT)
    {
      date: "2026-01-10",
      number: "FV 01/2026",
      contractor: "Wigury - Spółdzielnia/Wspólnota",
      description: "Wigury domofon i drzwi",
      net_amount: 200.00,
      vat_rate: 8,
      vat_amount: 16.00,
      gross_amount: 216.00,
      category: "Serwis",
      is_car_cost: false,
      entry_type: "revenue"
    },
    {
      date: "2026-01-12",
      number: "FV 02/2026",
      contractor: "Konopnicka 6",
      description: "konopnicka 6 unifon",
      net_amount: 231.48,
      vat_rate: 8,
      vat_amount: 18.52,
      gross_amount: 250.00,
      category: "Montaż",
      is_car_cost: false,
      entry_type: "revenue"
    },
    {
      date: "2026-01-15",
      number: "FV 03/2026",
      contractor: "Bistro Jajo",
      description: "bistro jajo - serwis",
      net_amount: 813.00,
      vat_rate: 23,
      vat_amount: 186.99,
      gross_amount: 999.99,
      category: "Serwis",
      is_car_cost: false,
      entry_type: "revenue"
    },
    {
      date: "2026-01-18",
      number: "FV 04/2026",
      contractor: "Chopina 4",
      description: "unifon chopina 4",
      net_amount: 231.48,
      vat_rate: 8,
      vat_amount: 18.52,
      gross_amount: 250.00,
      category: "Montaż",
      is_car_cost: false,
      entry_type: "revenue"
    },

    // KOSZTY (23% VAT)
    {
      date: "2026-01-05",
      number: "HURT/001/26",
      contractor: "Hurton",
      description: "hurton vidos - sprzęt",
      net_amount: 1046.72,
      vat_rate: 23,
      vat_amount: 240.75,
      gross_amount: 1287.47,
      category: "Materiał",
      is_car_cost: false,
      entry_type: "expense"
    },
    {
      date: "2026-01-08",
      number: "EXP/002/26",
      contractor: "Sklep Techniczny",
      description: "wkladka do drzwi",
      net_amount: 93.50,
      vat_rate: 23,
      vat_amount: 21.51,
      gross_amount: 115.01,
      category: "Części",
      is_car_cost: false,
      entry_type: "expense"
    },
    {
      date: "2026-01-20",
      number: "WSZ/2026/01",
      contractor: "Wszamaj",
      description: "wszamaj - catering/usługa",
      net_amount: 2032.52,
      vat_rate: 23,
      vat_amount: 467.48,
      gross_amount: 2500.00,
      category: "Inne",
      is_car_cost: false,
      entry_type: "expense"
    },
    {
      date: "2026-01-25",
      number: "KKS/01/26",
      contractor: "Księgowa",
      description: "Usługi księgowe - Styczeń",
      net_amount: 289.51,
      vat_rate: 23,
      vat_amount: 66.59,
      gross_amount: 356.10,
      category: "Księgowość",
      is_car_cost: false,
      entry_type: "expense"
    }
  ];

  try {
    for (const e of entries) {
      await pool.query(
        `INSERT INTO accounting_entries 
        (date, number, contractor, description, net_amount, vat_rate, vat_amount, gross_amount, category, is_car_cost, entry_type) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [e.date, e.number, e.contractor, e.description, e.net_amount, e.vat_rate, e.vat_amount, e.gross_amount, e.category, e.is_car_cost, e.entry_type]
      );
      console.log(`Dodano: ${e.contractor}`);
    }
    console.log("Gotowe!");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

seedData();
