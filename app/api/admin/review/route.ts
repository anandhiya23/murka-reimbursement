import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

    // Check admin status from requesters table
    const { data: adminData } = await supabase
      .from("requesters")
      .select("name, is_admin")
      .eq("email", user.email)
      .single();

    if (!adminData?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, action, message } = body as {
      id: number;
      action: "Approved" | "Rejected";
      message?: string;
    };

    if (!id || !["Approved", "Rejected"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid request: id and action (Approved/Rejected) required" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("reimbursements")
      .update({
        status: action,
        reviewed_by: adminData.name,
        reviewed_at: new Date().toISOString(),
        review_message: message || null,
      })
      .eq("id", id);

    if (updateError) throw updateError;

    return NextResponse.json({ status: "OK" });
  } catch (error) {
    console.error("Admin review error:", error);
    return NextResponse.json(
      { error: "Failed to update reimbursement" },
      { status: 500 }
    );
  }
}
