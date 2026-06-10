"use client";

import { useState, useEffect } from "react";
import EventidHeader from "@/app/components/EventidHeader";
import { Plus, ToggleLeft, ToggleRight, Link2, ChevronRight, Copy } from "lucide-react";

interface EventRow {
  id: number;
  name: string;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_open: boolean;
  public_token: string | null;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/eventid/events");
    if (res.status === 403) { window.location.href = "/eventid"; return; }
    const data = await res.json();
    if (Array.isArray(data)) setEvents(data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function createEvent() {
    setError("");
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    const res = await fetch("/api/eventid/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: desc }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error);
    else { setName(""); setDesc(""); await load(); }
    setSaving(false);
  }

  async function toggleOpen(ev: EventRow) {
    await fetch("/api/eventid/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ev.id, action: "toggle_open", is_open: !ev.is_open }),
    });
    await load();
  }

  async function genLink(ev: EventRow) {
    await fetch("/api/eventid/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ev.id, action: "generate_token" }),
    });
    await load();
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/eventid/apply/${token}`;
    navigator.clipboard.writeText(url);
  }

  return (
    <>
      <EventidHeader subtitle="Events" />
      <div className="admin-container">
        <h2>Create Event</h2>
        <div className="requester-add">
          <div className="requester-add-fields">
            <div>
              <label>Event name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pesta Inklusif 2026" />
            </div>
            <div>
              <label>Description (optional)</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" />
            </div>
          </div>
          {error && <p className="login-error">{error}</p>}
          <button className="btn-primary" onClick={createEvent} disabled={saving}>
            <Plus size={14} /> {saving ? "Creating..." : "Create Event"}
          </button>
        </div>

        <h2 style={{ marginTop: "1.5em" }}>Events</h2>
        {loading ? (
          <p>Loading...</p>
        ) : events.length === 0 ? (
          <p className="admin-subtitle">No events yet.</p>
        ) : (
          <div className="project-list">
            {events.map((ev) => (
              <div key={ev.id} className="project-item">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25em" }}>
                  <strong>{ev.name}</strong>
                  <span className="requester-email">
                    {ev.is_open ? "Open — accepting submissions" : "Closed"}
                  </span>
                </div>
                <div className="admin-actions" style={{ flexWrap: "wrap" }}>
                  <button className={ev.is_open ? "btn-reject" : "btn-approve"} onClick={() => toggleOpen(ev)}>
                    {ev.is_open ? <><ToggleRight size={14} /> Close</> : <><ToggleLeft size={14} /> Open</>}
                  </button>
                  {ev.public_token ? (
                    <button className="btn-secondary" onClick={() => copyLink(ev.public_token!)}>
                      <Copy size={14} /> Copy link
                    </button>
                  ) : (
                    <button className="btn-secondary" onClick={() => genLink(ev)}>
                      <Link2 size={14} /> Generate link
                    </button>
                  )}
                  <a className="btn-primary" href={`/eventid/events/${ev.id}`}>
                    Manage <ChevronRight size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
