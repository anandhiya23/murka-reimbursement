import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function verifyAdmin(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("requesters")
    .select("name, is_admin")
    .eq("email", user.email)
    .single();

  return data?.is_admin ? data : null;
}

// GET all projects (including inactive)
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    if (!(await verifyAdmin(supabase))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("projects")
      .select("id, name, is_active")
      .order("name");

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Projects fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST: add new project or toggle active status
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    if (!(await verifyAdmin(supabase))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body as { action: string };

    if (action === "add") {
      const { name } = body as { name: string; action: string };
      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Project name is required" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("projects")
        .insert({ name: name.trim(), is_active: true });

      if (error) {
        if (error.code === "23505") {
          return NextResponse.json(
            { error: "Project already exists" },
            { status: 409 }
          );
        }
        throw error;
      }

      return NextResponse.json({ status: "OK" });
    }

    if (action === "toggle") {
      const { id, is_active } = body as {
        id: number;
        is_active: boolean;
        action: string;
      };

      const { error } = await supabase
        .from("projects")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;

      return NextResponse.json({ status: "OK" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Projects update error:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}
