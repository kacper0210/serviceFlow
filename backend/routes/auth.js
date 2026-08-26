const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { sessions, asyncHandler, checkAuth } = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "serviceflow_secret_key_2026";
const router = express.Router();

// POST /api/login
router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Brak danych" });

  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1 AND is_active = true", [email]);
  const user = rows[0];

  const validPassword = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !validPassword) {
    return res.status(401).json({ error: "Błędne dane" });
  }

  const userData = { id: user.id, email: user.email, role: user.role };
  const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "7d" });
  sessions.set(token, userData);

  res.json({ token, user: userData });
}));

// POST /api/logout
router.post("/logout", checkAuth, (req, res) => {
  sessions.delete(req.token);
  res.json({ message: "Wylogowano" });
});

// GET /api/me
router.get("/me", checkAuth, (req, res) => {
  res.json(req.user);
});

// GET /api/db-test
router.get("/db-test", asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT NOW()");
  res.json({ now: rows[0].now });
}));

module.exports = router;
