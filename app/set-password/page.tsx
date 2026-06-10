"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/";
    }
  }

  if (checking) {
    return (
      <div className="login-container">
        <div className="login-card"><p>Loading...</p></div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/murka-logo-dark.svg" alt="Murka" className="login-logo" />

        {!hasSession ? (
          <>
            <p>Link expired</p>
            <p className="login-muted">
              This link is invalid or has expired. Request a new one.
            </p>
            <a href="/forgot-password" className="login-link">Get a new link</a>
          </>
        ) : (
          <>
            <p>Set your password</p>
            <form onSubmit={handleSubmit} className="login-form">
              <label>New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
              />
              <label>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                required
              />
              {error && <p className="login-error">{error}</p>}
              <button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
