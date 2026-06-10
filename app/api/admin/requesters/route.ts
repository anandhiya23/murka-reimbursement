import { NextResponse } from "next/server";
import { verifyAdmin } from "@/utils/supabase/verify-admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { inviteUser } from "@/lib/invite-user";

// GET all requesters
export async function GET() {
  try {
    const { supabase, admin } = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("requesters")
      .select("id, name, email, is_admin")
      .order("name");

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Requesters fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch requesters" },
      { status: 500 }
    );
  }
}

// POST: add new requester (creates Supabase Auth user + requesters row)
export async function POST(request: Request) {
  try {
    const { admin } = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email } = body as { name: string; email: string };

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const serviceClient = createAdminClient();
    const origin = new URL(request.url).origin;

    // Send invite email — user sets their own password (email auto-confirmed on accept).
    const invite = await inviteUser(serviceClient, cleanEmail, origin);
    if (!invite.ok) {
      return NextResponse.json({ error: invite.error }, { status: 400 });
    }

    // Insert into requesters table
    const { error: insertError } = await serviceClient
      .from("requesters")
      .insert({
        name: name.trim(),
        email: cleanEmail,
        is_admin: false,
      });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    // Mirror into the generic roles table (reimbursement requester).
    await serviceClient
      .from("user_app_roles")
      .insert({ email: cleanEmail, app_key: "reimbursement", role: "requester" });

    return NextResponse.json({ status: "OK" });
  } catch (error) {
    console.error("Create requester error:", error);
    return NextResponse.json(
      { error: "Failed to create requester" },
      { status: 500 }
    );
  }
}

// DELETE: remove requester and their auth account
export async function DELETE(request: Request) {
  try {
    const { admin } = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, email } = (await request.json()) as { id: number; email: string };

    if (!id || !email) {
      return NextResponse.json(
        { error: "id and email are required" },
        { status: 400 }
      );
    }

    const serviceClient = createAdminClient();

    // Find the auth user by email
    const { data: users, error: listError } =
      await serviceClient.auth.admin.listUsers();
    if (listError) throw listError;

    const authUser = users.users.find((u) => u.email === email);

    // Delete auth user if found
    if (authUser) {
      const { error: deleteAuthError } =
        await serviceClient.auth.admin.deleteUser(authUser.id);
      if (deleteAuthError) throw deleteAuthError;
    }

    // Delete from requesters table
    const { error: deleteError } = await serviceClient
      .from("requesters")
      .delete()
      .eq("id", id);
    if (deleteError) throw deleteError;

    // Deleting the auth account removes all access — clear their app roles too.
    await serviceClient
      .from("user_app_roles")
      .delete()
      .eq("email", email.toLowerCase());

    return NextResponse.json({ status: "OK" });
  } catch (error) {
    console.error("Delete requester error:", error);
    return NextResponse.json(
      { error: "Failed to delete requester" },
      { status: 500 }
    );
  }
}
