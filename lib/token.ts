import { randomBytes } from "crypto";

// Unguessable URL-safe token (≥128-bit). Regenerating = revoking the old link.
export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}
