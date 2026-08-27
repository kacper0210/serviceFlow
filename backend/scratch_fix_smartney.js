const pool = require('./db');

async function fixSchedule() {
  const smartneyRes = await pool.query("SELECT id FROM debts WHERE id = 7");
  if (smartneyRes.rows.length === 0) return;
  const debtId = smartneyRes.rows[0].id;

  await pool.query('DELETE FROM debt_schedules WHERE debt_id = $1', [debtId]);

  const rawData = [
    { num: 1, date: '2026-08-28', total: 615.56, cap: 243.90 },
    { num: 2, date: '2026-09-28', total: 615.56, cap: 276.70 },
    { num: 3, date: '2026-10-28', total: 615.56, cap: 285.86 },
    { num: 4, date: '2026-11-28', total: 615.56, cap: 283.63 },
    { num: 5, date: '2026-12-28', total: 615.56, cap: 292.64 },
    { num: 6, date: '2027-01-28', total: 615.56, cap: 290.72 },
    { num: 7, date: '2027-02-28', total: 615.56, cap: 294.30 },
    { num: 8, date: '2027-03-28', total: 615.56, cap: 313.46 },
    { num: 9, date: '2027-04-28', total: 615.56, cap: 301.79 },
    { num: 10, date: '2027-05-28', total: 615.56, cap: 310.44 },
    { num: 11, date: '2027-06-28', total: 615.56, cap: 309.33 },
    { num: 12, date: '2027-07-28', total: 615.56, cap: 317.82 },
    { num: 13, date: '2027-08-28', total: 615.56, cap: 317.05 },
    { num: 14, date: '2027-09-28', total: 615.56, cap: 320.95 },
    { num: 15, date: '2027-10-28', total: 615.56, cap: 329.21 },
    { num: 16, date: '2027-11-28', total: 615.56, cap: 328.96 },
    { num: 17, date: '2027-12-28', total: 615.56, cap: 337.06 },
    { num: 18, date: '2028-01-28', total: 615.56, cap: 337.16 },
    { num: 19, date: '2028-02-28', total: 615.56, cap: 341.32 },
    { num: 20, date: '2028-03-28', total: 615.56, cap: 352.80 },
    { num: 21, date: '2028-04-28', total: 615.56, cap: 349.86 },
    { num: 22, date: '2028-05-28', total: 615.56, cap: 357.54 },
    { num: 23, date: '2028-06-28', total: 615.56, cap: 358.58 },
    { num: 24, date: '2028-07-28', total: 615.56, cap: 366.07 },
    { num: 25, date: '2028-08-28', total: 615.56, cap: 367.50 },
    { num: 26, date: '2028-09-28', total: 615.56, cap: 372.03 },
    { num: 27, date: '2028-10-28', total: 615.56, cap: 379.25 },
    { num: 28, date: '2028-11-28', total: 615.56, cap: 381.28 },
    { num: 29, date: '2028-12-28', total: 615.56, cap: 388.31 },
    { num: 30, date: '2029-01-28', total: 615.56, cap: 390.76 },
    { num: 31, date: '2029-02-28', total: 615.56, cap: 395.57 },
    { num: 32, date: '2029-03-28', total: 615.56, cap: 406.05 },
    { num: 33, date: '2029-04-28', total: 615.56, cap: 405.44 },
    { num: 34, date: '2029-05-28', total: 615.56, cap: 411.98 },
    { num: 35, date: '2029-06-28', total: 615.56, cap: 415.51 },
    { num: 36, date: '2029-07-28', total: 615.56, cap: 421.84 },
    { num: 37, date: '2029-08-28', total: 615.56, cap: 425.82 },
    { num: 38, date: '2029-09-28', total: 615.56, cap: 431.06 },
    { num: 39, date: '2029-10-28', total: 615.56, cap: 437.08 },
    { num: 40, date: '2029-11-28', total: 615.56, cap: 441.75 },
    { num: 41, date: '2029-12-28', total: 615.56, cap: 447.56 },
    { num: 42, date: '2030-01-28', total: 627.03, cap: 464.06 }
  ];

  let currentBal = 15000.00;
  for (const r of rawData) {
    currentBal = Math.max(0, parseFloat((currentBal - r.cap).toFixed(2)));
    const costs = parseFloat((r.total - r.cap).toFixed(2));
    await pool.query(
      `INSERT INTO debt_schedules (debt_id, installment_number, due_date, total_installment, capital_part, interest_part, remaining_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [debtId, r.num, r.date, r.total, r.cap, costs, currentBal]
    );
  }

  await pool.query(
    'UPDATE debts SET total_amount = 15000.00, monthly_installment = 615.56, capital_installment = 243.90, interest_installment = 371.66, due_day = 28 WHERE id = $1',
    [debtId]
  );
  console.log('Smartney schedule updated with pure capital repayment starting from 15000.00 PLN!');
  process.exit(0);
}

fixSchedule();
