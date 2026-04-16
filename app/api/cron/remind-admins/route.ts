import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendAdminReminderEmail, PendingGroup } from "@/lib/send-reminder-email";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all groups that have at least one pending reimbursement
  const { data: groups, error: groupsError } = await supabase
    .from("reimbursement_groups")
    .select("group_code, requester, created_at, reimbursements(amount, status)")
    .order("created_at", { ascending: true });

  if (groupsError) {
    console.error("[remind-admins] Failed to fetch groups:", groupsError.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const pendingGroups: PendingGroup[] = (groups ?? [])
    .map((g) => {
      const reimbursements = (g.reimbursements ?? []) as { amount: number; status: string }[];
      const pending = reimbursements.filter((r) => r.status === "Pending");
      return {
        group_code: g.group_code,
        requester: g.requester,
        created_at: g.created_at,
        pending_count: pending.length,
        total_amount: reimbursements.reduce((s, r) => s + r.amount, 0),
      };
    })
    .filter((g) => g.pending_count > 0);

  if (pendingGroups.length === 0) {
    return NextResponse.json({ message: "No pending items. No email sent." });
  }

  // Fetch all admin emails
  const { data: admins, error: adminsError } = await supabase
    .from("requesters")
    .select("email")
    .eq("is_admin", true);

  if (adminsError) {
    console.error("[remind-admins] Failed to fetch admins:", adminsError.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const adminEmails = (admins ?? []).map((a) => a.email).filter(Boolean);

  if (adminEmails.length === 0) {
    return NextResponse.json({ error: "No admin emails found" }, { status: 500 });
  }

  await sendAdminReminderEmail(adminEmails, pendingGroups);

  const totalPending = pendingGroups.reduce((s, g) => s + g.pending_count, 0);
  return NextResponse.json({
    message: `Reminder sent to ${adminEmails.length} admin(s) about ${totalPending} pending item(s) in ${pendingGroups.length} group(s).`,
  });
}
