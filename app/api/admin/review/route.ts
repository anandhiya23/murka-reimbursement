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

export async function DELETE(request: Request) {
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

    const { id } = (await request.json()) as { id: number };
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Get proof files to delete from storage
    const { data: proofFiles } = await supabase
      .from("proof_files")
      .select("file_path")
      .eq("reimbursement_id", id);

    // Delete files from storage
    if (proofFiles && proofFiles.length > 0) {
      const paths = proofFiles.map((f) => f.file_path);
      await supabase.storage.from("receipts").remove(paths);
    }

    // Delete reimbursement (proof_files cascade-deleted via FK)
    const { error: deleteError } = await supabase
      .from("reimbursements")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ status: "OK" });
  } catch (error) {
    console.error("Admin delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete reimbursement" },
      { status: 500 }
    );
  }
}
