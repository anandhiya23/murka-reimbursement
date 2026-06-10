"use client";

import { useState, useEffect } from "react";
import EventidHeader from "@/app/components/EventidHeader";
import { CalendarDays, ListChecks, FolderKanban } from "lucide-react";

interface Division {
  id: number;
  name: string;
  event_id: number;
  event_name: string;
}

export default function EventidDashboard() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [divisions, setDivisions] = useState<Division[]>([]);

  useEffect(() => {
    fetch("/api/eventid/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setIsAdmin(!!data.isAdmin);
        setDivisions(data.divisions ?? []);
        setLoading(false);
      })
      .catch(() => {
        window.location.href = "/";
      });
  }, []);

  if (loading) {
    return (
      <>
        <EventidHeader />
        <div className="admin-container"><p>Loading...</p></div>
      </>
    );
  }

  return (
    <>
      <EventidHeader />
      <div className="launcher-container">
        {isAdmin && (
          <>
            <h1 className="launcher-title">Admin</h1>
            <div className="launcher-grid" style={{ marginBottom: "2.5em" }}>
              <a href="/eventid/events" className="launcher-card">
                <div className="launcher-card-icon"><CalendarDays size={28} /></div>
                <div className="launcher-card-name">Events</div>
                <div className="launcher-card-desc">Create events, divisions, assign PICs, open/close forms</div>
              </a>
              <a href="/eventid/requests" className="launcher-card">
                <div className="launcher-card-icon"><ListChecks size={28} /></div>
                <div className="launcher-card-name">All Requests</div>
                <div className="launcher-card-desc">View every ID request across events</div>
              </a>
            </div>
          </>
        )}

        <h1 className="launcher-title">My Divisions</h1>
        {divisions.length === 0 ? (
          <p className="launcher-subtitle">
            {isAdmin
              ? "You aren't assigned to any division as PIC."
              : "You aren't assigned to any division yet. Contact an admin."}
          </p>
        ) : (
          <div className="launcher-grid">
            {divisions.map((d) => (
              <a key={d.id} href={`/eventid/divisions/${d.id}`} className="launcher-card">
                <div className="launcher-card-icon"><FolderKanban size={28} /></div>
                <div className="launcher-card-name">{d.name}</div>
                <div className="launcher-card-desc">{d.event_name}</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
