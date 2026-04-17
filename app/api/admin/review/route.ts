import { NextResponse } from "next/server";
import { verifyAdmin } from "@/utils/supabase/verify-admin";
import { fetchReviewGroup, sendReviewEmail } from "@/lib/send-review-email";

export async function POST(request: Request) {
  try {
    const { supabase, admin: adminData } = await verifyAdmin();
    if (!adminData) {
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

    const { data: updatedItem, error: updateError } = await supabase
      .from("reimbursements")
      .update({
        status: action,
        reviewed_by: adminData.name,
        reviewed_at: new Date().toISOString(),
        review_message: message || null,
      })
      .eq("id", id)
      .select("group_id_fk")
      .single();

    if (updateError) throw updateError;

    // Auto-notify when all items in the group are processed
    let emailTriggered = false;
    let emailError: string | undefined;

    if (updatedItem?.group_id_fk) {
      try {
        const group = await fetchReviewGroup(supabase, updatedItem.group_id_fk);
        const allProcessed =
          group.reimbursements.length > 0 &&
          group.reimbursements.every((r) => r.status !== "Pending");

        if (allProcessed && !group.notified_at) {
          emailTriggered = true;
          await sendReviewEmail(supabase, group);
        }

        if (emailTriggered) {
          return NextResponse.json({
            status: "OK",
            emailTriggered,
            groupCode: group.group_code,
            requester: group.requester,
            requesterEmail: group.requester_email,
          });
        }
      } catch (emailErr) {
        // Don't fail the review if auto-notify fails — log and continue
        console.error("Auto-notify failed:", emailErr);
        emailError = emailErr instanceof Error ? emailErr.message : "Failed to send email";
      }
    }

    return NextResponse.json({ status: "OK", emailTriggered, emailError });
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
    const { supabase, admin } = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { groupId } = (await request.json()) as { groupId: number };
    if (!groupId) {
      return NextResponse.json({ error: "groupId is required" }, { status: 400 });
    }

    // Get all reimbursement IDs in this group
    const { data: items } = await supabase
      .from("reimbursements")
      .select("id")
      .eq("group_id_fk", groupId);

    if (items && items.length > 0) {
      const itemIds = items.map((i) => i.id);

      // Get all proof files for these items
      const { data: proofFiles } = await supabase
        .from("proof_files")
        .select("file_path")
        .in("reimbursement_id", itemIds);

      // Delete files from storage
      if (proofFiles && proofFiles.length > 0) {
        const paths = proofFiles.map((f) => f.file_path);
        await supabase.storage.from("receipts").remove(paths);
      }
    }

    // Delete group (reimbursements + proof_files cascade-deleted via FK)
    const { error: deleteError } = await supabase
      .from("reimbursement_groups")
      .delete()
      .eq("id", groupId);

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
