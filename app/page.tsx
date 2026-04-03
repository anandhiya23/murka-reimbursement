"use client";

import { useState, useEffect, useRef } from "react";
import Select from "react-select";
import ExpenseItem from "./components/ExpenseItem";
import ReimbursementTable from "./components/ReimbursementTable";
import { createClient } from "@/utils/supabase/client";
import { LogOut, Plus, ShieldCheck, Send, X } from "lucide-react";
import { formatDate } from "@/lib/format";

interface Option {
  value: string;
  label: string;
}

interface ExpenseItemData {
  project: string;
  expenseDate: string;
  description: string;
  amount: string;
  files: FileList | null;
}

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

const emptyItem: ExpenseItemData = {
  project: "",
  expenseDate: "",
  description: "",
  amount: "",
  files: null,
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [user, setUser] = useState<UserInfo | null>(null);

  const [approverOptions, setApproverOptions] = useState<Option[]>([]);
  const [projectOptions, setProjectOptions] = useState<Option[]>([]);

  const [approver, setApprover] = useState<Option | null>(null);

  const [items, setItems] = useState<ExpenseItemData[]>([{ ...emptyItem }]);
  const fileInputsRef = useRef<Map<number, FileList>>(new Map());

  const [tableRows, setTableRows] = useState<ReimbursementRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<ReimbursementRow | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  async function loadData() {
    try {
      const json = await fetch("/api/init").then((res) => res.json());

      if (json.error === "Unauthorized") {
        window.location.href = "/login";
        return;
      }
      if (json.error === "Unregistered") {
        setUser({ email: "", name: "", avatar_url: null, isAdmin: false });
        setStatus(json.message);
        setLoading(false);
        return;
      }

      setUser(json.user);

      setApproverOptions(
        (json.approvers as string[]).map((n) => ({ value: n, label: n }))
      );
      setProjectOptions(
        (json.projects as string[]).map((n) => ({ value: n, label: n }))
      );

      setTableRows((json.reimbursements as ReimbursementRow[]).reverse());

      setLoading(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus("Error loading: " + message);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function handleItemChange(index: number, data: ExpenseItemData) {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  }

  function handleFilesChange(index: number, files: FileList | null) {
    if (files) {
      fileInputsRef.current.set(index, files);
    }
  }

  function addItem() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
    fileInputsRef.current.delete(index);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("Uploading...");

    const savedApprover = approver;

    const fd = new FormData();
    fd.append("approver", approver?.value || "");
    fd.append("idemKey", crypto.randomUUID());

    const itemsPayload = items.map((item, idx) => {
      const files = fileInputsRef.current.get(idx);
      if (files) {
        for (const f of Array.from(files)) {
          fd.append(`items[${idx}]files`, f);
        }
      }
      return {
        project: item.project,
        expenseDate: item.expenseDate,
        description: item.description,
        amount: Number(item.amount.replace(/[^\d-]/g, "")) || 0,
        index: idx,
        fileCount: files?.length || 0,
      };
    });

    fd.append("items", JSON.stringify(itemsPayload));

    try {
      const resp = await fetch("/api/postreimburse", {
        method: "POST",
        body: fd,
      });
      await resp.json();

      setStatus("Submitted successfully!");

      setItems([{ ...emptyItem }]);
      fileInputsRef.current.clear();
      setApprover(savedApprover);

      // Refresh table
      const json = await fetch("/api/init").then((res) => res.json());
      setTableRows((json.reimbursements as ReimbursementRow[]).reverse());

      setLoading(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus("Error: " + message);
      setLoading(false);
    }
  }

  const totalAmount = items.reduce((sum, item) => {
    const digits = item.amount.replace(/[^\d]/g, "");
    return sum + (digits ? parseInt(digits, 10) : 0);
  }, 0);

  function isOwnRow(row: ReimbursementRow): boolean {
    return user?.name === row.requester;
  }

  function formatAmount(amount: number): string {
    return "Rp" + amount.toLocaleString("id-ID");
  }

  return (
    <>
      {/* Header bar */}
      <div className="header-bar">
        <img src="/murka-logo.svg" alt="Murka" className="header-logo"/>
        {user && (
          <div className="header-user">
            {user.isAdmin && (
              <a href="/admin" className="admin-link">
                <ShieldCheck size={14} /> Admin
              </a>
            )}
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
            <button
              type="button"
              className="sign-out-btn"
              onClick={handleSignOut}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>

      <div className="main-grid">
        <div className="container">
          <h2>New Reimbursement</h2>
          <p className="requester-info">
            Submitting as: <strong>{user?.name || "..."}</strong>
          </p>
          <form
            id="reimbursementForm"
            className={loading ? "loading" : ""}
            onSubmit={handleSubmit}
          >
            <div id="items">
              {items.map((item, idx) => (
                <ExpenseItem
                  key={idx}
                  index={idx}
                  data={item}
                  projectOptions={projectOptions}
                  showRemove={items.length > 1}
                  onChange={handleItemChange}
                  onRemove={removeItem}
                  onFilesChange={handleFilesChange}
                />
              ))}
            </div>

            <button type="button" className="add-item-btn" onClick={addItem}>
              <Plus size={16} /> Add another expense
            </button>

            {totalAmount > 0 && (
              <div className="total-bar">
                <span>Total</span>
                <span className="total-amount">{formatAmount(totalAmount)}</span>
              </div>
            )}

            <label>Approver</label>
            <Select
              instanceId="approver"
              options={approverOptions}
              value={approver}
              onChange={setApprover}
              placeholder="Select..."
              isDisabled={loading}
              classNamePrefix="react-select"
            />

            <button type="submit"><Send size={16} /> Submit</button>
          </form>
          <div id="status">{status}</div>
        </div>

        <div className="right-column">
          <ReimbursementTable
            rows={tableRows}
            userRequesterName={user?.name}
            onRowClick={(row) =>
              isOwnRow(row)
                ? (() => {
                    setSelectedRow(row);
                    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
                  })()
                : undefined
            }
          />

          {selectedRow && (
            <div className="detail-panel" ref={detailRef}>
              <div className="detail-header">
                <h3>Reimbursement Detail</h3>
                <button
                  type="button"
                  className="detail-close"
                  onClick={() => setSelectedRow(null)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="detail-body">
                <div className="detail-row">
                  <span className="detail-label">Group ID</span>
                  <span>{selectedRow.group_id}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Submitted</span>
                  <span>
                    {new Date(selectedRow.created_at).toLocaleString("en-GB", {
                      timeZone: "Asia/Jakarta",
                    })}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Project</span>
                  <span>{selectedRow.project}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Expense Date</span>
                  <span>{formatDate(selectedRow.expense_date)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Description</span>
                  <span>{selectedRow.description || "-"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Amount</span>
                  <span className="detail-amount">
                    {formatAmount(selectedRow.amount)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Approver</span>
                  <span>{selectedRow.approver}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status</span>
                  <span
                    className={`approvalStatus ${selectedRow.status.toLowerCase()}`}
                  >
                    {selectedRow.status}
                  </span>
                </div>
                {selectedRow.reviewed_by && (
                  <>
                    <div className="detail-row">
                      <span className="detail-label">Reviewed by</span>
                      <span>{selectedRow.reviewed_by}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Reviewed at</span>
                      <span>
                        {new Date(selectedRow.reviewed_at!).toLocaleString(
                          "en-GB",
                          { timeZone: "Asia/Jakarta" }
                        )}
                      </span>
                    </div>
                  </>
                )}
                {selectedRow.review_message && (
                  <div className="detail-row">
                    <span className="detail-label">Message</span>
                    <span>{selectedRow.review_message}</span>
                  </div>
                )}
                {selectedRow.proof_files?.length > 0 ? (
                  <div className="detail-row">
                    <span className="detail-label">Proof Files</span>
                    <div className="detail-files">
                      {selectedRow.proof_files.map((f) => (
                        <a
                          key={f.id}
                          href={f.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {f.file_name}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : selectedRow.proof_url ? (
                  <div className="detail-row">
                    <span className="detail-label">Proof Files</span>
                    <a
                      href={selectedRow.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View file
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
