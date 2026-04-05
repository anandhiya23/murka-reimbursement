import { NextResponse } from "next/server";
import { verifyAdmin } from "@/utils/supabase/verify-admin";
import { fetchReviewGroup, sendReviewEmail } from "@/lib/send-review-email";

export async function POST(request: Request) {
  try {
    const { supabase, admin } = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { groupId } = (await request.json()) as { groupId: number };
    if (!groupId) {
      return NextResponse.json({ error: "groupId is required" }, { status: 400 });
    }

    const group = await fetchReviewGroup(supabase, groupId);
    await sendReviewEmail(supabase, group);

    return NextResponse.json({ status: "OK" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send notification";
    console.error("Notify error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
