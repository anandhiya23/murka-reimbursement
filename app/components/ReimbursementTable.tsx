"use client";

import { useState, useMemo } from "react";

interface ReimbursementRow {
  requester: string;
  project: string;
  date: string;
  description: string;
  status: string;
}

interface ReimbursementTableProps {
  rows: ReimbursementRow[];
}

export default function ReimbursementTable({ rows }: ReimbursementTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const lower = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.requester.toLowerCase().includes(lower) ||
        r.project.toLowerCase().includes(lower) ||
        r.date.toLowerCase().includes(lower) ||
        r.description.toLowerCase().includes(lower) ||
        r.status.toLowerCase().includes(lower)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(
    safeCurrentPage * pageSize,
    (safeCurrentPage + 1) * pageSize
  );

  const start = filtered.length === 0 ? 0 : safeCurrentPage * pageSize + 1;
  const end = Math.min((safeCurrentPage + 1) * pageSize, filtered.length);

  return (
    <div className="table-container">
      <div className="dt-controls">
        <div>
          Show{" "}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          Search{" "}
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>

      <div className="dt-layout-table">
        <table id="reimbursementTable">
          <thead>
            <tr>
              <th>Requester</th>
              <th>Project</th>
              <th>Date</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center" }}>
                  No data available
                </td>
              </tr>
            ) : (
              paged.map((r, i) => (
                <tr key={`${safeCurrentPage}-${i}`}>
                  <td>{r.requester}</td>
                  <td>{r.project}</td>
                  <td>{r.date}</td>
                  <td>{r.description}</td>
                  <td className="td-text-center">
                    <span
                      className={`approvalStatus ${r.status.toLowerCase()}`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="dt-controls dt-bottom">
        <div>
          Showing {start} to {end} of {filtered.length} entries
        </div>
        <div className="dt-pagination">
          <button
            disabled={safeCurrentPage === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              className={i === safeCurrentPage ? "active" : ""}
              onClick={() => setPage(i)}
            >
              {i + 1}
            </button>
          ))}
          <button
            disabled={safeCurrentPage >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
