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

    // User MUST exist in requesters table
    const { data: requesterMatch } = await supabase
      .from("requesters")
      .select("name, is_admin")
      .eq("email", userEmail)
      .single();

    if (!requesterMatch) {
      return NextResponse.json(
        {
          error: "Unregistered",
          message:
            "Your account is not registered as a requester. Contact an admin.",
        },
        { status: 403 }
      );
    }

    const [groups, approvers, projects] = await Promise.all([
      supabase
        .from("reimbursement_groups")
        .select(
          "id, group_code, requester, requester_email, approver, created_at, notified_at, reimbursements(id, project, expense_date, description, amount, proof_url, status, reviewed_by, reviewed_at, review_message, proof_files(id, file_name, public_url))"
        )
        .eq("requester", requesterMatch.name)
        .order("created_at", { ascending: true }),
      supabase.from("approvers").select("name"),
      supabase.from("projects").select("name").eq("is_active", true),
    ]);

    if (groups.error) throw groups.error;
    if (approvers.error) throw approvers.error;
    if (projects.error) throw projects.error;

    return NextResponse.json({
      user: {
        email: userEmail,
        name: requesterMatch.name,
        avatar_url: user.user_metadata?.avatar_url || null,
        isAdmin: requesterMatch.is_admin,
      },
      groups: groups.data,
      approvers: approvers.data.map((r) => r.name),
      projects: projects.data.map((r) => r.name),
    });
  } catch (err) {
    console.error("Init error:", err);
    return NextResponse.json(
      { error: "Failed to initialize data" },
      { status: 500 }
    );
  }
}
