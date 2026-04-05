"use client";

import { useState, useEffect, useRef } from "react";
import Select from "react-select";
import ExpenseItem from "./components/ExpenseItem";
import ReimbursementTable from "./components/ReimbursementTable";
import { createClient } from "@/utils/supabase/client";
import { LogOut, Plus, ShieldCheck, Send, Menu, X } from "lucide-react";

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

interface ReimbursementGroup {
  id: number;
  group_code: string;
  requester: string;
  requester_email: string;
  approver: string;
  created_at: string;
  reimbursements: {
    id: number;
    project: string;
    expense_date: string;
    description: string;
    amount: number;
    status: string;
    proof_url: string;
    proof_files: { id: number; file_name: string; public_url: string }[];
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_message: string | null;
  }[];
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
  const [unregistered, setUnregistered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [approverOptions, setApproverOptions] = useState<Option[]>([]);
  const [projectOptions, setProjectOptions] = useState<Option[]>([]);

  const [approver, setApprover] = useState<Option | null>(null);

  const [items, setItems] = useState<ExpenseItemData[]>([{ ...emptyItem }]);
  const fileInputsRef = useRef<Map<number, FileList>>(new Map());

  const [groups, setGroups] = useState<ReimbursementGroup[]>([]);

  async function loadData() {
    try {
      const json = await fetch("/api/init").then((res) => res.json());

      if (json.error === "Unauthorized") {
        window.location.href = "/login";
        return;
      }
      if (json.error === "Unregistered") {
        setUnregistered(true);
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
      setGroups((json.groups as ReimbursementGroup[]).reverse());
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
      const json = await resp.json();
      setStatus("Submitted successfully!");
      setItems([{ ...emptyItem }]);
      fileInputsRef.current.clear();
      setApprover(savedApprover);

      if (json.group) {
        setGroups((prev) => [json.group as ReimbursementGroup, ...prev]);
      }
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

  function formatAmount(amount: number): string {
    return "Rp" + amount.toLocaleString("id-ID");
  }

  if (unregistered) {
    return (
      <div className="login-container">
        <div className="login-card" style={{ textAlign: "center" }}>
          <img src="/murka-logo-dark.svg" alt="Murka" className="login-logo" />
          <h2 style={{ marginBottom: "0.4em" }}>Access Restricted</h2>
          <p style={{ marginBottom: "1.5em" }}>
            Your account is not registered as a requester.
            <br />
            Contact an admin to get access.
          </p>
          <button type="button" className="sign-out-btn" style={{ width: "100%", justifyContent: "center" }} onClick={handleSignOut}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="header-bar">
        <img src="/murka-logo.svg" alt="Murka" className="header-logo" />
        {user && (
          <>
            <button className="burger-btn" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className={`header-user ${menuOpen ? "open" : ""}`}>
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
          </>
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
                <span className="total-amount">
                  {formatAmount(totalAmount)}
                </span>
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

            <button type="submit">
              <Send size={16} /> Submit
            </button>
          </form>
          <div id="status">{status}</div>
        </div>

        <div className="right-column">
          <ReimbursementTable groups={groups} />
        </div>
      </div>
    </>
  );
}
