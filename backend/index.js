const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pool = require("./db");
const { ensureDbTablesExist } = require("./migrations/initSchema");

// Import Route Modules
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const clientsRoutes = require("./routes/clients");
const ordersRoutes = require("./routes/orders");
const offersRoutes = require("./routes/offers");
const accountingRoutes = require("./routes/accounting");
const issuesRoutes = require("./routes/issues");
const debtsRoutes = require("./routes/debts");

const app = express();

// Security & Standard Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Run automatic database migrations & seeding
ensureDbTablesExist();

// Health check and root endpoints
app.get("/", (req, res) => {
  res.send("Serwer ServiceFlow działa poprawnie! Korzystaj z endpointów /api.");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Register Modular Routers
app.use("/api", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/offers", offersRoutes);
app.use("/api/accounting", accountingRoutes);
app.use("/api/issues", issuesRoutes);
app.use("/api/debts", debtsRoutes);

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error(`[Server Error] ${req.method} ${req.url}:`, err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || "Wewnętrzny błąd serwera",
    code: err.code || "INTERNAL_ERROR"
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Serwer ServiceFlow działa na porcie ${PORT}`);
});