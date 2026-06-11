import { NextResponse } from "next/server";
import { verifyAdmin } from "@/utils/supabase/verify-admin";
import { createAdminClient } from "@/utils/supabase/admin";

// GET all projects (including inactive)
export async function GET() {
  try {
    const { supabase, admin } = await verifyAdmin();
    if (!admin) {
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
    const { supabase, admin } = await verifyAdmin();
    if (!admin) {
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

// DELETE: permanently remove a project, only if no reimbursement uses it.
export async function DELETE(request: Request) {
  try {
    const { admin } = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = (await request.json()) as { id: number };
    if (!id) {
      return NextResponse.json({ error: "Project id is required" }, { status: 400 });
    }

    // Service role: projects has no DELETE RLS policy, so the user-scoped
    // client would silently delete zero rows. Admin is already verified above.
    const adminDb = createAdminClient();

    const { data: project, error: fetchError } = await adminDb
      .from("projects")
      .select("name")
      .eq("id", id)
      .single();
    if (fetchError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Reimbursements reference a project by its name string — block deletion
    // while any item still points at it.
    const { count, error: countError } = await adminDb
      .from("reimbursements")
      .select("id", { count: "exact", head: true })
      .eq("project", project.name);
    if (countError) throw countError;

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${count} reimbursement item${count !== 1 ? "s" : ""} still use this project.` },
        { status: 409 }
      );
    }

    const { error } = await adminDb.from("projects").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ status: "OK" });
  } catch (error) {
    console.error("Project delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
