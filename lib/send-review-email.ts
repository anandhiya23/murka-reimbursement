import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.murka.id";

function formatAmount(amount: number): string {
  return "Rp" + amount.toLocaleString("id-ID");
}

type SupabaseClient = Awaited<ReturnType<typeof import("@/utils/supabase/server").createClient>>;

export type ReviewGroup = {
  id: number;
  group_code: string;
  requester: string;
  requester_email: string;
  notified_at: string | null;
  reimbursements: {
    id: number;
    project: string;
    description: string;
    amount: number;
    status: string;
    review_message: string | null;
  }[];
};

/**
 * Fetch a group with all data needed for the review email.
 */
export async function fetchReviewGroup(
  supabase: SupabaseClient,
  groupId: number
): Promise<ReviewGroup> {
  const { data: group, error } = await supabase
    .from("reimbursement_groups")
    .select(
      "id, group_code, requester, requester_email, notified_at, reimbursements(id, project, description, amount, status, review_message)"
    )
    .eq("id", groupId)
    .single();

  if (error || !group) throw new Error("Group not found");
  return group as ReviewGroup;
}

/**
 * Sends the review summary email for a pre-fetched group and marks it as notified.
 * Throws if the group has pending items, no email, or the send fails.
 */
export async function sendReviewEmail(
  supabase: SupabaseClient,
  group: ReviewGroup
): Promise<void> {
  if (!group.requester_email) throw new Error("Requester has no email address");

  const hasUnreviewed = group.reimbursements.some((r) => r.status === "Pending");
  if (hasUnreviewed) throw new Error("Not all items have been reviewed yet");

  let approvedCount = 0;
  let rejectedCount = 0;
  let approvedTotal = 0;

  const itemRows = group.reimbursements
    .map((r) => {
      if (r.status === "Approved") { approvedCount++; approvedTotal += r.amount; }
      else { rejectedCount++; }
      const statusColor = r.status === "Approved" ? "#16a34a" : "#dc2626";
      const message = r.review_message
        ? `<br/><span style="color:#6b7280;font-size:12px;">&quot;${r.review_message}&quot;</span>`
        : "";
      return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${r.project}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${r.description || "-"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${formatAmount(r.amount)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;"><span style="color:${statusColor};font-weight:600;">${r.status}</span>${message}</td>
        </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#18181A;padding:20px 24px;border-radius:12px 12px 0 0;">
        <span style="color:#C1EF1C;font-weight:700;font-size:18px;">Murka</span>
      </div>
      <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">Hi ${group.requester},</p>
        <p style="margin:0 0 20px;font-size:14px;color:#1a1a2e;">Your reimbursement request <strong>${group.group_code}</strong> has been reviewed.</p>

        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f4f5f7;">
              <th style="padding:8px 12px;text-align:left;font-weight:500;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Project</th>
              <th style="padding:8px 12px;text-align:left;font-weight:500;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Description</th>
              <th style="padding:8px 12px;text-align:left;font-weight:500;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Amount</th>
              <th style="padding:8px 12px;text-align:left;font-weight:500;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div style="margin-top:16px;padding:12px 16px;background:#f4f5f7;border-radius:8px;font-size:13px;">
          <strong>${approvedCount}</strong> approved${rejectedCount > 0 ? `, <strong>${rejectedCount}</strong> rejected` : ""}
          ${approvedTotal > 0 ? ` &mdash; Total approved: <strong>${formatAmount(approvedTotal)}</strong>` : ""}
        </div>

        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">This is an automated notification from Murka Reimbursement Tool.</p>
      </div>
    </div>`;

  const { error: sendError } = await resend.emails.send({
    from: `Murka Reimbursement <${fromEmail}>`,
    to: group.requester_email,
    subject: `Reimbursement ${group.group_code} reviewed — ${approvedCount} approved${rejectedCount > 0 ? `, ${rejectedCount} rejected` : ""}`,
    html,
  });

  if (sendError) throw new Error(sendError.message);

  await supabase
    .from("reimbursement_groups")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", group.id);
}
