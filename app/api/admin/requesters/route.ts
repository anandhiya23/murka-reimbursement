import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, admin: null };

  const { data } = await supabase
    .from("requesters")
    .select("name, is_admin")
    .eq("email", user.email)
    .single();

  return { supabase, admin: data?.is_admin ? data : null };
}

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
    const { name, email, password } = body as {
      name: string;
      email: string;
      password: string;
    };

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Use service role client to create auth user
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server misconfigured: missing service role key" },
        { status: 500 }
      );
    }

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Create auth user
    const { error: authError } = await serviceClient.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    // Insert into requesters table
    const { error: insertError } = await serviceClient
      .from("requesters")
      .insert({
        name: name.trim(),
        email: email.trim(),
        is_admin: false,
      });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

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

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server misconfigured: missing service role key" },
        { status: 500 }
      );
    }

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

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

    return NextResponse.json({ status: "OK" });
  } catch (error) {
    console.error("Delete requester error:", error);
    return NextResponse.json(
      { error: "Failed to delete requester" },
      { status: 500 }
    );
  }
}
