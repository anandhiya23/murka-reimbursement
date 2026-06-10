"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  LogOut,
  ArrowLeft,
  Check,
  XIcon,
  ExternalLink,
  Plus,
  ToggleLeft,
  ToggleRight,
  Receipt,
  FolderKanban,
  Users,
  Trash2,
  ChevronRight,
  Menu,
  X,
  Mail,
  AlertCircle,
  KeyRound,
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

function AdminCollapsibleItems({
  items,
  isOpen,
  onApprove,
  onReject,
}: {
  items: ReimbursementItem[];
  isOpen: boolean;
  onApprove: (item: ReimbursementItem) => void;
  onReject: (item: ReimbursementItem) => void;
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
          <div className="col col-actions"></div>
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
                  {item.review_message && <> &mdash; &quot;{item.review_message}&quot;</>}
                </span>
              )}
            </div>
            <div className="col col-date">{formatDate(item.expense_date)}</div>
            <div className="col col-files">
              {item.proof_files?.length > 0
                ? item.proof_files.map((f) => (
                    <a key={f.id} href={f.public_url} target="_blank" rel="noopener noreferrer" className="proof-link">
                      <ExternalLink size={12} /> <span className="proof-name">{f.file_name}</span>
                    </a>
                  ))
                : item.proof_url ? (
                  <a href={item.proof_url} target="_blank" rel="noopener noreferrer" className="proof-link">
                    <ExternalLink size={12} /> View
                  </a>
                ) : null}
            </div>
            <div className="col col-amount sub-amount">{formatAmount(item.amount)}</div>
            <div className="col col-status">
              <span className={`approvalStatus ${item.status.toLowerCase()}`}>{item.status}</span>
            </div>
            <div className="col col-actions" onClick={(e) => e.stopPropagation()}>
              {item.status === "Pending" ? (
                <>
                  <button className="btn-approve" onClick={() => onApprove(item)}>
                    <Check size={14} />
                  </button>
                  <button className="btn-reject" onClick={() => onReject(item)}>
                    <XIcon size={14} />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type AdminTab = "reimbursements" | "projects" | "requesters";
type StatusFilter = "Unprocessed" | "Processed" | "All";

export default function AdminPage() {
  const { message: toastMsg, show: showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>("reimbursements");
  const [menuOpen, setMenuOpen] = useState(false);

  // Reimbursements state
  const [groups, setGroups] = useState<ReimbursementGroup[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Unprocessed");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [reviewTarget, setReviewTarget] = useState<ReimbursementItem | null>(null);
  const [reviewAction, setReviewAction] = useState<"Approved" | "Rejected">("Approved");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  // Toast notifications
  interface Toast { id: number; type: "info" | "success" | "error"; message: string; }
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  function addToast(type: Toast["type"], message: string) {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }

  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState("");

  // Requesters state
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [newRequester, setNewRequester] = useState({ name: "", email: "" });
  const [inviteSent, setInviteSent] = useState("");
  const [requesterError, setRequesterError] = useState("");
  const [requesterLoading, setRequesterLoading] = useState(false);

  async function loadData() {
    const json = await fetch("/api/admin/init").then((res) => res.json());
    if (json.error) {
      window.location.href = "/login";
      return;
    }
    if (!json.user.isAdmin) {
      window.location.href = "/";
      return;
    }
    setUser(json.user);
    setGroups(json.groups as ReimbursementGroup[]);
    setLoading(false);
  }

  async function loadProjects() {
    const data = await fetch("/api/admin/projects").then((res) => res.json());
    if (Array.isArray(data)) setProjects(data);
  }

  async function loadRequesters() {
    const data = await fetch("/api/admin/requesters").then((res) => res.json());
    if (Array.isArray(data)) setRequesters(data);
  }

  useEffect(() => {
    loadData();
    loadProjects();
    loadRequesters();
  }, []);

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
    const unprocessed = groups.filter((g) =>
      g.reimbursements.some((r) => r.status === "Pending")
    );
    const processed = groups.filter((g) =>
      g.reimbursements.every((r) => r.status !== "Pending")
    );

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

  function toggleExpand(groupId: number) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
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
      await loadData();
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

  async function deleteGroup(group: ReimbursementGroup) {
    const totalAmount = group.reimbursements.reduce((s, r) => s + r.amount, 0);
    if (
      !confirm(
        `Delete entire group ${group.group_code} from ${group.requester} (${group.reimbursements.length} items, ${formatAmount(totalAmount)})?`
      )
    )
      return;
    await fetch("/api/admin/review", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: group.id }),
    });
    await loadData();
  }

  async function notifyRequester(group: ReimbursementGroup) {
    const resp = await fetch("/api/admin/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: group.id }),
    });
    if (resp.ok) {
      await loadData();
    } else {
      const json = await resp.json();
      alert("Failed to notify: " + json.error);
    }
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
    await loadProjects();
  }

  async function toggleProject(id: number, is_active: boolean) {
    await fetch("/api/admin/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id, is_active }),
    });
    await loadProjects();
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
      await loadRequesters();
    }
    setRequesterLoading(false);
  }

  async function deleteRequester(id: number, email: string, name: string) {
    if (!confirm(`Delete user "${name}" (${email})? This removes their login and requester record.`)) return;
    await fetch("/api/admin/requesters", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, email }),
    });
    await loadRequesters();
  }


  if (loading) {
    return (
      <div className="login-container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="header-bar">
        <div className="header-left">
          <img src="/murka-logo.svg" alt="Murka" className="header-logo" />
          <div className="admin-nav desktop-only">
            <button
              className={`admin-nav-tab ${adminTab === "reimbursements" ? "active" : ""}`}
              onClick={() => setAdminTab("reimbursements")}
            >
              <Receipt size={16} /> Reimbursements
            </button>
            <button
              className={`admin-nav-tab ${adminTab === "projects" ? "active" : ""}`}
              onClick={() => setAdminTab("projects")}
            >
              <FolderKanban size={16} /> Projects
            </button>
            <button
              className={`admin-nav-tab ${adminTab === "requesters" ? "active" : ""}`}
              onClick={() => setAdminTab("requesters")}
            >
              <Users size={16} /> Users
            </button>
          </div>
        </div>
        {user && (
          <>
            <button className="burger-btn" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className={`header-menu ${menuOpen ? "open" : ""}`}>
              <div className="admin-nav mobile-only">
                <button
                  className={`admin-nav-tab ${adminTab === "reimbursements" ? "active" : ""}`}
                  onClick={() => { setAdminTab("reimbursements"); setMenuOpen(false); }}
                >
                  <Receipt size={16} /> Reimbursements
                </button>
                <button
                  className={`admin-nav-tab ${adminTab === "projects" ? "active" : ""}`}
                  onClick={() => { setAdminTab("projects"); setMenuOpen(false); }}
                >
                  <FolderKanban size={16} /> Projects
                </button>
                <button
                  className={`admin-nav-tab ${adminTab === "requesters" ? "active" : ""}`}
                  onClick={() => { setAdminTab("requesters"); setMenuOpen(false); }}
                >
                  <Users size={16} /> Users
                </button>
              </div>
              <div className="header-menu-user">
                <a href="/reimbursement" className="admin-link">
                  <ArrowLeft size={14} /> Back
                </a>
                {user.avatar_url && (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="header-avatar"
                    referrerPolicy="no-referrer"
                  />
                )}
                <span>
                  {user.name} ({user.email})
                </span>
                <a href="/account" className="admin-link">
                  <KeyRound size={14} /> Password
                </a>
                <button type="button" className="sign-out-btn" onClick={handleSignOut}>
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ===== Reimbursements Tab ===== */}
      {adminTab === "reimbursements" && (
        <div className="admin-container">
          <div className="admin-tabs">
            {(["Unprocessed", "Processed", "All"] as StatusFilter[]).map((t) => (
              <button
                key={t}
                className={`admin-tab ${statusFilter === t ? "active" : ""}`}
                onClick={() => setStatusFilter(t)}
              >
                {t} ({statusCounts[t]})
              </button>
            ))}
          </div>

          <div className="admin-search">
            <input
              type="text"
              placeholder="Search by name, project, description, group ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="list-scroll-inner">
          {/* Header */}
          <div className="list-header">
            <div className="col col-chevron"></div>
            <div className="col col-name">Group ID</div>
            <div className="col col-date">Submitted</div>
            <div className="col col-files">Requester</div>
            <div className="col col-amount">Approved Total</div>
            <div className="col col-status">Items</div>
            <div className="col col-actions"></div>
          </div>

          {/* Rows */}
          <div className="list-body">
            {filtered.length === 0 ? (
              <div className="list-empty">No reimbursements found</div>
            ) : (
              filtered.map((g) => {
                const isExpanded = expandedGroups.has(g.id);
                const approvedTotal = g.reimbursements
                  .filter((r) => r.status === "Approved")
                  .reduce((s, r) => s + r.amount, 0);

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
                        <strong>{g.requester}</strong>
                      </div>
                      <div className="col col-amount">
                        {approvedTotal > 0 ? formatAmount(approvedTotal) : "-"}
                      </div>
                      <div className="col col-status">
                        {g.reimbursements.length} item{g.reimbursements.length !== 1 ? "s" : ""}
                      </div>
                      <div className="col col-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="btn-delete" onClick={() => deleteGroup(g)} title="Delete group">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <AdminCollapsibleItems
                      items={g.reimbursements}
                      isOpen={isExpanded}
                      onApprove={(item) => openReview(item, "Approved")}
                      onReject={(item) => openReview(item, "Rejected")}
                    />
                  </div>
                );
              })
            )}
          </div>
          </div>
        </div>
      )}

      {/* ===== Projects Tab ===== */}
      {adminTab === "projects" && (
        <div className="admin-container">
          <h2>Projects</h2>
          <p className="admin-subtitle">Add new projects or deactivate existing ones. Inactive projects won&apos;t appear in the form dropdown.</p>

          <div className="project-add">
            <input
              type="text"
              placeholder="New project name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addProject()}
            />
            <button className="btn-primary" onClick={addProject}>
              <Plus size={14} /> Add
            </button>
          </div>

          <div className="project-list">
            {projects.map((p) => (
              <div key={p.id} className={`project-item ${!p.is_active ? "inactive" : ""}`}>
                <span>{p.name}</span>
                <button
                  className={p.is_active ? "btn-reject" : "btn-approve"}
                  onClick={() => toggleProject(p.id, !p.is_active)}
                >
                  {p.is_active ? (
                    <><ToggleRight size={14} /> Deactivate</>
                  ) : (
                    <><ToggleLeft size={14} /> Activate</>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Requesters/Users Tab ===== */}
      {adminTab === "requesters" && (
        <div className="admin-container">
          <h2>Users</h2>
          <p className="admin-subtitle">Invite team members by email. They get a link to set their own password. They must be added here before they can use the app.</p>

          <div className="requester-add">
            <div className="requester-add-fields">
              <div>
                <label>Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bintang"
                  value={newRequester.name}
                  onChange={(e) => setNewRequester((r) => ({ ...r, name: e.target.value }))}
                />
              </div>
              <div>
                <label>Email</label>
                <input
                  type="email"
                  placeholder="e.g. bintang@murka.id"
                  value={newRequester.email}
                  onChange={(e) => setNewRequester((r) => ({ ...r, email: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && addRequester()}
                />
              </div>
            </div>
            {requesterError && <p className="login-error">{requesterError}</p>}
            {inviteSent && <p className="login-success">{inviteSent}</p>}
            <button className="btn-primary" onClick={addRequester} disabled={requesterLoading}>
              <Plus size={14} /> {requesterLoading ? "Inviting..." : "Invite User"}
            </button>
          </div>

          <div className="project-list" style={{ marginTop: "1.5em" }}>
            {requesters.map((r) => (
              <div key={r.id} className="project-item">
                <div>
                  <strong>{r.name}</strong>
                  <span className="requester-email">{r.email}</span>
                </div>
                <div className="admin-actions">
                  {r.is_admin && <span className="header-badge">Admin</span>}
                  {!r.is_admin && (
                    <button
                      className="btn-reject"
                      onClick={() => deleteRequester(r.id, r.email, r.name)}
                    >
                      <XIcon size={14} /> Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              {t.type === "success" ? <Mail size={15} /> : <AlertCircle size={15} />}
              <span>{t.message}</span>
              <button className="toast-close" onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Review modal */}
      {reviewTarget && (
        <div className="modal-overlay" onClick={() => setReviewTarget(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{reviewAction === "Approved" ? "Approve" : "Reject"} Item</h3>
            <div className="modal-details">
              <p><strong>{reviewTarget.project}</strong></p>
              <p>{reviewTarget.description}</p>
              <p className="detail-amount">{formatAmount(reviewTarget.amount)}</p>
            </div>

            <label>Message (optional)</label>
            <textarea
              rows={3}
              value={reviewMessage}
              onChange={(e) => setReviewMessage(e.target.value)}
              placeholder={reviewAction === "Rejected" ? "Reason for rejection..." : "Notes (optional)..."}
            />

            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setReviewTarget(null)} disabled={reviewLoading}>
                Cancel
              </button>
              <button
                className={reviewAction === "Approved" ? "btn-approve" : "btn-reject"}
                onClick={submitReview}
                disabled={reviewLoading}
              >
                {reviewLoading ? "Processing..." : reviewAction === "Approved" ? "Confirm Approve" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast message={toastMsg} />
    </>
  );
}
