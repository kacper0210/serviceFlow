const express = require("express");
const pool = require("../db");
const { asyncHandler, checkAuth, dynamicUpdate, parseAmount } = require("../middleware/auth");

const router = express.Router();

// GET /api/orders
router.get("/", checkAuth, asyncHandler(async (req, res) => {
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
    conditions.push(`(o.title ILIKE $${idx} OR c.company_name ILIKE $${idx} OR c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx})`);
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
      c.type as client_type,
      c.company_name,
      c.first_name, 
      c.last_name, 
      c.email,
      c.phone,
      COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
    FROM orders o 
    LEFT JOIN clients c ON o.client_id = c.id 
    WHERE ${conditions.join(" AND ")} 
    ORDER BY ${orderBy}
  `;

  const { rows } = await pool.query(query, params);
  res.json(rows);
}));

// GET /api/orders/:id
router.get("/:id", checkAuth, asyncHandler(async (req, res) => {
  const query = `
    SELECT 
      o.*, 
      c.type as client_type,
      c.company_name,
      c.first_name, 
      c.last_name, 
      c.email,
      c.phone,
      COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
    FROM orders o 
    LEFT JOIN clients c ON o.client_id = c.id
    WHERE o.id = $1
  `;
  const { rows } = await pool.query(query, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: "Nie znaleziono" });
  res.json(rows[0]);
}));

// GET /api/orders/:id/costs
router.get("/:id/costs", checkAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM order_costs WHERE order_id = $1 ORDER BY created_at DESC", [req.params.id]);
  res.json(rows);
}));

// POST /api/orders/:id/costs
router.post("/:id/costs", checkAuth, asyncHandler(async (req, res) => {
  const { amount, title } = req.body;
  const { id } = req.params;

  const parsedAmount = parseAmount(amount);
  if (!amount || parsedAmount <= 0) return res.status(400).json({ error: "Poprawna kwota jest wymagana" });

  await pool.query(
    "INSERT INTO order_costs (order_id, amount, title) VALUES ($1, $2, $3)",
    [id, parsedAmount, title]
  );

  const { rows } = await pool.query(`
    SELECT o.*, 
    COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
    FROM orders o 
    WHERE o.id = $1
  `, [id]);

  res.json(rows[0]);
}));

// PUT /api/orders/:orderId/costs/:costId
router.put("/:orderId/costs/:costId", checkAuth, asyncHandler(async (req, res) => {
  const { amount, title } = req.body;
  const { orderId, costId } = req.params;

  const parsedAmount = parseAmount(amount);
  if (!amount || parsedAmount <= 0) return res.status(400).json({ error: "Poprawna kwota jest wymagana" });

  await pool.query(
    "UPDATE order_costs SET amount = $1, title = $2 WHERE id = $3 AND order_id = $4",
    [parsedAmount, title, costId, orderId]
  );

  const { rows } = await pool.query(`
    SELECT o.*, 
    COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
    FROM orders o 
    WHERE o.id = $1
  `, [orderId]);

  res.json(rows[0]);
}));

// DELETE /api/orders/:orderId/costs/:costId
router.delete("/:orderId/costs/:costId", checkAuth, asyncHandler(async (req, res) => {
  const { orderId, costId } = req.params;

  await pool.query(
    "DELETE FROM order_costs WHERE id = $1 AND order_id = $2",
    [costId, orderId]
  );

  const { rows } = await pool.query(`
    SELECT o.*, 
    COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
    FROM orders o 
    WHERE o.id = $1
  `, [orderId]);

  res.json(rows[0]);
}));

// POST /api/orders
router.post("/", checkAuth, asyncHandler(async (req, res) => {
  try {
    const { title, description, status, price, notes, client_id, deadline } = req.body;
    
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: "Tytuł zlecenia jest wymagany" });
    }

    let parsedClientId = null;
    if (client_id && !isNaN(parseInt(client_id))) {
      parsedClientId = parseInt(client_id);
    }

    let parsedPrice = price !== "" && price !== null && price !== undefined ? parseAmount(price, null) : null;

    const { rows: insertedRows } = await pool.query(
      `INSERT INTO orders (title, description, status, price, notes, client_id, deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        String(title).trim(),
        description || null,
        status || "nowe",
        parsedPrice,
        notes || null,
        parsedClientId,
        deadline || null
      ]
    );

    const newOrderId = insertedRows[0].id;
    const { rows } = await pool.query(`
      SELECT 
        o.*, 
        c.type as client_type,
        c.company_name,
        c.first_name, 
        c.last_name, 
        c.email,
        c.phone,
        COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
      FROM orders o 
      LEFT JOIN clients c ON o.client_id = c.id 
      WHERE o.id = $1
    `, [newOrderId]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ error: "Błąd podczas tworzenia zlecenia: " + err.message });
  }
}));

// PUT /api/orders/:id
router.put("/:id", checkAuth, asyncHandler(async (req, res) => {
  const allowed = ["title", "description", "status", "deadline", "price", "notes", "client_id"];
  if (req.user.role === "admin") allowed.push("created_at");

  const updated = await dynamicUpdate("orders", req.params.id, req.body, allowed);
  if (!updated) return res.status(404).json({ error: "Nie zaktualizowano" });

  const { rows } = await pool.query(`
    SELECT 
      o.*, 
      c.type as client_type,
      c.company_name,
      c.first_name, 
      c.last_name, 
      c.email,
      c.phone,
      COALESCE((SELECT SUM(amount) FROM order_costs WHERE order_id = o.id), 0) as total_costs
    FROM orders o 
    LEFT JOIN clients c ON o.client_id = c.id 
    WHERE o.id = $1
  `, [req.params.id]);

  res.json(rows[0]);
}));

// DELETE /api/orders/:id
router.delete("/:id", checkAuth, asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM order_costs WHERE order_id = $1", [req.params.id]);
    const { rowCount } = await client.query("DELETE FROM orders WHERE id = $1", [req.params.id]);
    
    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Nie znaleziono zlecenia" });
    }
    
    await client.query("COMMIT");
    res.json({ message: "Zlecenie oraz jego koszty zostały usunięte" });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

module.exports = router;
