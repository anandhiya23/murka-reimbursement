"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import EventidHeader from "@/app/components/EventidHeader";
import { Plus, Link2, Copy, Trash2, UserPlus, X, Mail } from "lucide-react";

interface Division { id: number; name: string; public_token: string | null; }
interface Pic { id: number; division_id: number; email: string; }

export default function EventDetailPage() {
  const params = useParams();
  const eventId = Number(params.eventId);

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [picsByDiv, setPicsByDiv] = useState<Record<number, Pic[]>>({});
  const [newDivision, setNewDivision] = useState("");
  const [assignEmail, setAssignEmail] = useState<Record<number, string>>({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDivs, setInviteDivs] = useState<number[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/eventid/divisions?eventId=${eventId}`);
    if (res.status === 403) { window.location.href = "/eventid"; return; }
    const divs: Division[] = await res.json();
    setDivisions(Array.isArray(divs) ? divs : []);
    const entries = await Promise.all(
      (divs ?? []).map(async (d) => {
        const r = await fetch(`/api/eventid/pics?divisionId=${d.id}`);
        const pics = r.ok ? await r.json() : [];
        return [d.id, pics] as const;
      })
    );
    setPicsByDiv(Object.fromEntries(entries));
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  async function addDivision() {
    if (!newDivision.trim()) return;
    await fetch("/api/eventid/divisions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId, name: newDivision }),
    });
    setNewDivision(""); await load();
  }

  async function delDivision(id: number) {
    if (!confirm("Delete this division and all its requests?")) return;
    await fetch("/api/eventid/divisions", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function genDivLink(id: number) {
    await fetch("/api/eventid/divisions", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "generate_token" }),
    });
    await load();
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/eventid/apply/${token}`);
    setMsg("Link copied");
  }

  async function assignPic(divisionId: number) {
    const email = assignEmail[divisionId]?.trim();
    if (!email) return;
    const res = await fetch("/api/eventid/pics", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ division_id: divisionId, email }),
    });
    if (res.ok) { setAssignEmail((s) => ({ ...s, [divisionId]: "" })); await load(); }
    else setMsg((await res.json()).error);
  }

  async function removePic(divisionId: number, email: string) {
    await fetch("/api/eventid/pics", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ division_id: divisionId, email }),
    });
    await load();
  }

  async function invitePic() {
    if (!inviteEmail.trim()) { setMsg("Email required"); return; }
    const res = await fetch("/api/eventid/pics/invite", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, division_ids: inviteDivs }),
    });
    const json = await res.json();
    if (!res.ok) setMsg(json.error);
    else {
      setMsg(json.alreadyExists
        ? `${inviteEmail} already had an account — assigned as PIC.`
        : `Invite sent to ${inviteEmail}.`);
      setInviteEmail(""); setInviteDivs([]); await load();
    }
  }

  return (
    <>
      <EventidHeader subtitle="Manage Event" />
      <div className="admin-container">
        <a href="/eventid/events" className="admin-link" style={{ marginBottom: "1em", display: "inline-flex" }}>← Back to events</a>
        {msg && <p className="login-success">{msg}</p>}

        <h2>Divisions</h2>
        <div className="project-add">
          <input value={newDivision} onChange={(e) => setNewDivision(e.target.value)}
            placeholder="New division name..." onKeyDown={(e) => e.key === "Enter" && addDivision()} />
          <button className="btn-primary" onClick={addDivision}><Plus size={14} /> Add</button>
        </div>

        <div className="project-list" style={{ marginTop: "1em" }}>
          {divisions.map((d) => (
            <div key={d.id} className="eventid-division-block">
              <div className="project-item" style={{ border: "none", padding: 0 }}>
                <strong>{d.name}</strong>
                <div className="admin-actions" style={{ flexWrap: "wrap" }}>
                  {d.public_token ? (
                    <button className="btn-secondary" onClick={() => copyLink(d.public_token!)}>
                      <Copy size={14} /> PIC link
                    </button>
                  ) : (
                    <button className="btn-secondary" onClick={() => genDivLink(d.id)}>
                      <Link2 size={14} /> Generate link
                    </button>
                  )}
                  <a className="btn-secondary" href={`/eventid/divisions/${d.id}`}>Requests</a>
                  <button className="btn-reject" onClick={() => delDivision(d.id)}><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="eventid-pics">
                <span className="eventid-pics-label">PICs:</span>
                {(picsByDiv[d.id] ?? []).map((p) => (
                  <span key={p.id} className="eventid-pic-chip">
                    {p.email}
                    <button onClick={() => removePic(d.id, p.email)}><X size={11} /></button>
                  </span>
                ))}
                <div className="eventid-pic-assign">
                  <input placeholder="existing user email"
                    value={assignEmail[d.id] ?? ""}
                    onChange={(e) => setAssignEmail((s) => ({ ...s, [d.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && assignPic(d.id)} />
                  <button className="btn-secondary" onClick={() => assignPic(d.id)}><UserPlus size={13} /> Assign</button>
                </div>
              </div>
            </div>
          ))}
          {divisions.length === 0 && <p className="admin-subtitle">No divisions yet.</p>}
        </div>

        <h2 style={{ marginTop: "1.5em" }}>Invite new PIC</h2>
        <p className="admin-subtitle">Sends an email invite. They set their own password, then can manage the divisions you select.</p>
        <div className="requester-add">
          <div>
            <label>Email</label>
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="pic@example.com" />
          </div>
          <label style={{ marginTop: "0.75em" }}>Assign to divisions</label>
          <div className="eventid-div-checks">
            {divisions.map((d) => (
              <label key={d.id} className="eventid-check">
                <input type="checkbox" checked={inviteDivs.includes(d.id)}
                  onChange={(e) => setInviteDivs((s) => e.target.checked ? [...s, d.id] : s.filter((x) => x !== d.id))} />
                {d.name}
              </label>
            ))}
          </div>
          <button className="btn-primary" onClick={invitePic} style={{ marginTop: "0.75em" }}>
            <Mail size={14} /> Send Invite
          </button>
        </div>
      </div>
    </>
  );
}
