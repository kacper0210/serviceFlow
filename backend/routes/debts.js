const express = require("express");
const pool = require("../db");
const { checkAuth, asyncHandler } = require("../middleware/auth");

const router = express.Router();
router.use(checkAuth);

function parseAmount(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const normalized = String(val).replace(',', '.').trim();
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper to auto-create snapshot of total debt sum for current date
async function recordAutoSnapshot(clientOrPool) {
  try {
    const totalRes = await clientOrPool.query("SELECT COALESCE(SUM(total_amount), 0) AS total FROM debts");
    const currentTotal = parseAmount(totalRes.rows[0].total);
    const today = new Date().toISOString().split('T')[0];

    await clientOrPool.query(
      `INSERT INTO debt_snapshots (snapshot_date, total_debt, notes)
       VALUES ($1, $2, 'Automatyczna migawka po zmianie zobowiązań')
       ON CONFLICT (snapshot_date) DO UPDATE SET total_debt = EXCLUDED.total_debt`,
      [today, currentTotal]
    );
  } catch (err) {
    console.error("[Auto-Snapshot Error]", err);
  }
}

// Helper to auto-reset monthly paid statuses and generate upcoming month's installment payments
async function ensureMonthlyInstallmentsAndResets(clientOrPool) {
  try {
    const today = new Date();
    const currentMonthStr = today.toISOString().substring(0, 7); // 'YYYY-MM'
    const [yearStr, monthStr] = currentMonthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12

    // 1. Reset is_paid_this_month for debts and fixed_expenses if last_paid_date is from a previous month
    await clientOrPool.query(`
      UPDATE debts
      SET is_paid_this_month = FALSE
      WHERE is_paid_this_month = TRUE
        AND (last_paid_date IS NULL OR TO_CHAR(last_paid_date, 'YYYY-MM') < $1)
    `, [currentMonthStr]);

    await clientOrPool.query(`
      UPDATE fixed_expenses
      SET is_paid_this_month = FALSE
      WHERE is_paid_this_month = TRUE
        AND (last_paid_date IS NULL OR TO_CHAR(last_paid_date, 'YYYY-MM') < $1)
    `, [currentMonthStr]);

    // 2. Auto-generate monthly installment entries in debt_payments for all active debts
    const debtsRes = await clientOrPool.query(
      "SELECT id, creditor, total_amount, monthly_installment, capital_installment, interest_installment, due_day FROM debts WHERE monthly_installment > 0 AND total_amount > 0"
    );

    for (const debt of debtsRes.rows) {
      const existingPay = await clientOrPool.query(
        `SELECT id FROM debt_payments 
         WHERE (debt_id = $1 OR LOWER(creditor) = LOWER($2)) 
           AND TO_CHAR(due_date, 'YYYY-MM') = $3 
         LIMIT 1`,
        [debt.id, debt.creditor, currentMonthStr]
      );

      if (existingPay.rows.length === 0) {
        let dueDay = parseInt(debt.due_day, 10);
        if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) dueDay = 10;

        const maxDays = new Date(year, month, 0).getDate();
        const actualDay = Math.min(dueDay, maxDays);
        const dueDateStr = `${currentMonthStr}-${String(actualDay).padStart(2, '0')}`;

        // Check if schedule entry exists for current month
        const schedRes = await clientOrPool.query(
          `SELECT * FROM debt_schedules 
           WHERE debt_id = $1 
             AND TO_CHAR(due_date, 'YYYY-MM') = $2 
           LIMIT 1`,
          [debt.id, currentMonthStr]
        );

        let amount = parseAmount(debt.monthly_installment);
        let capAmount = parseAmount(debt.capital_installment) || amount;
        let intAmount = parseAmount(debt.interest_installment) || 0;
        let isPaid = false;
        let notes = 'Automatyczna rata miesięczna';

        if (schedRes.rows.length > 0) {
          const s = schedRes.rows[0];
          amount = parseAmount(s.total_installment);
          capAmount = parseAmount(s.capital_part);
          intAmount = parseAmount(s.interest_part);
          isPaid = Boolean(s.is_paid);
          notes = `Rata nr ${s.installment_number} z harmonogramu spłat`;
        }

        await clientOrPool.query(
          `INSERT INTO debt_payments (debt_id, creditor, amount, capital_amount, interest_amount, due_date, is_paid, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [debt.id, debt.creditor, amount, capAmount, intAmount, dueDateStr, isPaid, notes]
        );
      }
    }
  } catch (err) {
    console.error("[Auto-Monthly-Installment Reset Error]", err);
  }
}

/* =========================================================================
   1. STATIC ROUTES (MUST BE BEFORE PARAMS /:id TO PREVENT ROUTE AMBIGUITY)
   ========================================================================= */

// GET /api/debts/snapshots - Fetch historical debt paydown trend data
router.get("/snapshots", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, TO_CHAR(snapshot_date, 'YYYY-MM-DD') AS snapshot_date, total_debt, notes FROM debt_snapshots ORDER BY snapshot_date ASC"
  );
  res.json(rows);
}));

// POST /api/debts/snapshots - Manually record a historical snapshot point
router.post("/snapshots", asyncHandler(async (req, res) => {
  const { snapshot_date, total_debt, notes } = req.body;
  if (!snapshot_date || total_debt === undefined) {
    return res.status(400).json({ error: "Brak daty lub kwoty zadłużenia" });
  }

  const parsedDebt = parseAmount(total_debt);
  const { rows } = await pool.query(
    `INSERT INTO debt_snapshots (snapshot_date, total_debt, notes)
     VALUES ($1, $2, $3)
     ON CONFLICT (snapshot_date) DO UPDATE SET total_debt = EXCLUDED.total_debt, notes = EXCLUDED.notes
     RETURNING id, TO_CHAR(snapshot_date, 'YYYY-MM-DD') AS snapshot_date, total_debt, notes`,
    [snapshot_date, parsedDebt, notes || ""]
  );

  res.json(rows[0]);
}));

// PUT /api/debts/snapshots/:id - Edit an existing historical snapshot point
router.put("/snapshots/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { snapshot_date, total_debt, notes } = req.body;

  if (!snapshot_date || total_debt === undefined) {
    return res.status(400).json({ error: "Brak daty lub kwoty zadłużenia" });
  }

  const parsedDebt = parseAmount(total_debt);
  const { rows } = await pool.query(
    `UPDATE debt_snapshots
     SET snapshot_date = $1, total_debt = $2, notes = $3
     WHERE id = $4
     RETURNING id, TO_CHAR(snapshot_date, 'YYYY-MM-DD') AS snapshot_date, total_debt, notes`,
    [snapshot_date, parsedDebt, notes || "", id]
  );

  if (rows.length === 0) return res.status(404).json({ error: "Brak wpisu" });
  res.json(rows[0]);
}));

// DELETE /api/debts/snapshots/:id - Delete a snapshot point
router.delete("/snapshots/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query("DELETE FROM debt_snapshots WHERE id = $1 RETURNING *", [id]);
  if (rows.length === 0) return res.status(404).json({ error: "Brak wpisu" });
  res.json({ message: "Usunięto stan na" });
}));

// GET /api/debts/payments - Fetch due payments list
router.get("/payments", asyncHandler(async (req, res) => {
  await ensureMonthlyInstallmentsAndResets(pool);
  const { rows } = await pool.query(
    "SELECT id, debt_id, creditor, amount, capital_amount, interest_amount, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, is_paid, paid_at, notes FROM debt_payments ORDER BY is_paid ASC, due_date ASC"
  );
  res.json(rows);
}));

// POST /api/debts/payments - Create a new upcoming payment
router.post("/payments", asyncHandler(async (req, res) => {
  const { debt_id, creditor, amount, capital_amount, interest_amount, due_date, notes } = req.body;
  if (!creditor || !amount || !due_date) {
    return res.status(400).json({ error: "Uzupełnij wierzyciela, kwotę i termin płatności" });
  }

  const parsedAmount = parseAmount(amount);
  const parsedCapital = parseAmount(capital_amount) || parsedAmount;
  const parsedInterest = parseAmount(interest_amount) || 0;

  const { rows } = await pool.query(
    `INSERT INTO debt_payments (debt_id, creditor, amount, capital_amount, interest_amount, due_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, debt_id, creditor, amount, capital_amount, interest_amount, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, is_paid, notes`,
    [debt_id || null, creditor, parsedAmount, parsedCapital, parsedInterest, due_date, notes || ""]
  );

  res.json(rows[0]);
}));

// PUT /api/debts/payments/:paymentId/toggle-paid - ATOMIC SQL TRANSACTION to mark payment paid & update debt balance
router.put("/payments/:paymentId/toggle-paid", asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const { is_paid } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const payRes = await client.query("SELECT * FROM debt_payments WHERE id = $1 FOR UPDATE", [paymentId]);
    if (payRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Nie znaleziono płatności" });
    }

    const currentPayment = payRes.rows[0];
    const previousStatus = currentPayment.is_paid;
    const newStatus = is_paid !== undefined ? Boolean(is_paid) : !previousStatus;

    if (previousStatus !== newStatus) {
      const capitalPaydown = parseAmount(currentPayment.capital_amount) || parseAmount(currentPayment.amount);

      // If checking paid -> reduce total debt balance of creditor
      // If unchecking -> add capital back
      const delta = newStatus ? -capitalPaydown : capitalPaydown;

      if (currentPayment.debt_id) {
        await client.query(
          "UPDATE debts SET total_amount = GREATEST(0, total_amount + $1), is_paid_this_month = $2, last_paid_date = $3, updated_at = NOW() WHERE id = $4",
          [delta, newStatus, newStatus ? new Date() : null, currentPayment.debt_id]
        );
      } else {
        await client.query(
          "UPDATE debts SET total_amount = GREATEST(0, total_amount + $1), is_paid_this_month = $2, last_paid_date = $3, updated_at = NOW() WHERE LOWER(creditor) = LOWER($4)",
          [delta, newStatus, newStatus ? new Date() : null, currentPayment.creditor]
        );
      }

      await client.query(
        "UPDATE debt_payments SET is_paid = $1, paid_at = $2 WHERE id = $3",
        [newStatus, newStatus ? new Date() : null, paymentId]
      );

      // Auto-record snapshot in same transaction!
      await recordAutoSnapshot(client);
    }

    await client.query("COMMIT");

    const updated = await pool.query(
      "SELECT id, debt_id, creditor, amount, capital_amount, interest_amount, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, is_paid, paid_at, notes FROM debt_payments WHERE id = $1",
      [paymentId]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Transaction Error] Payment toggle paid failed:", err);
    res.status(500).json({ error: "Błąd podczas aktualizacji płatności" });
  } finally {
    client.release();
  }
}));

/* =========================================================================
   FIXED EXPENSES (Płatności Stałe: T-Mobile, Księgowa, Subskrypcje)
   ========================================================================= */

// GET /api/debts/fixed-expenses
router.get("/fixed-expenses", asyncHandler(async (req, res) => {
  await ensureMonthlyInstallmentsAndResets(pool);
  const { rows } = await pool.query("SELECT * FROM fixed_expenses ORDER BY due_day ASC, name ASC");
  const total = rows.filter(r => r.is_active).reduce((sum, r) => sum + parseAmount(r.amount), 0);
  res.json({ expenses: rows, total_monthly: total });
}));

// POST /api/debts/fixed-expenses
router.post("/fixed-expenses", asyncHandler(async (req, res) => {
  const { name, amount, due_day, category, notes } = req.body;
  if (!name || amount === undefined) {
    return res.status(400).json({ error: "Podaj nazwę i kwotę płatności stałej" });
  }

  const { rows } = await pool.query(
    `INSERT INTO fixed_expenses (name, amount, due_day, category, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, parseAmount(amount), due_day || 10, category || "Stałe", notes || ""]
  );

  res.status(201).json(rows[0]);
}));

// PUT /api/debts/fixed-expenses/:id
router.put("/fixed-expenses/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, amount, due_day, category, is_active, notes } = req.body;

  const { rows } = await pool.query(
    `UPDATE fixed_expenses
     SET name = $1, amount = $2, due_day = $3, category = $4, is_active = $5, notes = $6
     WHERE id = $7
     RETURNING *`,
    [name, parseAmount(amount), due_day || 10, category || "Stałe", is_active !== undefined ? Boolean(is_active) : true, notes || "", id]
  );

  if (rows.length === 0) return res.status(404).json({ error: "Brak wpisu" });
  res.json(rows[0]);
}));

// PUT /api/debts/fixed-expenses/:id/toggle-paid
router.put("/fixed-expenses/:id/toggle-paid", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { is_paid } = req.body;

  let query = "";
  let params = [];

  if (is_paid !== undefined) {
    const paidVal = Boolean(is_paid);
    query = `UPDATE fixed_expenses SET is_paid_this_month = $1, last_paid_date = ${paidVal ? 'NOW()' : 'last_paid_date'} WHERE id = $2 RETURNING *`;
    params = [paidVal, id];
  } else {
    query = `UPDATE fixed_expenses SET is_paid_this_month = NOT COALESCE(is_paid_this_month, false), last_paid_date = CASE WHEN NOT COALESCE(is_paid_this_month, false) THEN NOW() ELSE last_paid_date END WHERE id = $1 RETURNING *`;
    params = [id];
  }

  const { rows } = await pool.query(query, params);
  if (rows.length === 0) return res.status(404).json({ error: "Brak wpisu" });
  res.json(rows[0]);
}));

// DELETE /api/debts/fixed-expenses/:id
router.delete("/fixed-expenses/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query("DELETE FROM fixed_expenses WHERE id = $1 RETURNING *", [id]);
  if (rows.length === 0) return res.status(404).json({ error: "Brak wpisu" });
  res.json({ message: "Usunięto płatność stałą" });
}));

/* =========================================================================
   FIXED INCOMES (Stałe Wpływy / Przychody Miesięczne)
   ========================================================================= */

// GET /api/debts/fixed-incomes
router.get("/fixed-incomes", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, amount, due_day, category, is_active, notes FROM fixed_incomes ORDER BY id ASC"
  );
  const totalMonthlyIncome = rows.filter(r => r.is_active).reduce((sum, r) => sum + parseAmount(r.amount), 0);
  res.json({ incomes: rows, total_monthly_income: totalMonthlyIncome });
}));

// POST /api/debts/fixed-incomes
router.post("/fixed-incomes", asyncHandler(async (req, res) => {
  const { name, amount, due_day, category, notes } = req.body;
  if (!name || amount === undefined) {
    return res.status(400).json({ error: "Podaj nazwę i kwotę wpływu stałego" });
  }

  const { rows } = await pool.query(
    `INSERT INTO fixed_incomes (name, amount, due_day, category, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, parseAmount(amount), due_day || 1, category || "Stały przychód", notes || ""]
  );

  res.status(201).json(rows[0]);
}));

// PUT /api/debts/fixed-incomes/:id
router.put("/fixed-incomes/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, amount, due_day, category, is_active, notes } = req.body;

  const { rows } = await pool.query(
    `UPDATE fixed_incomes
     SET name = $1, amount = $2, due_day = $3, category = $4, is_active = $5, notes = $6
     WHERE id = $7
     RETURNING *`,
    [name, parseAmount(amount), due_day || 1, category || "Stały przychód", is_active !== undefined ? Boolean(is_active) : true, notes || "", id]
  );

  if (rows.length === 0) return res.status(404).json({ error: "Brak wpisu" });
  res.json(rows[0]);
}));

// DELETE /api/debts/fixed-incomes/:id
router.delete("/fixed-incomes/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query("DELETE FROM fixed_incomes WHERE id = $1 RETURNING *", [id]);
  if (rows.length === 0) return res.status(404).json({ error: "Brak wpisu" });
  res.json({ message: "Usunięto wpływ stały" });
}));

/* =========================================================================
   PENDING BILLS (Do Zapłaty / Faktury i Rachunki)
   ========================================================================= */

// GET /api/debts/pending-bills
router.get("/pending-bills", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, title, amount, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, invoice_number, is_paid, paid_at, category, notes FROM pending_bills ORDER BY is_paid ASC, due_date ASC"
  );
  const unpaidTotal = rows.filter(r => !r.is_paid).reduce((sum, r) => sum + parseAmount(r.amount), 0);
  res.json({ bills: rows, unpaid_total: unpaidTotal });
}));

// POST /api/debts/pending-bills
router.post("/pending-bills", asyncHandler(async (req, res) => {
  const { title, amount, due_date, invoice_number, category, notes } = req.body;
  if (!title || !amount || !due_date) {
    return res.status(400).json({ error: "Podaj tytuł, kwotę i termin płatności" });
  }

  const { rows } = await pool.query(
    `INSERT INTO pending_bills (title, amount, due_date, invoice_number, category, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, amount, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, invoice_number, is_paid, category, notes`,
    [title, parseAmount(amount), due_date, invoice_number || "", category || "Inne", notes || ""]
  );

  res.status(201).json(rows[0]);
}));

// PUT /api/debts/pending-bills/:id/toggle-paid
router.put("/pending-bills/:id/toggle-paid", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { is_paid } = req.body;

  const current = await pool.query("SELECT is_paid FROM pending_bills WHERE id = $1", [id]);
  if (current.rows.length === 0) return res.status(404).json({ error: "Nie znaleziono rachunku" });

  const newStatus = is_paid !== undefined ? Boolean(is_paid) : !current.rows[0].is_paid;

  const { rows } = await pool.query(
    `UPDATE pending_bills SET is_paid = $1, paid_at = $2 WHERE id = $3
     RETURNING id, title, amount, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, invoice_number, is_paid, paid_at, category, notes`,
    [newStatus, newStatus ? new Date() : null, id]
  );

  res.json(rows[0]);
}));

// PUT /api/debts/pending-bills/:id - Update pending bill details
router.put("/pending-bills/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, amount, due_date, invoice_number, category, is_paid, notes } = req.body;

  const { rows } = await pool.query(
    `UPDATE pending_bills
     SET title = $1, amount = $2, due_date = $3, invoice_number = $4, category = $5, is_paid = $6, notes = $7
     WHERE id = $8
     RETURNING id, title, amount, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, invoice_number, is_paid, category, notes`,
    [title, parseAmount(amount), due_date, invoice_number || "", category || "Inne", is_paid !== undefined ? Boolean(is_paid) : false, notes || "", id]
  );

  if (rows.length === 0) return res.status(404).json({ error: "Brak wpisu" });
  res.json(rows[0]);
}));

// DELETE /api/debts/pending-bills/:id
router.delete("/pending-bills/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query("DELETE FROM pending_bills WHERE id = $1 RETURNING *", [id]);
  if (rows.length === 0) return res.status(404).json({ error: "Brak wpisu" });
  res.json({ message: "Usunięto rachunek" });
}));

/* =========================================================================
   DEBT SCHEDULES (Harmonogram Spłat: 42 Raty Smartney i inne)
   ========================================================================= */

// Helper to recalculate debt summary from schedule
async function syncDebtWithSchedule(clientOrPool, debtId) {
  try {
    const schedRes = await clientOrPool.query(
      "SELECT * FROM debt_schedules WHERE debt_id = $1 ORDER BY installment_number ASC",
      [debtId]
    );
    if (schedRes.rows.length === 0) return;

    const unpaidItems = schedRes.rows.filter(s => !s.is_paid);
    const totalUnpaidCapital = unpaidItems.reduce((sum, s) => sum + parseAmount(s.capital_part), 0);

    const firstUnpaid = unpaidItems[0] || schedRes.rows[0];
    const nextMonthly = parseAmount(firstUnpaid.total_installment);
    const nextCapital = parseAmount(firstUnpaid.capital_part);
    const nextInterest = parseAmount(firstUnpaid.interest_part);

    await clientOrPool.query(
      `UPDATE debts 
       SET total_amount = $1,
           monthly_installment = CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE monthly_installment END,
           capital_installment = CASE WHEN $3::numeric > 0 THEN $3::numeric ELSE capital_installment END,
           interest_installment = CASE WHEN $4::numeric > 0 THEN $4::numeric ELSE interest_installment END,
           updated_at = NOW()
       WHERE id = $5`,
      [totalUnpaidCapital > 0 ? totalUnpaidCapital : parseAmount(schedRes.rows[schedRes.rows.length - 1].remaining_balance), nextMonthly, nextCapital, nextInterest, debtId]
    );
  } catch (err) {
    console.error("[Sync Debt With Schedule Error]", err);
  }
}

// GET /api/debts/:debtId/schedule & /api/debts/schedule/:debtId
router.get(["/schedule/:debtId", "/:debtId/schedule"], asyncHandler(async (req, res) => {
  const { debtId } = req.params;
  const { rows } = await pool.query(
    "SELECT id, debt_id, installment_number, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, total_installment, capital_part, interest_part, remaining_balance, is_paid, paid_at FROM debt_schedules WHERE debt_id = $1 ORDER BY installment_number ASC",
    [debtId]
  );
  res.json({ schedule: rows });
}));

// POST /api/debts/:debtId/schedule/import - Bulk import schedule items (replaces or appends)
router.post("/:debtId/schedule/import", asyncHandler(async (req, res) => {
  const { debtId } = req.params;
  const { items, replace_existing } = req.body; // items: Array of { installment_number, due_date, total_installment, capital_part, interest_part, remaining_balance, is_paid }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Brak pozycji w harmonogramie do zaimportowania" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (replace_existing !== false) {
      await client.query("DELETE FROM debt_schedules WHERE debt_id = $1", [debtId]);
    }

    let insertedCount = 0;
    for (const item of items) {
      const num = parseInt(item.installment_number, 10) || (insertedCount + 1);
      const dueDate = item.due_date ? String(item.due_date).trim() : new Date().toISOString().split('T')[0];
      const total = parseAmount(item.total_installment);
      const cap = parseAmount(item.capital_part) || total;
      const intVal = parseAmount(item.interest_part);
      const rem = parseAmount(item.remaining_balance);
      const isPaid = Boolean(item.is_paid);

      await client.query(
        `INSERT INTO debt_schedules (debt_id, installment_number, due_date, total_installment, capital_part, interest_part, remaining_balance, is_paid, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [debtId, num, dueDate, total, cap, intVal, rem, isPaid, isPaid ? new Date() : null]
      );
      insertedCount++;
    }

    await syncDebtWithSchedule(client, debtId);
    await recordAutoSnapshot(client);

    await client.query("COMMIT");

    const fetchSched = await pool.query(
      "SELECT id, debt_id, installment_number, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, total_installment, capital_part, interest_part, remaining_balance, is_paid, paid_at FROM debt_schedules WHERE debt_id = $1 ORDER BY installment_number ASC",
      [debtId]
    );

    res.status(201).json({ message: `Zaimportowano ${insertedCount} rat harmonogramu`, schedule: fetchSched.rows });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Schedule Import Error]", err);
    res.status(500).json({ error: "Błąd podczas importu harmonogramu" });
  } finally {
    client.release();
  }
}));

// POST /api/debts/:debtId/schedule/item - Add single new schedule item
router.post("/:debtId/schedule/item", asyncHandler(async (req, res) => {
  const { debtId } = req.params;
  const { installment_number, due_date, total_installment, capital_part, interest_part, remaining_balance, is_paid } = req.body;

  if (!due_date || total_installment === undefined) {
    return res.status(400).json({ error: "Podaj datę płatności i kwotę raty" });
  }

  const num = parseInt(installment_number, 10) || 1;
  const total = parseAmount(total_installment);
  const cap = parseAmount(capital_part) || total;
  const intVal = parseAmount(interest_part);
  const rem = parseAmount(remaining_balance);
  const isPaid = Boolean(is_paid);

  const { rows } = await pool.query(
    `INSERT INTO debt_schedules (debt_id, installment_number, due_date, total_installment, capital_part, interest_part, remaining_balance, is_paid, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, debt_id, installment_number, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, total_installment, capital_part, interest_part, remaining_balance, is_paid, paid_at`,
    [debtId, num, due_date, total, cap, intVal, rem, isPaid, isPaid ? new Date() : null]
  );

  await syncDebtWithSchedule(pool, debtId);

  res.status(201).json(rows[0]);
}));

// PUT /api/debts/schedule/item/:scheduleId - Update single schedule item
router.put("/schedule/item/:scheduleId", asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;
  const { installment_number, due_date, total_installment, capital_part, interest_part, remaining_balance, is_paid } = req.body;

  const current = await pool.query("SELECT debt_id FROM debt_schedules WHERE id = $1", [scheduleId]);
  if (current.rows.length === 0) return res.status(404).json({ error: "Brak wpisu raty w harmonogramie" });

  const debtId = current.rows[0].debt_id;
  const total = parseAmount(total_installment);
  const cap = parseAmount(capital_part) || total;
  const intVal = parseAmount(interest_part);
  const rem = parseAmount(remaining_balance);

  const { rows } = await pool.query(
    `UPDATE debt_schedules
     SET installment_number = $1,
         due_date = $2,
         total_installment = $3,
         capital_part = $4,
         interest_part = $5,
         remaining_balance = $6,
         is_paid = $7,
         paid_at = CASE WHEN $7 THEN COALESCE(paid_at, NOW()) ELSE NULL END
     WHERE id = $8
     RETURNING id, debt_id, installment_number, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, total_installment, capital_part, interest_part, remaining_balance, is_paid, paid_at`,
    [parseInt(installment_number, 10) || 1, due_date, total, cap, intVal, rem, Boolean(is_paid), scheduleId]
  );

  await syncDebtWithSchedule(pool, debtId);

  res.json(rows[0]);
}));

// DELETE /api/debts/schedule/item/:scheduleId - Delete a single schedule item
router.delete("/schedule/item/:scheduleId", asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;
  const current = await pool.query("SELECT debt_id FROM debt_schedules WHERE id = $1", [scheduleId]);
  if (current.rows.length === 0) return res.status(404).json({ error: "Brak wpisu" });

  const debtId = current.rows[0].debt_id;
  await pool.query("DELETE FROM debt_schedules WHERE id = $1", [scheduleId]);

  await syncDebtWithSchedule(pool, debtId);

  res.json({ message: "Usunięto ratę z harmonogramu" });
}));

// DELETE /api/debts/:debtId/schedule - Clear full schedule for a debt
router.delete("/:debtId/schedule", asyncHandler(async (req, res) => {
  const { debtId } = req.params;
  await pool.query("DELETE FROM debt_schedules WHERE debt_id = $1", [debtId]);
  res.json({ message: "Wyczyszczono harmonogram spłat" });
}));

async function handleToggleScheduleItem(scheduleId, res) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const schedRes = await client.query("SELECT * FROM debt_schedules WHERE id = $1 FOR UPDATE", [scheduleId]);
    if (schedRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Brak wpisu w harmonogramie" });
    }

    const item = schedRes.rows[0];
    const newPaidStatus = !item.is_paid;

    const debtRes = await client.query("SELECT * FROM debts WHERE id = $1 FOR UPDATE", [item.debt_id]);
    if (debtRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Nie znaleziono nadrzędnego długu" });
    }

    const debt = debtRes.rows[0];
    const capitalPart = parseAmount(item.capital_part);
    const interestPart = parseAmount(item.interest_part);

    let newTotal = parseAmount(debt.total_amount);
    if (newPaidStatus) {
      newTotal = Math.max(0, newTotal - capitalPart);
    } else {
      newTotal = newTotal + capitalPart;
    }

    const updatedSched = await client.query(
      "UPDATE debt_schedules SET is_paid = $1, paid_at = $2 WHERE id = $3 RETURNING id, debt_id, installment_number, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, total_installment, capital_part, interest_part, remaining_balance, is_paid, paid_at",
      [newPaidStatus, newPaidStatus ? new Date() : null, scheduleId]
    );

    const allSchedRes = await client.query(
      "SELECT * FROM debt_schedules WHERE debt_id = $1 ORDER BY installment_number ASC",
      [debt.id]
    );
    const currentMonthPrefix = new Date().toISOString().substring(0, 7);
    const hasPaidInCurrentMonth = allSchedRes.rows.some(s => s.is_paid && s.due_date && new Date(s.due_date).toISOString().substring(0, 7) === currentMonthPrefix);

    await client.query(
      `UPDATE debts 
       SET total_amount = $1, 
           is_paid_this_month = $2,
           capital_installment = CASE WHEN $3::numeric > 0 THEN $3::numeric ELSE capital_installment END,
           interest_installment = CASE WHEN $4::numeric > 0 THEN $4::numeric ELSE interest_installment END,
           updated_at = NOW() 
       WHERE id = $5`,
      [newTotal, hasPaidInCurrentMonth, capitalPart, interestPart, debt.id]
    );

    if (newPaidStatus) {
      await client.query(
        `INSERT INTO debt_payments (debt_id, creditor, amount, capital_amount, interest_amount, due_date, is_paid, paid_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), $7)`,
        [
          debt.id,
          debt.creditor,
          parseAmount(item.total_installment),
          capitalPart,
          interestPart,
          item.due_date,
          `Rata nr ${item.installment_number} odznaczona z harmonogramu spłat (spłata kapitału)`
        ]
      );
    }

    await recordAutoSnapshot(client);
    await client.query("COMMIT");

    res.json(updatedSched.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Schedule Toggle Paid Error]", err);
    res.status(500).json({ error: "Błąd aktualizacji raty z harmonogramu" });
  } finally {
    client.release();
  }
}

// PUT /api/debts/schedule/item/:scheduleId/toggle-paid - Toggle paid status for schedule item & update debt balance
router.put("/schedule/item/:scheduleId/toggle-paid", asyncHandler(async (req, res) => {
  await handleToggleScheduleItem(req.params.scheduleId, res);
}));

/* =========================================================================
   2. PARAMETERIZED ROUTES (GET, POST, PUT, DELETE /api/debts)
   ========================================================================= */

// GET /api/debts - Fetch list of debts and calculate aggregate sums
router.get("/", asyncHandler(async (req, res) => {
  await ensureMonthlyInstallmentsAndResets(pool);
  const debtsRes = await pool.query(`
    SELECT d.*,
      COALESCE((SELECT COUNT(*) FROM debt_schedules ds WHERE ds.debt_id = d.id), 0)::int as total_schedule_count,
      COALESCE((SELECT COUNT(*) FROM debt_schedules ds WHERE ds.debt_id = d.id AND ds.is_paid = false), 0)::int as unpaid_schedule_count
    FROM debts d
    ORDER BY d.total_amount DESC
  `);
  const debts = debtsRes.rows;

  const totalDebt = debts.reduce((sum, d) => sum + parseAmount(d.total_amount), 0);
  const totalInstallments = debts.reduce((sum, d) => sum + parseAmount(d.monthly_installment), 0);

  res.json({
    debts,
    summary: {
      total_debt: totalDebt,
      total_installments: totalInstallments
    }
  });
}));

// POST /api/debts - Add new debt
router.post("/", asyncHandler(async (req, res) => {
  const { creditor, total_amount, monthly_installment, capital_installment, interest_installment, due_day, interest_notes, notes } = req.body;
  if (!creditor) {
    return res.status(400).json({ error: "Nazwa wierzyciela jest wymagana" });
  }

  const parsedTotal = parseAmount(total_amount);
  const parsedInstallment = parseAmount(monthly_installment);
  const parsedInterest = parseAmount(interest_installment);
  let parsedCapital = parseAmount(capital_installment);

  if (parsedInstallment > 0 && parsedCapital === 0) {
    parsedCapital = Math.max(0, parsedInstallment - parsedInterest);
  }

  const parsedDueDay = (due_day !== "" && due_day !== null && due_day !== undefined && parseInt(due_day, 10) > 0) 
    ? parseInt(due_day, 10) 
    : null;

  const { rows } = await pool.query(
    `INSERT INTO debts (creditor, total_amount, monthly_installment, capital_installment, interest_installment, due_day, interest_notes, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [creditor, parsedTotal, parsedInstallment, parsedCapital, parsedInterest, parsedDueDay, interest_notes || "", notes || ""]
  );

  await recordAutoSnapshot(pool);

  res.status(201).json(rows[0]);
}));

// PUT /api/debts/:id/toggle-monthly-paid - Toggle monthly installment paid status & decrement capital debt balance
router.put("/:id/toggle-monthly-paid", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const debtRes = await client.query("SELECT * FROM debts WHERE id = $1 FOR UPDATE", [id]);
    if (debtRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Brak wpisu zobowiązania" });
    }

    const debt = debtRes.rows[0];
    const isCurrentlyPaid = Boolean(debt.is_paid_this_month);
    const newPaidStatus = !isCurrentlyPaid;

    const schedRes = await client.query(
      "SELECT * FROM debt_schedules WHERE debt_id = $1 ORDER BY installment_number ASC FOR UPDATE",
      [id]
    );

    let capitalDelta = 0;
    let interestDelta = 0;

    if (schedRes.rows.length > 0) {
      if (newPaidStatus) {
        const unpaidItem = schedRes.rows.find(s => !s.is_paid);
        if (unpaidItem) {
          capitalDelta = parseAmount(unpaidItem.capital_part);
          interestDelta = parseAmount(unpaidItem.interest_part);
          await client.query(
            "UPDATE debt_schedules SET is_paid = true, paid_at = NOW() WHERE id = $1",
            [unpaidItem.id]
          );
        } else {
          capitalDelta = parseAmount(debt.capital_installment) > 0 ? parseAmount(debt.capital_installment) : parseAmount(debt.monthly_installment);
          interestDelta = parseAmount(debt.interest_installment);
        }
      } else {
        const paidItems = schedRes.rows.filter(s => s.is_paid);
        const lastPaidItem = paidItems[paidItems.length - 1];
        if (lastPaidItem) {
          capitalDelta = parseAmount(lastPaidItem.capital_part);
          interestDelta = parseAmount(lastPaidItem.interest_part);
          await client.query(
            "UPDATE debt_schedules SET is_paid = false, paid_at = NULL WHERE id = $1",
            [lastPaidItem.id]
          );
        } else {
          capitalDelta = parseAmount(debt.capital_installment) > 0 ? parseAmount(debt.capital_installment) : parseAmount(debt.monthly_installment);
          interestDelta = parseAmount(debt.interest_installment);
        }
      }
    } else {
      const parsedMonthly = parseAmount(debt.monthly_installment);
      const parsedInterest = parseAmount(debt.interest_installment);
      const parsedCapital = parseAmount(debt.capital_installment);

      if (parsedCapital > 0) {
        capitalDelta = parsedCapital;
      } else if (parsedMonthly > 0) {
        capitalDelta = Math.max(0, parsedMonthly - parsedInterest);
      } else {
        capitalDelta = 0;
      }
      interestDelta = parsedInterest;
    }

    let newTotal = parseAmount(debt.total_amount);
    if (newPaidStatus) {
      newTotal = Math.max(0, newTotal - capitalDelta);
    } else {
      newTotal = newTotal + capitalDelta;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const updatedRes = await client.query(
      `UPDATE debts 
       SET total_amount = $1, 
           is_paid_this_month = $2, 
           capital_installment = CASE WHEN $5::numeric > 0 THEN $5::numeric ELSE capital_installment END,
           interest_installment = CASE WHEN $6::numeric > 0 THEN $6::numeric ELSE interest_installment END,
           last_paid_date = $3, 
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newTotal, newPaidStatus, newPaidStatus ? todayStr : null, id, capitalDelta, interestDelta]
    );

    // Record/Update debt_payments entry without creating duplicates
    const currentMonthPrefix = todayStr.substring(0, 7); // 'YYYY-MM'
    const existingPayment = await client.query(
      `SELECT id FROM debt_payments 
       WHERE (debt_id = $1 OR LOWER(creditor) = LOWER($2)) AND TO_CHAR(due_date, 'YYYY-MM') = $3 
       LIMIT 1`,
      [debt.id, debt.creditor, currentMonthPrefix]
    );

    if (newPaidStatus) {
      if (existingPayment.rows.length > 0) {
        await client.query(
          "UPDATE debt_payments SET is_paid = true, paid_at = NOW(), amount = $1, capital_amount = $2, interest_amount = $3 WHERE id = $4",
          [parseAmount(debt.monthly_installment), capitalDelta, interestDelta, existingPayment.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO debt_payments (debt_id, creditor, amount, capital_amount, interest_amount, due_date, is_paid, paid_at, notes)
           VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), 'Rata miesięczna odznaczona w wykazie (spłata kapitału)')`,
          [
            debt.id,
            debt.creditor,
            parseAmount(debt.monthly_installment),
            capitalDelta,
            interestDelta,
            todayStr
          ]
        );
      }
    } else {
      if (existingPayment.rows.length > 0) {
        await client.query(
          "UPDATE debt_payments SET is_paid = false, paid_at = NULL WHERE id = $1",
          [existingPayment.rows[0].id]
        );
      }
    }

    await recordAutoSnapshot(client);
    await client.query("COMMIT");

    res.json(updatedRes.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Toggle Monthly Paid Error]", err);
    res.status(500).json({ error: "Błąd podczas aktualizacji raty długu" });
  } finally {
    client.release();
  }
}));

// PUT /api/debts/:id - Update existing debt balance or details
router.put("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { creditor, total_amount, monthly_installment, capital_installment, interest_installment, due_day, interest_notes, notes } = req.body;

  const parsedTotal = parseAmount(total_amount);
  const parsedInstallment = parseAmount(monthly_installment);
  const parsedInterest = parseAmount(interest_installment);
  let parsedCapital = parseAmount(capital_installment);

  if (parsedInstallment > 0 && parsedCapital === 0) {
    parsedCapital = Math.max(0, parsedInstallment - parsedInterest);
  }

  const parsedDueDay = (due_day !== "" && due_day !== null && due_day !== undefined && parseInt(due_day, 10) > 0) 
    ? parseInt(due_day, 10) 
    : null;

  const { rows } = await pool.query(
    `UPDATE debts 
     SET creditor = $1, total_amount = $2, monthly_installment = $3, capital_installment = $4, interest_installment = $5, due_day = $6, interest_notes = $7, notes = $8, updated_at = NOW()
     WHERE id = $9
     RETURNING *`,
    [creditor, parsedTotal, parsedInstallment, parsedCapital, parsedInterest, parsedDueDay, interest_notes || "", notes || "", id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "Nie znaleziono takiego zobowiązania" });
  }

  await recordAutoSnapshot(pool);

  res.json(rows[0]);
}));

// DELETE /api/debts/:id - Delete a debt item
router.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query("DELETE FROM debts WHERE id = $1 RETURNING *", [id]);

  if (rows.length === 0) {
    return res.status(404).json({ error: "Nie znaleziono wpisu" });
  }

  await recordAutoSnapshot(pool);

  res.json({ message: "Zobowiązanie zostało usunięte" });
}));

// GET /api/debts/:id/schedule
router.get("/:id/schedule", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(
    "SELECT id, debt_id, installment_number, TO_CHAR(due_date, 'YYYY-MM-DD') as due_date, total_installment, capital_part, interest_part, remaining_balance, is_paid FROM debt_schedules WHERE debt_id = $1 ORDER BY installment_number ASC",
    [id]
  );
  res.json({ schedule: rows });
}));

// PUT /api/debts/schedule/:scheduleId/toggle-paid
router.put("/schedule/:scheduleId/toggle-paid", asyncHandler(async (req, res) => {
  await handleToggleScheduleItem(req.params.scheduleId, res);
}));

module.exports = router;
