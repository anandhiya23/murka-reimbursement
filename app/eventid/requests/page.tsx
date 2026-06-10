"use client";

import { useState, useEffect, useCallback } from "react";
import EventidHeader from "@/app/components/EventidHeader";
import { ExternalLink, Check, X } from "lucide-react";

interface ReqRow {
  id: number; event_id: number; division_id: number; full_name: string;
  status: string; photo_url: string | null; id_photo_url: string | null;
}
interface EventRow { id: number; name: string; }

type Filter = "all" | "pending" | "approved" | "rejected";

export default function AllRequestsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState<number | "">("");
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/eventid/events").then(async (res) => {
      if (res.status === 403) { window.location.href = "/eventid"; return; }
      const data = await res.json();
      if (Array.isArray(data)) setEvents(data);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const url = eventId ? `/api/eventid/requests?eventId=${eventId}` : "/api/eventid/requests";
    const res = await fetch(url);
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [eventId]);
  useEffect(() => { load(); }, [load]);

  async function review(id: number, action: "approve" | "reject") {
    const message = action === "reject" ? prompt("Reason (optional):") ?? undefined : undefined;
    await fetch("/api/eventid/requests", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, message }),
    });
    await load();
  }

  const visible = rows.filter((r) => filter === "all" || r.status === filter);
  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  return (
    <>
      <EventidHeader subtitle="All Requests" />
      <div className="admin-container">
        <div style={{ display: "flex", gap: "0.75em", alignItems: "center", marginBottom: "1em", flexWrap: "wrap" }}>
          <select value={eventId} onChange={(e) => setEventId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">All events</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          <div className="admin-tabs">
            {(["all", "pending", "approved", "rejected"] as Filter[]).map((f) => (
              <button key={f} className={`admin-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f} ({counts[f]})
              </button>
            ))}
          </div>
        </div>

        {loading ? <p>Loading...</p> : visible.length === 0 ? (
          <p className="admin-subtitle">No requests.</p>
        ) : (
          <div className="project-list">
            {visible.map((r) => (
              <div key={r.id} className="project-item">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75em" }}>
                  {r.photo_url ? <img src={r.photo_url} alt="" className="eventid-thumb" />
                    : <div className="eventid-thumb eventid-thumb-empty" />}
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
                  {r.status !== "approved" && <button className="btn-approve" onClick={() => review(r.id, "approve")}><Check size={14} /></button>}
                  {r.status !== "rejected" && <button className="btn-reject" onClick={() => review(r.id, "reject")}><X size={14} /></button>}
                  <a className="btn-secondary" href={`/eventid/divisions/${r.division_id}`}>Division</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
