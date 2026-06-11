"use client";

import { useState, useMemo, Fragment } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
} from "lucide-react";
import { formatDate, formatSubmittedDate } from "@/lib/format";
import { useToast, Toast } from "@/app/components/Toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function statusClasses(status: string): string {
  switch (status.toLowerCase()) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function ItemDetails({ items }: { items: ReimbursementItem[] }) {
  return (
    <div className="bg-muted/30">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent [&>th]:h-8 [&>th]:text-xs [&>th]:font-normal [&>th]:text-muted-foreground">
            <TableHead className="w-10"></TableHead>
            <TableHead>Project</TableHead>
            <TableHead className="w-36">Date</TableHead>
            <TableHead>Files</TableHead>
            <TableHead className="w-36 text-right">Amount</TableHead>
            <TableHead className="w-24 text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="hover:bg-transparent">
              <TableCell></TableCell>
              <TableCell className="align-top">
                <div className="font-medium">{item.project}</div>
                {item.description && (
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                )}
                {item.reviewed_by && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Reviewed by {item.reviewed_by}
                    {item.review_message && <> &mdash; &quot;{item.review_message}&quot;</>}
                  </div>
                )}
              </TableCell>
              <TableCell className="align-top text-sm">{formatDate(item.expense_date)}</TableCell>
              <TableCell className="align-top">
                <div className="flex flex-col gap-1">
                  {item.proof_files?.length > 0
                    ? item.proof_files.map((f) => (
                        <a
                          key={f.id}
                          href={f.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-foreground underline-offset-2 hover:underline"
                        >
                          <ExternalLink size={12} /> <span className="max-w-40 truncate">{f.file_name}</span>
                        </a>
                      ))
                    : item.proof_url && (
                        <a
                          href={item.proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-foreground underline-offset-2 hover:underline"
                        >
                          <ExternalLink size={12} /> View file
                        </a>
                      )}
                </div>
              </TableCell>
              <TableCell className="align-top text-right font-mono text-sm">{formatAmount(item.amount)}</TableCell>
              <TableCell className="align-top text-right">
                <Badge variant="outline" className={statusClasses(item.status)}>{item.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ReimbursementTable({ groups }: ReimbursementTableProps) {
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
  const paged = filtered.slice(safeCurrentPage * pageSize, (safeCurrentPage + 1) * pageSize);

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
      for (let i = Math.max(1, safeCurrentPage - 1); i <= Math.min(totalPages - 2, safeCurrentPage + 1); i++) {
        pages.push(i);
      }
      if (safeCurrentPage < totalPages - 3) pages.push("...");
      pages.push(totalPages - 1);
    }
    return pages.map((p, idx) =>
      p === "..." ? (
        <span key={`ellipsis-${idx}`} className="px-1 text-sm text-muted-foreground">…</span>
      ) : (
        <Button
          key={p}
          variant={p === safeCurrentPage ? "default" : "outline"}
          size="icon"
          className="h-8 w-8"
          onClick={() => setPage(p)}
        >
          {p + 1}
        </Button>
      )
    );
  }

  return (
    <Card className="flex min-h-0 flex-col p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Show
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(0);
            }}
          >
            <SelectTrigger className="h-8 w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          type="text"
          value={search}
          placeholder="Search…"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="h-8 w-full max-w-xs sm:w-64"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <Table className="min-w-170 table-fixed">
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Group ID</TableHead>
              <TableHead className="w-36">Submitted</TableHead>
              <TableHead>Approver</TableHead>
              <TableHead className="w-36 text-right">Approved Total</TableHead>
              <TableHead className="w-24 text-right">Items</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No reimbursements yet
                </TableCell>
              </TableRow>
            ) : (
              paged.map((g) => {
                const isExpanded = expandedGroups.has(g.id);
                const approvedTotal = g.reimbursements.reduce(
                  (sum, r) => (r.status === "Approved" ? sum + r.amount : sum),
                  0
                );
                return (
                  <Fragment key={g.id}>
                    <TableRow
                      className="cursor-pointer"
                      data-state={isExpanded ? "selected" : undefined}
                      onClick={() => toggleExpand(g.id)}
                    >
                      <TableCell>
                        <ChevronRight
                          size={16}
                          className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 font-mono font-medium text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            const code = g.group_code.replace(/^#/, "");
                            navigator.clipboard.writeText(code);
                            showToast(`Copied ${code}`);
                          }}
                        >
                          {g.group_code}
                        </Button>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatSubmittedDate(g.created_at)}</TableCell>
                      <TableCell className="text-sm">{g.approver}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {approvedTotal > 0 ? formatAmount(approvedTotal) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {g.reimbursements.length}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="p-0">
                          <ItemDetails items={g.reimbursements} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
        <div className="text-sm text-muted-foreground">
          Showing {start} to {end} of {filtered.length}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage === 0} onClick={() => setPage(0)} title="First">
            <ChevronsLeft size={16} />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage === 0} onClick={() => setPage((p) => p - 1)} title="Previous">
            <ChevronLeft size={16} />
          </Button>
          {renderPages()}
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage >= totalPages - 1} onClick={() => setPage((p) => p + 1)} title="Next">
            <ChevronRight size={16} />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage >= totalPages - 1} onClick={() => setPage(totalPages - 1)} title="Last">
            <ChevronsRight size={16} />
          </Button>
        </div>
      </div>
      <Toast message={toastMsg} />
    </Card>
  );
}
