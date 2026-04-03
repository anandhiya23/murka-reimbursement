import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.murka.id";

function formatAmount(amount: number): string {
  return "Rp" + amount.toLocaleString("id-ID");
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: adminData } = await supabase
      .from("requesters")
      .select("is_admin")
      .eq("email", user.email)
      .single();

    if (!adminData?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { groupId } = (await request.json()) as { groupId: number };
    if (!groupId) {
      return NextResponse.json(
        { error: "groupId is required" },
        { status: 400 }
      );
    }

    // Fetch group with items
    const { data: group, error: groupError } = await supabase
      .from("reimbursement_groups")
      .select(
        "id, group_code, requester, requester_email, approver, created_at, notified_at, reimbursements(id, project, expense_date, description, amount, status, reviewed_by, review_message)"
      )
      .eq("id", groupId)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { error: "Group not found" },
        { status: 404 }
      );
    }

    // Check all items are reviewed
    const hasUnreviewed = group.reimbursements.some(
      (r: { status: string }) => r.status === "Pending"
    );
    if (hasUnreviewed) {
      return NextResponse.json(
        { error: "Not all items have been reviewed yet" },
        { status: 400 }
      );
    }

    if (!group.requester_email) {
      return NextResponse.json(
        { error: "Requester has no email address" },
        { status: 400 }
      );
    }

    // Build email
    const approved = group.reimbursements.filter(
      (r: { status: string }) => r.status === "Approved"
    );
    const rejected = group.reimbursements.filter(
      (r: { status: string }) => r.status === "Rejected"
    );
    const approvedTotal = approved.reduce(
      (s: number, r: { amount: number }) => s + r.amount,
      0
    );

    const itemRows = group.reimbursements
      .map(
        (r: {
          project: string;
          description: string;
          amount: number;
          status: string;
          review_message: string | null;
        }) => {
          const statusColor =
            r.status === "Approved" ? "#16a34a" : "#dc2626";
          const message = r.review_message
            ? `<br/><span style="color:#6b7280;font-size:12px;">&quot;${r.review_message}&quot;</span>`
            : "";
          return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${r.project}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${r.description || "-"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${formatAmount(r.amount)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;"><span style="color:${statusColor};font-weight:600;">${r.status}</span>${message}</td>
        </tr>`;
        }
      )
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
          <strong>${approved.length}</strong> approved${rejected.length > 0 ? `, <strong>${rejected.length}</strong> rejected` : ""}
          ${approvedTotal > 0 ? ` &mdash; Total approved: <strong>${formatAmount(approvedTotal)}</strong>` : ""}
        </div>

        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">This is an automated notification from Murka Reimbursement Tool.</p>
      </div>
    </div>`;

    // Send email
    const { error: sendError } = await resend.emails.send({
      from: `Murka Reimbursement <${fromEmail}>`,
      to: group.requester_email,
      subject: `Reimbursement ${group.group_code} reviewed — ${approved.length} approved${rejected.length > 0 ? `, ${rejected.length} rejected` : ""}`,
      html,
    });

    if (sendError) {
      console.error("Resend error:", sendError);
      return NextResponse.json(
        { error: sendError.message },
        { status: 500 }
      );
    }

    // Mark as notified
    await supabase
      .from("reimbursement_groups")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", groupId);

    return NextResponse.json({ status: "OK" });
  } catch (error) {
    console.error("Notify error:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
