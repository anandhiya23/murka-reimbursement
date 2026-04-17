"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
} from "lucide-react";
import { formatDate, formatSubmittedDate } from "@/lib/format";
import { useToast, Toast } from "@/app/components/Toast";

interface ProofFile {
  id: number;
  file_name: string;
  public_url: string;
}

interface ReimbursementItem {
  id: number;
  project: string;
  expense_date: string;
  description: string;
  amount: number;
  status: string;
  proof_url: string;
  proof_files: ProofFile[];
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_message: string | null;
}

interface ReimbursementGroup {
  id: number;
  group_code: string;
  requester: string;
  requester_email: string;
  approver: string;
  created_at: string;
  reimbursements: ReimbursementItem[];
}

interface ReimbursementTableProps {
  groups: ReimbursementGroup[];
}

function formatAmount(amount: number): string {
  return "Rp" + amount.toLocaleString("id-ID");
}

function CollapsibleItems({
  items,
  isOpen,
}: {
  items: ReimbursementItem[];
  isOpen: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [isOpen]);

  return (
    <div
      className="collapse-wrapper"
      style={{ height: isOpen ? height : 0, opacity: isOpen ? 1 : 0 }}
    >
      <div ref={contentRef} className="collapse-content">
        <div className="sub-header">
          <div className="col col-chevron"></div>
          <div className="col col-name">Project</div>
          <div className="col col-date">Date</div>
          <div className="col col-files">Files</div>
          <div className="col col-amount">Amount</div>
          <div className="col col-status">Status</div>
        </div>
        {items.map((item) => (
          <div key={item.id} className="sub-row">
            <div className="col col-chevron"></div>
            <div className="col col-name">
              <span className="sub-project">{item.project}</span>
              {item.description && (
                <span className="sub-desc">{item.description}</span>
              )}
              {item.reviewed_by && (
                <span className="sub-review">
                  Reviewed by {item.reviewed_by}
                  {item.review_message && (
                    <> &mdash; &quot;{item.review_message}&quot;</>
                  )}
                </span>
              )}
            </div>
            <div className="col col-date">{formatDate(item.expense_date)}</div>
            <div className="col col-files">
              {item.proof_files?.length > 0
                ? item.proof_files.map((f) => (
                    <a
                      key={f.id}
                      href={f.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="proof-link"
                    >
                      <ExternalLink size={12} /> <span className="proof-name">{f.file_name}</span>
                    </a>
                  ))
                : item.proof_url ? (
                  <a
                    href={item.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="proof-link"
                  >
                    <ExternalLink size={12} /> View file
                  </a>
                ) : null}
            </div>
            <div className="col col-amount sub-amount">{formatAmount(item.amount)}</div>
            <div className="col col-status">
              <span className={`approvalStatus ${item.status.toLowerCase()}`}>
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReimbursementTable({
  groups,
}: ReimbursementTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const { message: toastMsg, show: showToast } = useToast();

  const filtered = useMemo(() => {
    if (!search) return groups;
    const lower = search.toLowerCase();
    return groups.filter(
      (g) =>
        g.group_code.toLowerCase().includes(lower) ||
        g.approver.toLowerCase().includes(lower) ||
        g.reimbursements.some(
          (r) =>
            r.project.toLowerCase().includes(lower) ||
            (r.description || "").toLowerCase().includes(lower)
        )
    );
  }, [groups, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(
    safeCurrentPage * pageSize,
    (safeCurrentPage + 1) * pageSize
  );

  const start = filtered.length === 0 ? 0 : safeCurrentPage * pageSize + 1;
  const end = Math.min((safeCurrentPage + 1) * pageSize, filtered.length);

  function toggleExpand(groupId: number) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function renderPages() {
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
  }

  return (
    <div className="list-container">
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

      <div className="list-scroll-inner">
      {/* Header */}
      <div className="list-header">
        <div className="col col-chevron"></div>
        <div className="col col-name">Group ID</div>
        <div className="col col-date">Submitted</div>
        <div className="col col-files">Approver</div>
        <div className="col col-amount">Approved Total</div>
        <div className="col col-status">Items</div>
      </div>

      {/* Rows */}
      <div className="list-body">
        {paged.length === 0 ? (
          <div className="list-empty">No reimbursements yet</div>
        ) : (
          paged.map((g) => {
            const isExpanded = expandedGroups.has(g.id);
            const approvedTotal = g.reimbursements.reduce(
              (sum, r) => (r.status === "Approved" ? sum + r.amount : sum),
              0
            );

            return (
              <div key={g.id} className="group-block">
                <div
                  className={`group-row ${isExpanded ? "expanded" : ""}`}
                  onClick={() => toggleExpand(g.id)}
                >
                  <div className="col col-chevron">
                    <ChevronRight size={16} className="chevron-icon" />
                  </div>
                  <div className="col col-name">
                    <span
                      className="group-code"
                      onClick={(e) => { e.stopPropagation(); const code = g.group_code.replace(/^#/, ""); navigator.clipboard.writeText(code); showToast(`Copied ${code}`); }}
                    >{g.group_code}</span>
                  </div>
                  <div className="col col-date">
                    {formatSubmittedDate(g.created_at)}
                  </div>
                  <div className="col col-files">
                    {g.approver}
                  </div>
                  <div className="col col-amount">
                    {approvedTotal > 0 ? formatAmount(approvedTotal) : "-"}
                  </div>
                  <div className="col col-status">
                    {g.reimbursements.length} item
                    {g.reimbursements.length !== 1 ? "s" : ""}
                  </div>
                </div>

                <CollapsibleItems
                  items={g.reimbursements}
                  isOpen={isExpanded}
                />
              </div>
            );
          })
        )}
      </div>
      </div>

      {/* Pagination */}
      <div className="dt-controls dt-bottom">
        <div className="dt-info">
          Showing {start} to {end} of {filtered.length}
        </div>
        <div className="dt-pagination">
          <button disabled={safeCurrentPage === 0} onClick={() => setPage(0)} title="First">
            <ChevronsLeft size={16} />
          </button>
          <button disabled={safeCurrentPage === 0} onClick={() => setPage((p) => p - 1)} title="Previous">
            <ChevronLeft size={16} />
          </button>
          {renderPages()}
          <button disabled={safeCurrentPage >= totalPages - 1} onClick={() => setPage((p) => p + 1)} title="Next">
            <ChevronRight size={16} />
          </button>
          <button disabled={safeCurrentPage >= totalPages - 1} onClick={() => setPage(totalPages - 1)} title="Last">
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
      <Toast message={toastMsg} />
    </div>
  );
}
