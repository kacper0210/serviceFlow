const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { asyncHandler, checkAuth, requireAdmin, dynamicUpdate } = require("../middleware/auth");

const router = express.Router();

// GET /api/users
router.get("/", checkAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT id, email, role, is_active FROM users ORDER BY id ASC");
  res.json(rows);
}));

// POST /api/users
router.post("/", checkAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { email, password, role = "user", is_active = true } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    "INSERT INTO users (email, password_hash, role, is_active) VALUES ($1, $2, $3, $4) RETURNING id, email, role, is_active",
    [email, hashedPassword, role, !!is_active]
  );
  res.status(201).json(rows[0]);
}));

// PUT /api/users/:id
router.put("/:id", checkAuth, requireAdmin, asyncHandler(async (req, res) => {
  if (req.body.password) {
    req.body.password_hash = await bcrypt.hash(req.body.password, 10);
  }
  const updated = await dynamicUpdate("users", req.params.id, req.body, ["email", "password_hash", "role", "is_active"]);
  if (!updated) return res.status(404).json({ error: "Nie znaleziono użytkownika" });
  res.json(updated);
}));

// DELETE /api/users/:id
router.delete("/:id", checkAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: "Nie znaleziono" });
  res.json({ message: "Usunięto" });
}));

module.exports = router;
