"use strict";

/**
 * BobGuard — Audit Routes
 *
 * All routes are mounted at /api/audit (see server.js).
 *
 * POST /analyze          — run three-subagent pipeline + persist AuditRecord
 * POST /verify           — alias used by the Git pre-commit hook (same handler)
 * GET  /records          — paginated list of AuditRecord documents (newest first)
 * GET  /records/:id      — single AuditRecord by MongoDB _id
 * GET  /stats            — pre-aggregated dashboard metrics (single pipeline)
 */

const express = require("express");
const router  = express.Router();

const {
  analyzeCommit,
  getRecords,
  getRecord,
  getStats,
} = require("../controllers/auditController");

// ─── Write / analysis endpoints ───────────────────────────────────────────────

// Primary analysis endpoint — called by the React dashboard and directly
router.post("/analyze", analyzeCommit);

// Alias used by the Git pre-commit hook (/api/audit/verify)
router.post("/verify", analyzeCommit);

// ─── Read endpoints ───────────────────────────────────────────────────────────

// Paginated audit log — ?page=0 (0-based)
router.get("/records", getRecords);

// Single-record lookup — must be declared before /records to avoid ambiguity,
// but Express matches by insertion order so the more-specific path is fine here.
router.get("/records/:id", getRecord);

// Aggregated dashboard metrics
router.get("/stats", getStats);

module.exports = router;
