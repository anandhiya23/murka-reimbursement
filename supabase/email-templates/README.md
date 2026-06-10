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

## Notes

- Link templates use `{{ .ConfirmationURL }}` — works with the `/api/auth/callback` route (handles both `code` and `token_hash`).
- `reauthentication.html` uses `{{ .Token }}` (6-digit OTP code), not a link.
- `email-change.html` shows `{{ .Email }}` → `{{ .NewEmail }}`.
- Logo is a text wordmark on purpose: most email clients (Gmail) strip SVG and inline `<style>`. All CSS is inline.
- For the invite/recovery flow, `redirectTo` is set in code to `…/api/auth/callback?next=/set-password`. That URL must be in **Auth → URL Configuration → Redirect URLs**.
