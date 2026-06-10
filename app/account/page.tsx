"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft } from "lucide-react";

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Re-authenticate with current password before allowing the change.
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (authError) {
      setError("Current password is incorrect.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("Password updated.");
      setCurrent("");
      setPassword("");
      setConfirm("");
    }
    setLoading(false);
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/murka-logo-dark.svg" alt="Murka" className="login-logo" />
        <p>Change password</p>
        {email && <p className="login-muted">{email}</p>}

        <form onSubmit={handleSubmit} className="login-form">
          <label>Current password</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <label>New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            required
          />
          <label>Confirm new password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {error && <p className="login-error">{error}</p>}
          {success && <p className="login-success">{success}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Update password"}
          </button>
        </form>

        <a href="/" className="login-link"><ArrowLeft size={14} /> Back</a>
      </div>
    </div>
  );
}
