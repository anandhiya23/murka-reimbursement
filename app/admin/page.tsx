"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { formatDate } from "@/lib/format";

interface ReimbursementRow {
  id: number;
  created_at: string;
  requester: string;
  project: string;
  expense_date: string;
  description: string;
  amount: number;
  proof_url: string;
  approver: string;
  status: string;
  group_id: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_message: string | null;
  proof_files: { id: number; file_name: string; public_url: string }[];
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

type AdminTab = "reimbursements" | "projects" | "requesters";
type StatusFilter = "Pending" | "Approved" | "Rejected" | "All";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>("reimbursements");

  // Reimbursements state
  const [rows, setRows] = useState<ReimbursementRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Pending");
  const [search, setSearch] = useState("");
  const [reviewTarget, setReviewTarget] = useState<ReimbursementRow | null>(null);
  const [reviewAction, setReviewAction] = useState<"Approved" | "Rejected">("Approved");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState("");

  // Requesters state
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [newRequester, setNewRequester] = useState({ name: "", email: "", password: "" });
  const [requesterError, setRequesterError] = useState("");
  const [requesterLoading, setRequesterLoading] = useState(false);

  // Load data
  async function loadData() {
    const json = await fetch("/api/init").then((res) => res.json());
    if (json.error) {
      window.location.href = "/login";
      return;
    }
    if (!json.user.isAdmin) {
      window.location.href = "/";
      return;
    }
    setUser(json.user);
    setRows((json.reimbursements as ReimbursementRow[]).reverse());
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

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  // Reimbursement helpers
  const filtered = useMemo(() => {
    let result = rows;
    if (statusFilter !== "All") {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.requester.toLowerCase().includes(lower) ||
          r.project.toLowerCase().includes(lower) ||
          (r.description || "").toLowerCase().includes(lower) ||
          r.group_id.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [rows, statusFilter, search]);

  const statusCounts = {
    Pending: rows.filter((r) => r.status === "Pending").length,
    Approved: rows.filter((r) => r.status === "Approved").length,
    Rejected: rows.filter((r) => r.status === "Rejected").length,
    All: rows.length,
  };

  function openReview(row: ReimbursementRow, action: "Approved" | "Rejected") {
    setReviewTarget(row);
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
      setReviewTarget(null);
      await loadData();
    }
    setReviewLoading(false);
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
    if (!newRequester.name.trim() || !newRequester.email.trim() || !newRequester.password.trim()) {
      setRequesterError("All fields are required");
      return;
    }
    setRequesterLoading(true);
    const resp = await fetch("/api/admin/requesters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRequester),
    });
    const json = await resp.json();
    if (!resp.ok) {
      setRequesterError(json.error);
    } else {
      setNewRequester({ name: "", email: "", password: "" });
      await loadRequesters();
    }
    setRequesterLoading(false);
  }

  function formatAmount(amount: number): string {
    return "Rp" + amount.toLocaleString("id-ID");
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
          <div className="admin-nav">
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
          <div className="header-user">
            <a href="/" className="admin-link">
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
            <button type="button" className="sign-out-btn" onClick={handleSignOut}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>

      {/* ===== Reimbursements Tab ===== */}
      {adminTab === "reimbursements" && (
        <div className="admin-container">
          <div className="admin-tabs">
            {(["Pending", "Approved", "Rejected", "All"] as StatusFilter[]).map((t) => (
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="dt-layout-table">
            <table id="reimbursementTable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Requester</th>
                  <th>Project</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Proof</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center" }}>
                      No reimbursements found
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.expense_date)}</td>
                      <td>{r.requester}</td>
                      <td>{r.project}</td>
                      <td className="admin-desc">{r.description}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatAmount(r.amount)}</td>
                      <td>
                        {r.proof_files?.length > 0 ? (
                          <div className="detail-files">
                            {r.proof_files.map((f) => (
                              <a
                                key={f.id}
                                href={f.public_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="proof-link"
                              >
                                <ExternalLink size={14} /> {f.file_name}
                              </a>
                            ))}
                          </div>
                        ) : r.proof_url ? (
                          <a href={r.proof_url} target="_blank" rel="noopener noreferrer" className="proof-link">
                            <ExternalLink size={14} /> View
                          </a>
                        ) : null}
                      </td>
                      <td>
                        <span className={`approvalStatus ${r.status.toLowerCase()}`}>{r.status}</span>
                      </td>
                      <td className="admin-actions">
                        {r.status === "Pending" ? (
                          <>
                            <button className="btn-approve" onClick={() => openReview(r, "Approved")}>
                              <Check size={14} /> Approve
                            </button>
                            <button className="btn-reject" onClick={() => openReview(r, "Rejected")}>
                              <XIcon size={14} /> Reject
                            </button>
                          </>
                        ) : (
                          <span className="admin-reviewed-info">
                            {r.reviewed_by && (
                              <span>
                                by {r.reviewed_by}
                                {r.review_message && <> &mdash; &quot;{r.review_message}&quot;</>}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
          <p className="admin-subtitle">Create login accounts for team members. They must be added here before they can use the app.</p>

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
                />
              </div>
              <div>
                <label>Password</label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  value={newRequester.password}
                  onChange={(e) => setNewRequester((r) => ({ ...r, password: e.target.value }))}
                />
              </div>
            </div>
            {requesterError && <p className="login-error">{requesterError}</p>}
            <button className="btn-primary" onClick={addRequester} disabled={requesterLoading}>
              <Plus size={14} /> {requesterLoading ? "Creating..." : "Create User"}
            </button>
          </div>

          <div className="project-list" style={{ marginTop: "1.5em" }}>
            {requesters.map((r) => (
              <div key={r.id} className="project-item">
                <div>
                  <strong>{r.name}</strong>
                  <span className="requester-email">{r.email}</span>
                </div>
                {r.is_admin && <span className="header-badge">Admin</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewTarget && (
        <div className="modal-overlay" onClick={() => setReviewTarget(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{reviewAction === "Approved" ? "Approve" : "Reject"} Reimbursement</h3>
            <div className="modal-details">
              <p>
                <strong>{reviewTarget.requester}</strong> &mdash; {reviewTarget.project}
              </p>
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
    </>
  );
}
