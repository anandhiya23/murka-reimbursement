"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/set-password`,
    });

    // Always show success — don't reveal whether an email exists.
    if (error && error.status !== 422) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/murka-logo-dark.svg" alt="Murka" className="login-logo" />

        {sent ? (
          <>
            <p>Check your email</p>
            <p className="login-muted">
              If an account exists for {email}, a password reset link is on its way.
            </p>
            <a href="/login" className="login-link">Back to sign in</a>
          </>
        ) : (
          <>
            <p>Reset your password</p>
            <form onSubmit={handleSubmit} className="login-form">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              {error && <p className="login-error">{error}</p>}
              <button type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
            <a href="/login" className="login-link">Back to sign in</a>
          </>
        )}
      </div>
    </div>
  );
}
