// One-time script: parse the CSV export and generate SQL INSERT statements
// Usage: node supabase/migrate-csv.js > supabase/history.sql

const fs = require("fs");
const path = require("path");

const csv = fs.readFileSync(
  path.join(__dirname, "..", "Murka Reimbursement Sheet - Reimbursement.csv"),
  "utf8"
);

// Simple CSV parser that handles quoted fields with commas/newlines
function parseCSV(text) {
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field);
        field = "";
      } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        current.push(field);
        field = "";
        if (ch === "\r") i++;
        rows.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }
  if (field || current.length) {
    current.push(field);
    rows.push(current);
  }
  return rows;
}

const rows = parseCSV(csv);
const header = rows[0];
const dataRows = rows.slice(1);

// DD/MM/YYYY HH:MM:SS -> ISO timestamp with Jakarta offset
function parseDate(str) {
  if (!str || !str.trim()) return null;
  const m = str.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+07:00`;
}

// "Rp126,800" -> 126800
function parseAmount(str) {
  if (!str || !str.trim()) return 0;
  const digits = str.replace(/[^\d-]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function esc(str) {
  if (!str) return "";
  return str.replace(/'/g, "''");
}

// Collect unique projects and requesters for upsert
const projects = new Set();
const requesters = new Map(); // name -> email

const inserts = [];

for (const row of dataRows) {
  const dateSubmitted = row[0];
  const requester = (row[1] || "").trim();
  const project = (row[2] || "").trim();
  const expenseDate = (row[3] || "").trim();
  const description = (row[4] || "").trim();
  const amount = row[5] || "";
  const proofUrl = (row[6] || "").trim();
  // row[7] = invoice
  const approver = (row[8] || "").trim();
  // row[9] = approved amount
  // row[10] = remarks
  const status = (row[11] || "").trim();
  // row[12] = date reimbursed
  const email = (row[13] || "").trim();
  const groupId = (row[14] || "").trim();

  // Skip empty rows
  if (!requester && !project) continue;

  const ts = parseDate(dateSubmitted);
  if (!ts) continue;

  const amountNum = parseAmount(amount);

  if (project) projects.add(project);
  if (requester && email) requesters.set(requester, email);

  inserts.push(
    `  (` +
      `'${esc(ts)}'::timestamptz, ` +
      `'${esc(requester)}', ` +
      `'${esc(project)}', ` +
      `'${esc(expenseDate)}', ` +
      `'${esc(description)}', ` +
      `${amountNum}, ` +
      `'${esc(proofUrl)}', ` +
      `'${esc(approver)}', ` +
      `'${esc(status || "Pending")}', ` +
      `'${esc(groupId)}', ` +
      `'${esc(email)}'` +
    `)`
  );
}

// Output SQL
let sql = "";

sql += "-- ============================================================\n";
sql += "-- Murka Reimbursement Portal – History Data Migration\n";
sql += "-- Auto-generated from CSV export\n";
sql += "-- ============================================================\n\n";

// Upsert missing projects
sql += "-- Ensure all projects exist\n";
for (const p of projects) {
  sql += `insert into projects (name) values ('${esc(p)}') on conflict (name) do nothing;\n`;
}

sql += "\n-- Ensure all requesters exist\n";
for (const [name, email] of requesters) {
  sql += `insert into requesters (name, email) values ('${esc(name)}', '${esc(email)}') on conflict (name) do update set email = excluded.email;\n`;
}

sql += "\n-- Insert historical reimbursements\n";
sql += "insert into reimbursements (created_at, requester, project, expense_date, description, amount, proof_url, approver, status, group_id, requester_email) values\n";
sql += inserts.join(",\n");
sql += ";\n";

process.stdout.write(sql);
