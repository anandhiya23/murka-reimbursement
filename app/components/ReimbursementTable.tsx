"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { formatDate } from "@/lib/format";

interface ReimbursementRow {
  requester: string;
  project: string;
  expense_date: string;
  description: string;
  status: string;
}

interface ReimbursementTableProps<T extends ReimbursementRow = ReimbursementRow> {
  rows: T[];
  userRequesterName?: string;
  onRowClick?: (row: T) => void;
}

export default function ReimbursementTable<T extends ReimbursementRow>({
  rows,
  userRequesterName,
  onRowClick,
}: ReimbursementTableProps<T>) {
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
        r.expense_date.toLowerCase().includes(lower) ||
        (r.description || "").toLowerCase().includes(lower) ||
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
              <th className="hide-mobile">Date</th>
              <th className="hide-mobile">Description</th>
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
              paged.map((r, i) => {
                const isOwn =
                  userRequesterName && r.requester === userRequesterName;
                return (
                  <tr
                    key={`${safeCurrentPage}-${i}`}
                    className={isOwn ? "own-row" : ""}
                    onClick={() => isOwn && onRowClick?.(r)}
                    style={isOwn ? { cursor: "pointer" } : undefined}
                  >
                    <td>{r.requester}</td>
                    <td>{r.project}</td>
                    <td className="hide-mobile">{formatDate(r.expense_date)}</td>
                    <td className="hide-mobile">{r.description}</td>
                    <td className="td-text-center">
                      <span
                        className={`approvalStatus ${r.status.toLowerCase()}`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="dt-controls dt-bottom">
        <div className="dt-info">
          Showing {start} to {end} of {filtered.length}
        </div>
        <div className="dt-pagination">
          <button
            disabled={safeCurrentPage === 0}
            onClick={() => setPage(0)}
            title="First page"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            disabled={safeCurrentPage === 0}
            onClick={() => setPage((p) => p - 1)}
            title="Previous page"
          >
            <ChevronLeft size={16} />
          </button>

          {(() => {
            const pages: (number | "...")[] = [];
            if (totalPages <= 7) {
              for (let i = 0; i < totalPages; i++) pages.push(i);
            } else {
              pages.push(0);
              if (safeCurrentPage > 2) pages.push("...");
              for (
                let i = Math.max(1, safeCurrentPage - 1);
                i <= Math.min(totalPages - 2, safeCurrentPage + 1);
                i++
              ) {
                pages.push(i);
              }
              if (safeCurrentPage < totalPages - 3) pages.push("...");
              pages.push(totalPages - 1);
            }
            return pages.map((p, idx) =>
              p === "..." ? (
                <span key={`ellipsis-${idx}`} className="dt-ellipsis">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  className={p === safeCurrentPage ? "active" : ""}
                  onClick={() => setPage(p)}
                >
                  {p + 1}
                </button>
              )
            );
          })()}

          <button
            disabled={safeCurrentPage >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            title="Next page"
          >
            <ChevronRight size={16} />
          </button>
          <button
            disabled={safeCurrentPage >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
            title="Last page"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
