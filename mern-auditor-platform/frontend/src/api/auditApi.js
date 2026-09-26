/**
 * BobGuard — Audit API Client
 *
 * Thin axios wrapper around the Express backend.
 * All functions return the unwrapped response data (not the axios envelope).
 */

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/audit";

const client = axios.create({ baseURL: BASE_URL });

/**
 * Fetch the five pre-aggregated dashboard metrics.
 * @returns {Promise<object>} stats object from GET /stats
 */
export async function fetchStats() {
  const { data } = await client.get("/stats");
  return data;
}

/**
 * Fetch the paginated audit log (newest first).
 * @param {number} [page=0]       0-based page index
 * @param {string} [dateFrom=""]  ISO date "YYYY-MM-DD" or empty string
 * @param {string} [dateTo=""]    ISO date "YYYY-MM-DD" or empty string
 * @param {number} [limit=20]     Records per page (use 9999 to fetch all)
 * @returns {Promise<{ total: number, page: number, records: object[] }>}
 */
export async function fetchRecords(page = 0, dateFrom = "", dateTo = "", limit = 20) {
  const params = { page, limit };
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo)   params.dateTo   = dateTo;
  const { data } = await client.get("/records", { params });
  return data;
}

/**
 * Fetch a single audit record by its MongoDB _id.
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function fetchRecord(id) {
  const { data } = await client.get(`/records/${id}`);
  return data;
}
