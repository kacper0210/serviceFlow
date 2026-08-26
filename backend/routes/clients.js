const express = require("express");
const pool = require("../db");
const { asyncHandler, checkAuth, dynamicUpdate } = require("../middleware/auth");

const router = express.Router();

// GET /api/clients
router.get("/", checkAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM clients ORDER BY id ASC");
  res.json(rows);
}));

// GET /api/clients/:id
router.get("/:id", checkAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM clients WHERE id = $1", [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: "Nie znaleziono" });
  res.json(rows[0]);
}));

// POST /api/clients
router.post("/", checkAuth, asyncHandler(async (req, res) => {
  const fields = ["first_name", "last_name", "phone", "email", "nip", "address", "type", "company_name"];
  const values = fields.map(k => req.body[k]);
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");

  const { rows } = await pool.query(
    `INSERT INTO clients (${fields.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  res.status(201).json(rows[0]);
}));

// PUT /api/clients/:id
router.put("/:id", checkAuth, asyncHandler(async (req, res) => {
  const allowed = ["first_name", "last_name", "phone", "email", "nip", "address", "type", "company_name"];
  const updated = await dynamicUpdate("clients", req.params.id, req.body, allowed);
  if (!updated) return res.status(404).json({ error: "Nie zaktualizowano" });
  res.json(updated);
}));

// DELETE /api/clients/:id
router.delete("/:id", checkAuth, asyncHandler(async (req, res) => {
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

module.exports = router;
