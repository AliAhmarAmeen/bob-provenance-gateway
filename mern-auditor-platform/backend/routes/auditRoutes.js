"use strict";

/**
 * Audit Routes — STUB
 *
 * Full implementation added in Sub-Task 6.
 * This stub mounts the router so server.js starts cleanly during Sub-Task 3.
 */

const express = require("express");
const router  = express.Router();

// Placeholder — POST /api/audit/verify
// The pre-commit hook posts here. Real handler wired in Sub-Task 4 + 6.
router.post("/verify", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet — Sub-Task 4 pending." });
});

// Placeholder — GET /api/audit/records
router.get("/records", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet — Sub-Task 6 pending." });
});

// Placeholder — GET /api/audit/stats
router.get("/stats", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet — Sub-Task 6 pending." });
});

module.exports = router;
