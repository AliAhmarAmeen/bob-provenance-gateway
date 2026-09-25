"use strict";

/**
 * Audit Routes
 *
 * POST /api/audit/analyze  — primary endpoint; triggers the three-subagent pipeline.
 * POST /api/audit/verify   — alias used by the pre-commit hook (same handler).
 * GET  /api/audit/records  — paginated audit log (stub until Sub-Task 6).
 * GET  /api/audit/stats    — aggregated dashboard metrics (stub until Sub-Task 6).
 * GET  /api/audit/records/:id — single record lookup (stub until Sub-Task 6).
 */

const express = require("express");
const router  = express.Router();

const { analyzeCommit } = require("../controllers/auditController");

// ─── Active endpoints (Sub-Task 4) ────────────────────────────────────────────

// Primary analysis endpoint — React dashboard will call this
router.post("/analyze", analyzeCommit);

// Alias used by the Git pre-commit hook (same pipeline, same handler)
router.post("/verify", analyzeCommit);

// ─── Stub endpoints (implemented in Sub-Task 6) ────────────────────────────────

router.get("/records", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet — Sub-Task 6 pending." });
});

router.get("/stats", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet — Sub-Task 6 pending." });
});

router.get("/records/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet — Sub-Task 6 pending." });
});

module.exports = router;
