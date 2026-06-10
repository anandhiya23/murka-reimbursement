"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import EventidHeader from "@/app/components/EventidHeader";
import { Plus, Copy, Check, X, Trash2, ExternalLink } from "lucide-react";

interface ReqRow {
  id: number;
  event_id: number;
  division_id: number;
  full_name: string;
  status: string;
  review_message: string | null;
  reviewed_by: string | null;
  photo_url: string | null;
  id_photo_url: string | null;
  created_at: string;
}
interface DivInfo { id: number; name: string; event_id: number; public_token: string | null; }

export default function DivisionPage() {
  const params = useParams();
  const divisionId = Number(params.divisionId);

  const [div, setDiv] = useState<DivInfo | null>(null);
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // new-request form
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const dRes = await fetch("/api/eventid/divisions");
    if (dRes.status === 403) { window.location.href = "/eventid"; return; }
    const divs: DivInfo[] = await dRes.json();
    const found = (divs ?? []).find((d) => d.id === divisionId) ?? null;
    setDiv(found);
    const rRes = await fetch(`/api/eventid/requests?divisionId=${divisionId}`);
    const data = await rRes.json();
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [divisionId]);

  useEffect(() => { load(); }, [load]);

  async function addRequest() {
    if (!div) return;
    if (!name.trim() || !photo || !idPhoto) { setMsg("Name, photo and ID photo required"); return; }
    setSaving(true);
    const fd = new FormData();
    fd.set("event_id", String(div.event_id));
    fd.set("division_id", String(divisionId));
    fd.set("full_name", name);
    fd.set("photo", photo);
    fd.set("id_photo", idPhoto);
    const res = await fetch("/api/eventid/requests", { method: "POST", body: fd });
    if (res.ok) { setName(""); setPhoto(null); setIdPhoto(null); setMsg("Added"); await load(); }
    else setMsg((await res.json()).error);
    setSaving(false);
  }

  async function review(id: number, action: "approve" | "reject") {
    const message = action === "reject" ? prompt("Reason (optional):") ?? undefined : undefined;
    await fetch("/api/eventid/requests", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, message }),
    });
    await load();
  }

  async function del(id: number) {
    if (!confirm("Delete this request?")) return;
    await fetch("/api/eventid/requests", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  function copyLink() {
    if (div?.public_token) {
      navigator.clipboard.writeText(`${window.location.origin}/eventid/apply/${div.public_token}`);
      setMsg("Public link copied");
    }
  }

  return (
    <>
      <EventidHeader subtitle={div?.name ?? "Division"} />
      <div className="admin-container">
        <a href="/eventid" className="admin-link" style={{ marginBottom: "1em", display: "inline-flex" }}>← Back</a>
        {div?.public_token && (
          <button className="btn-secondary" style={{ marginLeft: "0.5em" }} onClick={copyLink}>
            <Copy size={14} /> Public link
          </button>
        )}
        {msg && <p className="login-success">{msg}</p>}

        <h2>Add Request</h2>
        <div className="requester-add">
          <div className="requester-add-fields">
            <div>
              <label>Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Applicant name" />
            </div>
            <div>
              <label>Photo (portrait)</label>
              <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <label>Identification photo</label>
              <input type="file" accept="image/*" onChange={(e) => setIdPhoto(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <button className="btn-primary" onClick={addRequest} disabled={saving}>
            <Plus size={14} /> {saving ? "Saving..." : "Add Request"}
          </button>
        </div>

        <h2 style={{ marginTop: "1.5em" }}>Requests ({rows.length})</h2>
        {loading ? <p>Loading...</p> : rows.length === 0 ? (
          <p className="admin-subtitle">No requests yet.</p>
        ) : (
          <div className="project-list">
            {rows.map((r) => (
              <div key={r.id} className="project-item">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75em" }}>
                  {r.photo_url ? (
                    <img src={r.photo_url} alt="" className="eventid-thumb" />
                  ) : <div className="eventid-thumb eventid-thumb-empty" />}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2em" }}>
                    <strong>{r.full_name}</strong>
                    <span className={`approvalStatus ${r.status}`}>{r.status}</span>
                    {r.id_photo_url && (
                      <a href={r.id_photo_url} target="_blank" rel="noopener noreferrer" className="proof-link">
                        <ExternalLink size={12} /> ID photo
                      </a>
                    )}
                  </div>
                </div>
                <div className="admin-actions">
                  {r.status !== "approved" && (
                    <button className="btn-approve" onClick={() => review(r.id, "approve")}><Check size={14} /></button>
                  )}
                  {r.status !== "rejected" && (
                    <button className="btn-reject" onClick={() => review(r.id, "reject")}><X size={14} /></button>
                  )}
                  <button className="btn-reject" onClick={() => del(r.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
