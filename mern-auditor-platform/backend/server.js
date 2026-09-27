"use strict";

/**
 * BobGuard AI Provenance Gateway — Express Backend
 *
 * Startup sequence:
 *   1. Load env vars from .env
 *   2. Load & validate .ai-policy.json (fails fast on bad policy)
 *   3. Connect to MongoDB via Mongoose
 *   4. Mount middleware (CORS, JSON body parser)
 *   5. Mount routes (/health, /api/audit)
 *   6. Mount error handler
 *   7. Start HTTP listener
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const { loadPolicy } = require("./config/policyLoader");

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT, 10) || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/bobguard";
const CORS_ORIGIN =
  process.env.CORS_ORIGIN ||
  "https://bobguard.netlify.app/" ||
  "http://localhost:5173";

// ─── Policy (loaded once, cached) ─────────────────────────────────────────────

let policy;
try {
  policy = loadPolicy();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

// ─── Express app ─────────────────────────────────────────────────────────────

const app = express();

// CORS — allow the Vite dev server (and any additional origins from env)
app.use(
  cors({
    origin: CORS_ORIGIN.split(",").map((o) => o.trim()),
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  }),
);

// Parse JSON request bodies (limit 2 mb — diffs can be large)
app.use(express.json({ limit: "2mb" }));

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check — confirms server is up and policy is loaded
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    policyVersion: policy.metadata.policyVersion,
    mongoState:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// Audit routes — mounted lazily so Mongoose models are registered first
// (auditRoutes is required after DB connection is established — see below)

// ─── Global error handler ─────────────────────────────────────────────────────

// Must be defined with four parameters so Express recognises it as an error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[BobGuard Error]", err.message);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal Server Error" });
});

// ─── MongoDB + server start ───────────────────────────────────────────────────

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`[BobGuard] MongoDB connected → ${MONGO_URI}`);
  } catch (err) {
    console.error(`[BobGuard] MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }

  // Mount audit router after DB is ready (models need a live connection)
  const auditRoutes = require("./routes/auditRoutes");
  app.use("/api/audit", auditRoutes);

  app.listen(PORT, () => {
    console.log(`[BobGuard] Gateway listening on http://localhost:${PORT}`);
    console.log(`[BobGuard] Policy v${policy.metadata.policyVersion} active`);
    console.log(`[BobGuard] CORS origin: ${CORS_ORIGIN}`);
  });
}

start();

module.exports = app; // export for testing
