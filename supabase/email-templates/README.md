# Supabase Auth Email Templates

Branded HTML for every auth email. Paste into **Supabase Dashboard → Authentication → Emails → Templates**.

| File | Dashboard template | Suggested subject |
|------|--------------------|-------------------|
| `invite.html` | Invite user | You've been invited to Murka |
| `recovery.html` | Reset password | Reset your Murka password |
| `confirmation.html` | Confirm signup | Confirm your Murka email |
| `magic-link.html` | Magic Link | Your Murka sign-in link |
| `email-change.html` | Change email address | Confirm your new Murka email |
| `reauthentication.html` | Reauthentication | Your Murka verification code |

## ⚠️ These templates are REQUIRED, not optional

The **default** Supabase templates use `{{ .ConfirmationURL }}`, which for server-generated
links (invite, recovery) emits an **implicit-flow hash** (`#access_token=…`). Our server route
`/api/auth/callback` can only read query params — URL fragments never reach the server — so those
links fail with `/login?error=auth`. You MUST paste these templates so links use the `token_hash`
pattern instead.

## Notes

- Link templates use `{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=…&next=…`
  — server-readable query params → callback runs `verifyOtp` → session. `{{ .SiteURL }}` must be
  set correctly in **Auth → URL Configuration**.
- `reauthentication.html` uses `{{ .Token }}` (6-digit OTP code), not a link.
- `email-change.html` shows `{{ .Email }}` → `{{ .NewEmail }}`.
- Logo is a text wordmark on purpose: most email clients (Gmail) strip SVG and inline `<style>`. All CSS is inline.
- For the invite/recovery flow, `redirectTo` is set in code to `…/api/auth/callback?next=/set-password`. That URL must be in **Auth → URL Configuration → Redirect URLs**.
