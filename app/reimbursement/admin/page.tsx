"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import useSWR from "swr";
import { createClient } from "@/utils/supabase/client";
import {
  LogOut,
  ArrowLeft,
  Check,
  XIcon,
  ExternalLink,
  Plus,
  Receipt,
  FolderKanban,
  Users,
  Trash2,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  KeyRound,
} from "lucide-react";
import { formatDate, formatSubmittedDate } from "@/lib/format";
import { useToast, Toast } from "@/app/components/Toast";
import SiteHeader from "@/app/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  notified_at: string | null;
  reimbursements: ReimbursementItem[];
}

interface UserInfo {
  email: string;
  name: string;
  avatar_url: string | null;
  isAdmin: boolean;
}

interface Project {
  id: number;
  name: string;
  is_active: boolean;
}

interface Requester {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
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

function AdminItemDetails({
  items,
  onApprove,
  onReject,
}: {
  items: ReimbursementItem[];
  onApprove: (item: ReimbursementItem) => void;
  onReject: (item: ReimbursementItem) => void;
}) {
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
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="hover:bg-transparent">
              <TableCell></TableCell>
              <TableCell className="align-top">
                <div className="font-medium">{item.project}</div>
                {item.description && <div className="text-xs text-muted-foreground">{item.description}</div>}
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
                          className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
                        >
                          <ExternalLink size={12} /> <span className="max-w-40 truncate">{f.file_name}</span>
                        </a>
                      ))
                    : item.proof_url && (
                        <a
                          href={item.proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
                        >
                          <ExternalLink size={12} /> View
                        </a>
                      )}
                </div>
              </TableCell>
              <TableCell className="align-top text-right font-mono text-sm">{formatAmount(item.amount)}</TableCell>
              <TableCell className="align-top text-right">
                <Badge variant="outline" className={statusClasses(item.status)}>{item.status}</Badge>
              </TableCell>
              <TableCell className="align-top">
                {item.status === "Pending" && (
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      className="h-7 w-7 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => onApprove(item)}
                      title="Approve"
                    >
                      <Check size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7"
                      onClick={() => onReject(item)}
                      title="Reject"
                    >
                      <XIcon size={14} />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type AdminTab = "reimbursements" | "projects" | "requesters";
type StatusFilter = "Unprocessed" | "Processed" | "All";

interface AdminInitResponse {
  user: UserInfo;
  groups: ReimbursementGroup[];
}

export default function AdminPage() {
  const { message: toastMsg, show: showToast } = useToast();
  const [adminTab, setAdminTab] = useState<AdminTab>("reimbursements");

  // Reimbursements state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Unprocessed");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [reviewTarget, setReviewTarget] = useState<ReimbursementItem | null>(null);
  const [reviewAction, setReviewAction] = useState<"Approved" | "Rejected">("Approved");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  // Generic confirm dialog (replaces native confirm()).
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Projects state
  const [newProjectName, setNewProjectName] = useState("");
  const [onlyActiveProjects, setOnlyActiveProjects] = useState(false);

  // Requesters state
  const [newRequester, setNewRequester] = useState({ name: "", email: "" });
  const [inviteSent, setInviteSent] = useState("");
  const [requesterError, setRequesterError] = useState("");
  const [requesterLoading, setRequesterLoading] = useState(false);

  // Three independent reads. init gates access; projects/requesters feed tabs.
  const { data: initData, error: initError, isLoading: loading, mutate: mutateInit } =
    useSWR<AdminInitResponse>("/api/admin/init");
  const { data: projectsData, mutate: mutateProjects } =
    useSWR<Project[]>("/api/admin/projects");
  const { data: requestersData, mutate: mutateRequesters } =
    useSWR<Requester[]>("/api/admin/requesters");

  const user = initData?.user ?? null;
  const groups = useMemo<ReimbursementGroup[]>(() => initData?.groups ?? [], [initData]);
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const requesters = Array.isArray(requestersData) ? requestersData : [];

  // init returns error -> /login; authenticated non-admin -> launcher.
  useEffect(() => {
    if (initError) window.location.href = "/login";
    else if (initData && !initData.user.isAdmin) window.location.href = "/";
  }, [initError, initData]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  // Filter groups: a group matches a status filter if ANY of its items match
  const { filtered, statusCounts } = useMemo(() => {
    const unprocessed = groups.filter((g) => g.reimbursements.some((r) => r.status === "Pending"));
    const processed = groups.filter((g) => g.reimbursements.every((r) => r.status !== "Pending"));

    let result = groups;
    if (statusFilter === "Unprocessed") result = unprocessed;
    else if (statusFilter === "Processed") result = processed;

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (g) =>
          g.requester.toLowerCase().includes(lower) ||
          g.group_code.toLowerCase().includes(lower) ||
          g.reimbursements.some(
            (r) =>
              r.project.toLowerCase().includes(lower) ||
              (r.description || "").toLowerCase().includes(lower)
          )
      );
    }

    return {
      filtered: result,
      statusCounts: {
        Unprocessed: unprocessed.length,
        Processed: processed.length,
        All: groups.length,
      },
    };
  }, [groups, statusFilter, search]);

  // Project names referenced by at least one reimbursement item — these
  // can't be permanently deleted.
  const usedProjectNames = useMemo(
    () => new Set(groups.flatMap((g) => g.reimbursements.map((r) => r.project))),
    [groups]
  );

  function toggleExpand(groupId: number) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safeCurrentPage * pageSize, (safeCurrentPage + 1) * pageSize);
  const start = filtered.length === 0 ? 0 : safeCurrentPage * pageSize + 1;
  const end = Math.min((safeCurrentPage + 1) * pageSize, filtered.length);

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

  function openReview(item: ReimbursementItem, action: "Approved" | "Rejected") {
    setReviewTarget(item);
    setReviewAction(action);
    setReviewMessage("");
  }

  async function submitReview() {
    if (!reviewTarget) return;
    setReviewLoading(true);
    const resp = await fetch("/api/admin/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: reviewTarget.id,
        action: reviewAction,
        message: reviewMessage || undefined,
      }),
    });
    if (resp.ok) {
      const json = await resp.json();
      setReviewTarget(null);
      await mutateInit();
      if (json.emailTriggered) {
        if (json.emailError) {
          showToast(`Email failed: ${json.emailError}`, 5000);
        } else {
          const code = (json.groupCode as string).replace(/^#/, "");
          showToast(`${code} fully reviewed — sending email to ${json.requester} (${json.requesterEmail})`, 5000);
        }
      }
    }
    setReviewLoading(false);
  }

  function deleteGroup(group: ReimbursementGroup) {
    const totalAmount = group.reimbursements.reduce((s, r) => s + r.amount, 0);
    setConfirmDialog({
      title: "Delete group?",
      description: `Delete entire group ${group.group_code} from ${group.requester} (${group.reimbursements.length} items, ${formatAmount(totalAmount)})? This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        await fetch("/api/admin/review", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId: group.id }),
        });
        await mutateInit();
      },
    });
  }

  // Project helpers
  async function addProject() {
    if (!newProjectName.trim()) return;
    await fetch("/api/admin/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", name: newProjectName.trim() }),
    });
    setNewProjectName("");
    await mutateProjects();
  }

  async function toggleProject(id: number, is_active: boolean) {
    await fetch("/api/admin/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id, is_active }),
    });
    await mutateProjects();
  }

  function deleteProject(id: number, name: string) {
    setConfirmDialog({
      title: "Delete project?",
      description: `Permanently delete project "${name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        const resp = await fetch("/api/admin/projects", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (resp.ok) {
          await mutateProjects();
        } else {
          const json = await resp.json();
          showToast(json.error || "Failed to delete project", 5000);
        }
      },
    });
  }

  // Requester helpers
  async function addRequester() {
    setRequesterError("");
    setInviteSent("");
    if (!newRequester.name.trim() || !newRequester.email.trim()) {
      setRequesterError("Name and email are required");
      return;
    }
    setRequesterLoading(true);
    const invitedEmail = newRequester.email.trim();
    const resp = await fetch("/api/admin/requesters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRequester),
    });
    const json = await resp.json();
    if (!resp.ok) {
      setRequesterError(json.error);
    } else {
      setNewRequester({ name: "", email: "" });
      setInviteSent(`Invite sent to ${invitedEmail}. They set their own password via the email link.`);
      await mutateRequesters();
    }
    setRequesterLoading(false);
  }

  function deleteRequester(id: number, email: string, name: string) {
    setConfirmDialog({
      title: "Delete user?",
      description: `Delete user "${name}" (${email})? This removes their login and requester record.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        await fetch("/api/admin/requesters", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, email }),
        });
        await mutateRequesters();
      },
    });
  }

  if (loading) {
    return (
      <>
        <SiteHeader actions={[]} />
        <main className="mx-auto max-w-6xl p-4 md:p-6">
          <Card>
            <CardContent className="space-y-4 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-24" />)}
              </div>
              <Skeleton className="h-9 w-full max-w-xs" />
            </div>
            <div className="rounded-md border divide-y">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-none" />)}
            </div>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const userNode = user ? (
    <div className="mr-1 hidden items-center gap-2 sm:flex">
      {user.avatar_url && (
        <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full border" />
      )}
      <span className="text-sm text-muted-foreground">{user.name}</span>
    </div>
  ) : undefined;

  return (
    <>
      <SiteHeader
        subtitle="Admin"
        user={userNode}
        actions={[
          { label: "Back", icon: ArrowLeft, href: "/reimbursement" },
          { label: "Password", icon: KeyRound, href: "/account", variant: "outline" },
          { label: "Sign out", icon: LogOut, onClick: handleSignOut, variant: "outline" },
        ]}
      />

      <main className="mx-auto max-w-6xl p-4 md:p-6">
        <Tabs value={adminTab} onValueChange={(v) => setAdminTab(v as AdminTab)}>
          <TabsList>
            <TabsTrigger value="reimbursements"><Receipt className="h-4 w-4" /> Reimbursements</TabsTrigger>
            <TabsTrigger value="projects"><FolderKanban className="h-4 w-4" /> Projects</TabsTrigger>
            <TabsTrigger value="requesters"><Users className="h-4 w-4" /> Users</TabsTrigger>
          </TabsList>

          {/* ===== Reimbursements Tab ===== */}
          <TabsContent value="reimbursements">
            <Card>
            <CardContent className="space-y-4 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1">
                {(["Unprocessed", "Processed", "All"] as StatusFilter[]).map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={statusFilter === t ? "default" : "outline"}
                    onClick={() => { setStatusFilter(t); setPage(0); }}
                  >
                    {t} ({statusCounts[t]})
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}
                >
                  <SelectTrigger className="h-9 w-18">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  placeholder="Search by name, project, description, group ID…"
                  value={searchInput}
                  onChange={(e) => { setSearchInput(e.target.value); setPage(0); }}
                  className="w-full sm:w-80"
                />
              </div>
            </div>

            <div className="overflow-auto rounded-md border">
              <Table className="min-w-180 table-fixed">
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Group ID</TableHead>
                    <TableHead className="w-36">Submitted</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead className="w-36 text-right">Approved Total</TableHead>
                    <TableHead className="w-24 text-right">Items</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No reimbursements found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paged.map((g) => {
                      const isExpanded = expandedGroups.has(g.id);
                      const approvedTotal = g.reimbursements
                        .filter((r) => r.status === "Approved")
                        .reduce((s, r) => s + r.amount, 0);

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
                            <TableCell className="font-medium">{g.requester}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {approvedTotal > 0 ? formatAmount(approvedTotal) : "-"}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {g.reimbursements.length}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteGroup(g)}
                                title="Delete group"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={7} className="p-0">
                                <AdminItemDetails
                                  items={g.reimbursements}
                                  onApprove={(item) => openReview(item, "Approved")}
                                  onReject={(item) => openReview(item, "Rejected")}
                                />
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

            <div className="flex flex-wrap items-center justify-between gap-3">
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
            </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Projects Tab ===== */}
          <TabsContent value="projects">
            <Card>
              <CardHeader className="p-4 pb-0 md:p-6 md:pb-0">
                <CardTitle>Projects</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Add new projects or deactivate existing ones. Inactive projects won&apos;t appear in the form dropdown.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 md:p-6 md:pt-0">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="New project name…"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addProject()}
                  />
                  <Button onClick={addProject}><Plus size={14} /> Add</Button>
                </div>

                <div className="flex items-center gap-2">
                  <Switch id="only-active" checked={onlyActiveProjects} onCheckedChange={setOnlyActiveProjects} />
                  <Label htmlFor="only-active" className="text-sm font-normal text-muted-foreground">
                    Only active projects
                  </Label>
                </div>

                <div className="divide-y rounded-md border">
                  {projects
                    .filter((p) => !onlyActiveProjects || p.is_active)
                    .map((p) => (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between px-4 py-2.5 ${!p.is_active ? "opacity-50" : ""}`}
                      >
                        <span className="font-medium">{p.name}</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{p.is_active ? "Active" : "Inactive"}</span>
                            <Switch
                              checked={p.is_active}
                              onCheckedChange={(v) => toggleProject(p.id, v)}
                            />
                          </div>
                          {usedProjectNames.has(p.name) ? (
                            <span className="w-7 text-center text-xs text-muted-foreground" title="In use by reimbursements — cannot delete">—</span>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteProject(p.id, p.name)}
                              title="Delete project"
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  {projects.filter((p) => !onlyActiveProjects || p.is_active).length === 0 && (
                    <p className="px-4 py-3 text-sm text-muted-foreground">
                      {onlyActiveProjects ? "No active projects." : "No projects yet."}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Users Tab ===== */}
          <TabsContent value="requesters">
            <Card>
              <CardHeader className="p-4 pb-0 md:p-6 md:pb-0">
                <CardTitle>Users</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Invite team members by email. They get a link to set their own password. They must be added here before they can use the app.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 md:p-6 md:pt-0">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="rq-name">Display Name</Label>
                    <Input
                      id="rq-name"
                      type="text"
                      placeholder="e.g. Bintang"
                      value={newRequester.name}
                      onChange={(e) => setNewRequester((r) => ({ ...r, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rq-email">Email</Label>
                    <Input
                      id="rq-email"
                      type="email"
                      placeholder="e.g. bintang@murka.id"
                      value={newRequester.email}
                      onChange={(e) => setNewRequester((r) => ({ ...r, email: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && addRequester()}
                    />
                  </div>
                </div>
                {requesterError && <p className="text-sm text-destructive">{requesterError}</p>}
                {inviteSent && <p className="text-sm font-medium text-emerald-600">{inviteSent}</p>}
                <Button onClick={addRequester} disabled={requesterLoading}>
                  <Plus size={14} /> {requesterLoading ? "Inviting…" : "Invite User"}
                </Button>

                <div className="divide-y rounded-md border">
                  {requesters.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-sm text-muted-foreground">{r.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.is_admin ? (
                          <Badge variant="secondary">Admin</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteRequester(r.id, r.email, r.name)}
                          >
                            <XIcon size={14} /> Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Review modal */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewAction === "Approved" ? "Approve" : "Reject"} Item</DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{reviewTarget.project}</p>
              {reviewTarget.description && <p className="text-muted-foreground">{reviewTarget.description}</p>}
              <p className="mt-1 font-mono font-semibold">{formatAmount(reviewTarget.amount)}</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="review-msg">Message (optional)</Label>
            <Textarea
              id="review-msg"
              rows={3}
              value={reviewMessage}
              onChange={(e) => setReviewMessage(e.target.value)}
              placeholder={reviewAction === "Rejected" ? "Reason for rejection…" : "Notes (optional)…"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)} disabled={reviewLoading}>
              Cancel
            </Button>
            <Button
              className={reviewAction === "Approved" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              variant={reviewAction === "Rejected" ? "destructive" : "default"}
              onClick={submitReview}
              disabled={reviewLoading}
            >
              {reviewLoading ? "Processing…" : reviewAction === "Approved" ? "Confirm Approve" : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const action = confirmDialog?.onConfirm;
                setConfirmDialog(null);
                action?.();
              }}
            >
              {confirmDialog?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toast message={toastMsg} />
    </>
  );
}
