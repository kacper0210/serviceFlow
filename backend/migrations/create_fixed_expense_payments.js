const pool = require("../db");

async function migrate() {
  try {
    console.log("Creating fixed_expense_payments table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fixed_expense_payments (
        id SERIAL PRIMARY KEY,
        fixed_expense_id INTEGER REFERENCES fixed_expenses(id) ON DELETE CASCADE,
        year_month VARCHAR(7) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        due_date DATE,
        is_paid BOOLEAN DEFAULT FALSE,
        paid_at TIMESTAMP WITHOUT TIME ZONE,
        notes TEXT,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_fixed_expense_month UNIQUE (fixed_expense_id, year_month)
      );
    `);
    console.log("Table fixed_expense_payments ready!");

    // Seed existing payments based on fixed_expenses created_at and last_paid_date
    const { rows: expenses } = await pool.query("SELECT * FROM fixed_expenses WHERE is_active = true");
    const months = ['2026-08', '2026-09', '2026-10'];

    for (const exp of expenses) {
      for (const ym of months) {
        const [yStr, mStr] = ym.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        const dueDay = Math.min(exp.due_day || 10, new Date(y, m, 0).getDate());
        const dueDate = `${ym}-${String(dueDay).padStart(2, '0')}`;

        let isPaid = false;
        let paidAt = null;

        if (exp.last_paid_date) {
          const paidYm = new Date(exp.last_paid_date).toISOString().substring(0, 7);
          if (paidYm === ym) {
            isPaid = true;
            paidAt = exp.last_paid_date;
          } else if (paidYm > ym) {
            // If last paid was in a later month, this prior month was paid
            isPaid = true;
            paidAt = `${ym}-${String(dueDay).padStart(2, '0')} 12:00:00`;
          }
        }

        await pool.query(`
          INSERT INTO fixed_expense_payments (fixed_expense_id, year_month, amount, due_date, is_paid, paid_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (fixed_expense_id, year_month) DO UPDATE SET
            amount = EXCLUDED.amount,
            due_date = EXCLUDED.due_date
        `, [exp.id, ym, exp.amount, dueDate, isPaid, paidAt]);
      }
    }

    console.log("Seeded initial monthly fixed expense payment records!");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate();
