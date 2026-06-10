"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface Scope {
  kind: "event" | "division";
  eventName: string;
  isOpen: boolean;
  lockedDivision?: { id: number; name: string };
  openDivisions?: { id: number; name: string }[];
}

export default function ApplyPage() {
  const params = useParams();
  const token = String(params.token);

  const [scope, setScope] = useState<Scope | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [name, setName] = useState("");
  const [divisionId, setDivisionId] = useState<number | "">("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/eventid/public/resolve?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) { setInvalid(true); return; }
        const data: Scope = await res.json();
        setScope(data);
        if (data.kind === "division" && data.lockedDivision) setDivisionId(data.lockedDivision.id);
      })
      .catch(() => setInvalid(true));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !photo || !idPhoto) { setError("Name, photo and ID photo are required."); return; }
    if (scope?.kind === "event" && !divisionId) { setError("Please choose a division."); return; }
    setSubmitting(true);
    const fd = new FormData();
    fd.set("token", token);
    fd.set("full_name", name);
    if (divisionId) fd.set("division_id", String(divisionId));
    fd.set("photo", photo);
    fd.set("id_photo", idPhoto);
    const res = await fetch("/api/eventid/public/submit", { method: "POST", body: fd });
    if (res.ok) setDone(true);
    else setError((await res.json()).error || "Submission failed.");
    setSubmitting(false);
  }

  if (invalid) {
    return (
      <div className="login-container"><div className="login-card">
        <img src="/murka-logo-dark.svg" alt="Murka" className="login-logo" />
        <p>Invalid link</p>
        <p className="login-muted">This application link is not valid.</p>
      </div></div>
    );
  }
  if (!scope) {
    return <div className="login-container"><div className="login-card"><p>Loading...</p></div></div>;
  }
  if (done) {
    return (
      <div className="login-container"><div className="login-card">
        <img src="/murka-logo-dark.svg" alt="Murka" className="login-logo" />
        <p>Submitted</p>
        <p className="login-muted">Your ID request for {scope.eventName} has been received.</p>
      </div></div>
    );
  }
  if (!scope.isOpen) {
    return (
      <div className="login-container"><div className="login-card">
        <img src="/murka-logo-dark.svg" alt="Murka" className="login-logo" />
        <p>{scope.eventName}</p>
        <p className="login-muted">This event is not currently accepting submissions.</p>
      </div></div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/murka-logo-dark.svg" alt="Murka" className="login-logo" />
        <p>ID Request — {scope.eventName}</p>
        <p className="login-muted">
          {scope.kind === "division" ? `Division: ${scope.lockedDivision?.name}` : "Fill in your details below."}
        </p>
        <form onSubmit={submit} className="login-form">
          <label>Full name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" required />

          {scope.kind === "event" && (
            <>
              <label>Division</label>
              <select value={divisionId} onChange={(e) => setDivisionId(e.target.value ? Number(e.target.value) : "")} required>
                <option value="">Select a division</option>
                {scope.openDivisions?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </>
          )}

          <label>Photo (portrait)</label>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} required />

          <label>Identification photo</label>
          <input type="file" accept="image/*" onChange={(e) => setIdPhoto(e.target.files?.[0] ?? null)} required />

          {error && <p className="login-error">{error}</p>}
          <button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit"}</button>
        </form>
      </div>
    </div>
  );
}
