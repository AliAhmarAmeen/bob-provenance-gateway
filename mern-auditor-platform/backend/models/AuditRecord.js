"use strict";

/**
 * BobGuard — AuditRecord Mongoose Model
 *
 * Tamper-evident AI Bill of Materials (AI-BOM) ledger entry.
 * One document is created for every analyzed commit.
 *
 * Schema sections
 * ───────────────
 *   Git metadata   — commitSha, branch, author, repoName, taskId
 *   Analysis       — licenseStatus, securityStatus, remediation, aiRatio
 *   Provenance     — sha256ProvenanceHash (indexed, unique)
 *   Enforcement    — blocked, allowCommit, violations[]
 *   Timestamps     — createdAt (auto via timestamps option)
 */

const mongoose = require("mongoose");
const { Schema } = mongoose;

// ─── Sub-document schemas ─────────────────────────────────────────────────────

const LicenseStatusSchema = new Schema(
  {
    passed:            { type: Boolean, required: true },
    compliant:         { type: Boolean, required: true },
    detectedLicenses:  { type: [String], default: [] },
    bannedLicenses:    { type: [String], default: [] },
    message:           { type: String, default: "" },
  },
  { _id: false }
);

const VulnerabilitySchema = new Schema(
  {
    type:        { type: String, required: true },
    pattern:     { type: String, default: "" },
    matchedText: { type: String, default: "" },
    severity:    { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "HIGH" },
  },
  { _id: false }
);

const SecurityStatusSchema = new Schema(
  {
    passed:               { type: Boolean, required: true },
    vulnerabilities:      { type: [VulnerabilitySchema], default: [] },
    hallucinatedPackages: { type: [String], default: [] },
    checkedPackages:      { type: [String], default: [] },
    message:              { type: String, default: "" },
  },
  { _id: false }
);

const RemediationSchema = new Schema(
  {
    attempted:         { type: Boolean, default: false },
    patchAvailable:    { type: Boolean, default: false },
    /** Base64-encoded unified diff string — survives JSON serialisation cleanly. */
    patchContent:      { type: String, default: null },
    vulnerabilityType: { type: String, default: null },
    message:           { type: String, default: "" },
  },
  { _id: false }
);

const AiRatioSchema = new Schema(
  {
    humanLines:  { type: Number, default: 0 },
    aiLines:     { type: Number, default: 0 },
    totalLines:  { type: Number, default: 0 },
    aiPercent: {
      type:    Number,
      default: 0,
      min:     [0,   "aiPercent must be at least 0"],
      max:     [100, "aiPercent must be at most 100"],
    },
  },
  { _id: false }
);

// ─── Root schema ──────────────────────────────────────────────────────────────

const AuditRecordSchema = new Schema(
  {
    // ── Git metadata ───────────────────────────────────────────────────────
    commitSha: {
      type:    String,
      default: "pre-commit",
      index:   true,         // fast deduplication queries
    },
    branch:   { type: String, default: "unknown" },
    author:   { type: String, default: "unknown" },
    repoName: { type: String, default: "unknown" },
    taskId:   { type: String, default: "manual-commit" },

    // ── Raw diff (stored for audit trail; may be large) ────────────────────
    diff: { type: String, default: "" },

    // ── Subagent outputs ───────────────────────────────────────────────────
    licenseStatus:  { type: LicenseStatusSchema,  required: true },
    securityStatus: { type: SecurityStatusSchema, required: true },
    remediation:    { type: RemediationSchema,    default: null  },

    // ── AI provenance metrics ──────────────────────────────────────────────
    aiRatio: { type: AiRatioSchema, required: true },

    // ── Tamper-evident provenance hash ─────────────────────────────────────
    sha256ProvenanceHash: {
      type:     String,
      required: true,
      unique:   true,        // enforced at DB level (unique index)
      validate: {
        validator: (v) => /^[a-f0-9]{64}$/.test(v),
        message:   "sha256ProvenanceHash must be a 64-character lowercase hex string",
      },
    },

    // ── Enforcement decision ───────────────────────────────────────────────
    blocked:     { type: Boolean, required: true },
    allowCommit: { type: Boolean, required: true },
    violations:  { type: [String], default: [] },
  },
  {
    // Adds `createdAt` and `updatedAt` automatically.
    // `createdAt` is indexed below for efficient descending dashboard queries.
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// `sha256ProvenanceHash` unique index is declared via `unique: true` in the field
// definition above; Mongoose creates it automatically.

// Descending `createdAt` — used by the dashboard's "latest records" query.
AuditRecordSchema.index({ createdAt: -1 });

// ─── Model export ─────────────────────────────────────────────────────────────

const AuditRecord = mongoose.model("AuditRecord", AuditRecordSchema);

module.exports = AuditRecord;
