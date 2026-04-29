const pool = require("./db");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());

// Root route to confirm server status
app.get("/", (req, res) => {
  res.send("Serwer ServiceFlow działa poprawnie! Korzystaj z endpointów /api.");
});

// Health check for cloud services
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const sessions = new Map();

const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

async function dynamicUpdate(table, id, data, allowedFields) {
  const fields = Object.keys(data).filter(k => allowedFields.includes(k) && data[k] !== undefined);
  if (fields.length === 0) return null;

  const setClause = fields.map((col, idx) => `${col} = $${idx + 1}`).join(", ");
  const values = fields.map(col => {
    let val = data[col];
    // Convert empty strings to null for better DB compatibility (e.g. numeric/date columns)
    if (val === "") return null;
    return val;
  });

  const query = `UPDATE ${table} SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
  const result = await pool.query(query, [...values, id]);
  return result.rows[0];
}


const checkAuth = (req, res, next) => {
  const token = req.headers["authorization"]?.replace("Bearer ", "");
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Brak autoryzacji" });
  }
  req.user = sessions.get(token);
  req.token = token;
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Brak uprawnień administratora" });
  }
  next();
};


app.post("/api/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Brak danych" });

  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1 AND is_active = true", [email]);
  const user = rows[0];

  const validPassword = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !validPassword) {
    return res.status(401).json({ error: "Błędne dane" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const userData = { id: user.id, email: user.email, role: user.role };
  sessions.set(token, userData);

  res.json({ token, user: userData });
}));

app.post("/api/logout", checkAuth, (req, res) => {
  sessions.delete(req.token);
  res.json({ message: "Wylogowano" });
});

app.get("/api/db-test", asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT NOW()");
  res.json({ now: rows[0].now });
}));

app.get("/api/me", checkAuth, (req, res) => {
  res.json(req.user);
});


app.get("/api/users", checkAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT id, email, role, is_active FROM users ORDER BY id ASC");
  res.json(rows);
}));

app.post("/api/users", checkAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { email, password, role = "user", is_active = true } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    "INSERT INTO users (email, password_hash, role, is_active) VALUES ($1, $2, $3, $4) RETURNING id, email, role, is_active",
    [email, hashedPassword, role, !!is_active]
  );
  res.status(201).json(rows[0]);
}));

app.put("/api/users/:id", checkAuth, requireAdmin, asyncHandler(async (req, res) => {
  if (req.body.password) {
    req.body.password_hash = await bcrypt.hash(req.body.password, 10);
  }
  const updated = await dynamicUpdate("users", req.params.id, req.body, ["email", "password_hash", "role", "is_active"]);
  if (!updated) return res.status(404).json({ error: "Nie znaleziono użytkownika" });
  res.json(updated);
}));

app.delete("/api/users/:id", checkAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: "Nie znaleziono" });
  res.json({ message: "Usunięto" });
}));


app.get("/api/clients", checkAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM clients ORDER BY id ASC");
  res.json(rows);
}));

app.get("/api/clients/:id", checkAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM clients WHERE id = $1", [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: "Nie znaleziono" });
  res.json(rows[0]);
}));

app.post("/api/clients", checkAuth, asyncHandler(async (req, res) => {
  const fields = ["first_name", "last_name", "phone", "email", "nip", "address", "type", "company_name"];
  const values = fields.map(k => req.body[k]);

  const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");

  const { rows } = await pool.query(
    `INSERT INTO clients (${fields.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  res.status(201).json(rows[0]);
}));

app.put("/api/clients/:id", checkAuth, asyncHandler(async (req, res) => {
  const allowed = ["first_name", "last_name", "phone", "email", "nip", "address", "type", "company_name"];
  const updated = await dynamicUpdate("clients", req.params.id, req.body, allowed);
  if (!updated) return res.status(404).json({ error: "Nie zaktualizowano" });
  res.json(updated);
}));

app.delete("/api/clients/:id", checkAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { force } = req.query;

  const ordersCheck = await pool.query("SELECT id FROM orders WHERE client_id = $1", [id]);

  if (ordersCheck.rows.length > 0) {
    if (force !== "true") {
      return res.status(400).json({ error: "Klient ma przypisane zlecenia", assignedOrders: ordersCheck.rows });
    }
    await pool.query("DELETE FROM orders WHERE client_id = $1", [id]);
  }

  const { rowCount } = await pool.query("DELETE FROM clients WHERE id = $1", [id]);
  if (rowCount === 0) return res.status(404).json({ error: "Nie znaleziono klienta" });
  res.json({ message: "Klient usunięty" });
}));


app.get("/api/orders", checkAuth, asyncHandler(async (req, res) => {
  const { status, search, sort, client, minPrice, maxPrice, dateFrom, dateTo } = req.query;

  let conditions = ["1=1"];
  let params = [];

  if (client) { params.push(client); conditions.push(`o.client_id = $${params.length}`); }
  if (minPrice) { params.push(minPrice); conditions.push(`o.price >= $${params.length}`); }
  if (maxPrice) { params.push(maxPrice); conditions.push(`o.price <= $${params.length}`); }
  if (dateFrom) { params.push(dateFrom); conditions.push(`o.deadline >= $${params.length}`); }
  if (dateTo) { params.push(dateTo); conditions.push(`o.deadline <= $${params.length}`); }

  if (status) {
    const sList = status.split(",").map(s => s.trim());
    params.push(sList);
    conditions.push(`o.status = ANY($${params.length})`);
  }

  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    conditions.push(`(o.title ILIKE $${idx} OR c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx})`);
  }

  const sortOptions = {
    deadline_asc: "o.deadline ASC", deadline_desc: "o.deadline DESC",
    price_asc: "o.price ASC", price_desc: "o.price DESC",
    newest: "o.created_at DESC", oldest: "o.created_at ASC"
  };
  const orderBy = sortOptions[sort] || "o.id ASC";

  const query = `
    SELECT 
      o.*, 
      c.first_name, 
      c.last_name, 
      c.email,
      COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
    FROM orders o 
    JOIN clients c ON o.client_id = c.id 
    WHERE ${conditions.join(" AND ")} 
    ORDER BY ${orderBy}
  `;

  const { rows } = await pool.query(query, params);
  res.json(rows);
}));

app.get("/api/orders/:id", checkAuth, asyncHandler(async (req, res) => {
  const query = `
    SELECT o.*, 
    COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
    FROM orders o 
    WHERE o.id = $1
  `;
  const { rows } = await pool.query(query, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: "Nie znaleziono" });
  res.json(rows[0]);
}));

app.get("/api/orders/:id/costs", checkAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM order_costs WHERE order_id = $1 ORDER BY created_at DESC", [req.params.id]);
  res.json(rows);
}));

app.post("/api/orders/:id/costs", checkAuth, asyncHandler(async (req, res) => {
  const { amount, title } = req.body;
  const { id } = req.params;

  if (!amount) return res.status(400).json({ error: "Kwota jest wymagana" });

  await pool.query(
    "INSERT INTO order_costs (order_id, amount, title) VALUES ($1, $2, $3)",
    [id, amount, title]
  );

  const { rows } = await pool.query(`
    SELECT o.*, 
    COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
    FROM orders o 
    WHERE o.id = $1
  `, [id]);

  res.json(rows[0]);
}));


app.post("/api/orders", checkAuth, asyncHandler(async (req, res) => {
  const fields = ["title", "description", "status", "price", "notes", "client_id", "deadline"];
  const sanitize = (val) => (val === "" || val === undefined || val === null) ? null : val;

  const values = fields.map(k => {
    let val = req.body[k];
    if (k === "status") return val || "nowe";
    if (k === "deadline" || k === "price") return sanitize(val);
    if (k === "client_id") return val ? parseInt(val) : null;
    return val;
  });
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");

  const { rows } = await pool.query(
    `INSERT INTO orders (${fields.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  res.status(201).json(rows[0]);
}));

app.put("/api/orders/:id", checkAuth, asyncHandler(async (req, res) => {
  const allowed = ["title", "description", "status", "deadline", "price", "notes", "client_id"];
  if (req.user.role === "admin") allowed.push("created_at");

  const updated = await dynamicUpdate("orders", req.params.id, req.body, allowed);
  if (!updated) return res.status(404).json({ error: "Nie zaktualizowano" });
  res.json(updated);
}));

app.delete("/api/orders/:id", checkAuth, asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM orders WHERE id = $1", [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: "Nie znaleziono" });
  res.json({ message: "Usunięto" });
}));

// --- ACCOUNTING MODULE ---

app.get("/api/accounting/entries", checkAuth, asyncHandler(async (req, res) => {
  const { type } = req.query;
  let query = "SELECT * FROM accounting_entries";
  let params = [];
  
  if (type) {
    query += " WHERE entry_type = $1";
    params.push(type);
  }
  
  query += " ORDER BY date DESC, id DESC";
  
  const { rows } = await pool.query(query, params);
  res.json(rows);
}));

app.post("/api/accounting/entries", checkAuth, asyncHandler(async (req, res) => {
  const fields = ["date", "number", "contractor", "description", "net_amount", "vat_rate", "vat_amount", "gross_amount", "category", "is_car_cost", "entry_type"];
  const values = fields.map(k => {
    if (k === "entry_type") return req.body[k] || "expense";
    return req.body[k];
  });
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");

  const { rows } = await pool.query(
    `INSERT INTO accounting_entries (${fields.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  res.status(201).json(rows[0]);
}));

app.delete("/api/accounting/entries/:id", checkAuth, asyncHandler(async (req, res) => {
  await pool.query("DELETE FROM accounting_entries WHERE id = $1", [req.params.id]);
  res.json({ message: "Usunięto wpis" });
}));

app.put("/api/accounting/entries/:id", checkAuth, asyncHandler(async (req, res) => {
  const allowed = ["date", "number", "contractor", "description", "net_amount", "vat_rate", "vat_amount", "gross_amount", "category", "is_car_cost", "entry_type", "is_ready"];
  const updated = await dynamicUpdate("accounting_entries", req.params.id, req.body, allowed);
  if (!updated) return res.status(404).json({ error: "Nie znaleziono" });
  res.json(updated);
}));



app.post("/api/accounting/settings", checkAuth, asyncHandler(async (req, res) => {
  const { year, month, carried_vat, manual_profit } = req.body;
  
  // We need to build the update query dynamically or just COALESCE
  // But wait, if we only send carried_vat, we shouldn't overwrite manual_profit with null if it's not provided, and vice versa.
  
  const existingRes = await pool.query("SELECT * FROM accounting_settings WHERE year = $1 AND month = $2", [year, month]);
  if (existingRes.rows.length > 0) {
    const existing = existingRes.rows[0];
    const newCarriedVat = carried_vat !== undefined ? carried_vat : existing.carried_vat;
    const newManualProfit = manual_profit !== undefined ? manual_profit : existing.manual_profit;
    await pool.query(
      "UPDATE accounting_settings SET carried_vat = $1, manual_profit = $2 WHERE year = $3 AND month = $4",
      [newCarriedVat, newManualProfit, year, month]
    );
  } else {
    await pool.query(
      "INSERT INTO accounting_settings (year, month, carried_vat, manual_profit) VALUES ($1, $2, $3, $4)",
      [year, month, carried_vat || 0, manual_profit || null]
    );
  }

  res.json({ success: true });
}));

app.get("/api/accounting/settings/all", checkAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT year, month, manual_profit FROM accounting_settings WHERE manual_profit IS NOT NULL");
  res.json(rows);
}));

app.get("/api/accounting/stats", checkAuth, asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  
  // Fetch carried VAT
  const settingsRes = await pool.query("SELECT carried_vat FROM accounting_settings WHERE year = $1 AND month = $2", [year, month]);
  const carriedVat = settingsRes.rows.length > 0 ? parseFloat(settingsRes.rows[0].carried_vat) : 0;

  
  // Get all manual entries for the period
  const { rows } = await pool.query(`
    SELECT * FROM accounting_entries 
    WHERE EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2
  `, [year, month]);

  let totalNetRevenue = 0;
  let totalGrossRevenue = 0;
  let totalVatOutput = 0;
  let totalNetExpenses = 0;
  let totalGrossExpenses = 0;
  let totalVatInput = 0;
  let kpirCosts = 0;

  rows.forEach(entry => {
    const net = parseFloat(entry.net_amount) || 0;
    const vat = parseFloat(entry.vat_amount) || 0;
    const gross = parseFloat(entry.gross_amount) || (net + vat);
    
    if (entry.entry_type === "revenue") {
      totalNetRevenue += net;
      totalGrossRevenue += gross;
      totalVatOutput += vat;
    } else {
      totalGrossExpenses += gross;
      if (entry.is_car_cost) {
        // Car rules: 50% VAT deductible, 75% of (Net + 50% VAT) as KPiR cost
        const deductibleVat = vat * 0.5;
        const nonDeductibleVat = vat * 0.5;
        totalVatInput += deductibleVat;
        kpirCosts += (net + nonDeductibleVat) * 0.75;
      } else {
        totalVatInput += vat;
        kpirCosts += net;
      }
      totalNetExpenses += net;
    }
  });

  // Tax Calculations (JDG + Etat)
  const income = totalNetRevenue - kpirCosts;
  const vatToPay = Math.max(0, totalVatOutput - totalVatInput - carriedVat);
  const nextMonthCarriedVat = Math.max(0, carriedVat + totalVatInput - totalVatOutput);
  
  // USTAWY DLA TWOJEJ SYTUACJI:
  // 1. Kwota wolna (30k) JEST JUŻ NA ETACIE -> nie odliczamy jej tutaj.
  // 2. Próg 120k (10k miesięcznie) jest wspólny.
  // 3. Masz ok. 7000 zł brutto z etatu, więc dla JDG zostaje 3000 zł w progu 12%.
  
  const ETAT_BRUTTO = 7000; 
  const MONTHLY_THRESHOLD = 10000;
  const available12PercentSpace = Math.max(0, MONTHLY_THRESHOLD - ETAT_BRUTTO);
  
  let estimatedPit = 0;
  if (income > 0) {
    const amountIn12Percent = Math.min(income, available12PercentSpace);
    const amountIn32Percent = Math.max(0, income - available12PercentSpace);
    
    estimatedPit = (amountIn12Percent * 0.12) + (amountIn32Percent * 0.32);
  }
  
  // ZUS Zdrowotna (Skala 9%): Zawsze 9% od dochodu, min. 432.54 zł
  const healthInsurance = income > 0 ? Math.max(432.54, income * 0.09) : 432.54;



  // Returning full calculation results
  res.json({


    period: { year, month },
    revenue: {
      net: Math.round(totalNetRevenue * 100) / 100,
      vat: Math.round(totalVatOutput * 100) / 100,
      gross: Math.round(totalGrossRevenue * 100) / 100
    },
    expenses: {
      net: Math.round(totalNetExpenses * 100) / 100,
      vat: Math.round(totalVatInput * 100) / 100,
      kpir: Math.round(kpirCosts * 100) / 100,
      gross: Math.round(totalGrossExpenses * 100) / 100
    },
    taxes: {
      vat: Math.round(vatToPay * 100) / 100,
      pit: Math.round(estimatedPit * 100) / 100,
      health: Math.round(healthInsurance * 100) / 100,
      income: Math.round(income * 100) / 100,
      carriedVat: carriedVat,
      nextMonthCarriedVat: Math.round(nextMonthCarriedVat * 100) / 100
    }
  });
}));



const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});