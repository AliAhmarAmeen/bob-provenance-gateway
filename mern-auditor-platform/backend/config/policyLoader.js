"use strict";

/**
 * BobGuard Policy Loader
 *
 * Reads .ai-policy.json from disk once at server startup, validates it against
 * the JSON Schema (schemas/ai-policy.schema.json), and returns the cached result
 * on every subsequent call. Throws on missing file or schema violations so the
 * server fails fast rather than running with a broken policy.
 */

const fs   = require("fs");
const path = require("path");
const Ajv  = require("ajv");

// ─── Paths ───────────────────────────────────────────────────────────────────

const DEFAULT_POLICY_PATH = path.resolve(
  __dirname,
  "../../mock-enterprise-target/.ai-policy.json"
);

const SCHEMA_PATH = path.resolve(
  __dirname,
  "../schemas/ai-policy.schema.json"
);

// ─── Module-level cache ───────────────────────────────────────────────────────

let _cachedPolicy = null;

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Load, validate, and cache the enterprise policy.
 *
 * @returns {object} The validated policy object.
 * @throws  {Error}  If the policy file is missing, invalid JSON, or fails schema validation.
 */
function loadPolicy() {
  if (_cachedPolicy) return _cachedPolicy;

  // Resolve policy file path — prefer env var override
  const policyPath = process.env.POLICY_PATH
    ? path.resolve(process.env.POLICY_PATH)
    : DEFAULT_POLICY_PATH;

  // Read policy file
  let rawPolicy;
  try {
    rawPolicy = fs.readFileSync(policyPath, "utf8");
  } catch (err) {
    throw new Error(
      `[PolicyLoader] Cannot read policy file at "${policyPath}": ${err.message}`
    );
  }

  // Parse JSON
  let policy;
  try {
    policy = JSON.parse(rawPolicy);
  } catch (err) {
    throw new Error(
      `[PolicyLoader] Policy file at "${policyPath}" is not valid JSON: ${err.message}`
    );
  }

  // Read & parse schema
  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  } catch (err) {
    throw new Error(
      `[PolicyLoader] Cannot read schema file at "${SCHEMA_PATH}": ${err.message}`
    );
  }

  // Validate policy against schema
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const valid = validate(policy);

  if (!valid) {
    const details = validate.errors
      .map((e) => `  • ${e.instancePath || "(root)"} ${e.message}`)
      .join("\n");
    throw new Error(
      `[PolicyLoader] Policy file failed schema validation:\n${details}`
    );
  }

  console.log(
    `[PolicyLoader] Policy v${policy.metadata.policyVersion} loaded and validated from "${policyPath}".`
  );

  _cachedPolicy = policy;
  return _cachedPolicy;
}

/**
 * Return the cached policy without re-reading disk.
 * Must be called after loadPolicy() has already been invoked once.
 *
 * @returns {object} The cached policy object.
 * @throws  {Error}  If called before loadPolicy().
 */
function getPolicy() {
  if (!_cachedPolicy) {
    throw new Error(
      "[PolicyLoader] getPolicy() called before loadPolicy(). Call loadPolicy() at server startup."
    );
  }
  return _cachedPolicy;
}

// Exposed for testing: clear the cache between test runs
function _clearCache() {
  _cachedPolicy = null;
}

module.exports = { loadPolicy, getPolicy, _clearCache };
