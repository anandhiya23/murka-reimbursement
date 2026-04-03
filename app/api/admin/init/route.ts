import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = user.email || "";

    const { data: requesterMatch } = await supabase
      .from("requesters")
      .select("name, is_admin")
      .eq("email", userEmail)
      .single();

    if (!requesterMatch || !requesterMatch.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: groups, error } = await supabase
      .from("reimbursement_groups")
      .select(
        "id, group_code, requester, requester_email, approver, created_at, notified_at, reimbursements(id, project, expense_date, description, amount, proof_url, status, reviewed_by, reviewed_at, review_message, proof_files(id, file_name, public_url))"
      )
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      user: {
        email: userEmail,
        name: requesterMatch.name,
        avatar_url: user.user_metadata?.avatar_url || null,
        isAdmin: true,
      },
      groups: groups,
    });
  } catch (err) {
    console.error("Admin init error:", err);
    return NextResponse.json(
      { error: "Failed to initialize data" },
      { status: 500 }
    );
  }
}
