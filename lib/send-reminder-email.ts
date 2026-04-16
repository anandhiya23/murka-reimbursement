import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.murka.id";

function formatAmount(amount: number): string {
  return "Rp" + amount.toLocaleString("id-ID");
}

export type PendingGroup = {
  group_code: string;
  requester: string;
  created_at: string;
  pending_count: number;
  total_amount: number;
};

export async function sendAdminReminderEmail(
  adminEmails: string[],
  pendingGroups: PendingGroup[]
): Promise<void> {
  if (adminEmails.length === 0) throw new Error("No admin emails provided");
  if (pendingGroups.length === 0) throw new Error("No pending groups");

  const totalPending = pendingGroups.reduce((s, g) => s + g.pending_count, 0);
  const groupRows = pendingGroups
    .map((g) => {
      const date = new Date(g.created_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${g.group_code}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${g.requester}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${date}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${g.pending_count}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${formatAmount(g.total_amount)}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#18181A;padding:20px 24px;border-radius:12px 12px 0 0;">
        <span style="color:#C1EF1C;font-weight:700;font-size:18px;">Murka</span>
      </div>
      <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">Hi,</p>
        <p style="margin:0 0 20px;font-size:14px;color:#1a1a2e;">
          There ${totalPending === 1 ? "is" : "are"} <strong>${totalPending} pending item${totalPending !== 1 ? "s" : ""}</strong>
          across <strong>${pendingGroups.length} group${pendingGroups.length !== 1 ? "s" : ""}</strong> awaiting review.
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f4f5f7;">
              <th style="padding:8px 12px;text-align:left;font-weight:500;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Group</th>
              <th style="padding:8px 12px;text-align:left;font-weight:500;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Requester</th>
              <th style="padding:8px 12px;text-align:left;font-weight:500;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Submitted</th>
              <th style="padding:8px 12px;text-align:center;font-weight:500;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Pending</th>
              <th style="padding:8px 12px;text-align:left;font-weight:500;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Amount</th>
            </tr>
          </thead>
          <tbody>${groupRows}</tbody>
        </table>

        <div style="margin-top:24px;">
          <a href="https://reimbursement.murka.id/admin" style="display:inline-block;background:#C1EF1C;color:#18181A;font-weight:700;font-size:14px;padding:10px 24px;border-radius:8px;text-decoration:none;letter-spacing:-0.01em;">Review Now</a>
        </div>

        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">This is an automated daily reminder from Murka Reimbursement Tool.</p>
      </div>
    </div>`;

  const { error } = await resend.emails.send({
    from: `Murka Reimbursement <${fromEmail}>`,
    to: adminEmails,
    subject: `Action needed: ${totalPending} pending reimbursement item${totalPending !== 1 ? "s" : ""} awaiting review`,
    html,
  });

  if (error) throw new Error(error.message);
}
