import { verifyAppRole } from "@/utils/supabase/verify-role";

export interface EventidAccess {
  supabase: Awaited<ReturnType<typeof verifyAppRole>>["supabase"];
  email: string | null;
  isSuperAdmin: boolean;
  isAdmin: boolean; // super-admin OR eventid admin
  isPic: boolean;
  divisionIds: number[]; // divisions this PIC is assigned to (empty for pure admins)
}

// Resolves the caller's EventID access: admin (full) vs PIC (scoped to divisions).
export async function getEventidAccess(): Promise<EventidAccess> {
  const { supabase, user, role, isSuperAdmin } = await verifyAppRole("eventid", [
    "admin",
    "pic",
  ]);

  const isAdmin = isSuperAdmin || role === "admin";
  const isPic = role === "pic";

  let divisionIds: number[] = [];
  if (isPic && user?.email) {
    const { data } = await supabase
      .from("eventid_division_pics")
      .select("division_id")
      .eq("email", user.email);
    divisionIds = (data ?? []).map((r) => r.division_id);
  }

  return {
    supabase,
    email: user?.email ?? null,
    isSuperAdmin,
    isAdmin,
    isPic,
    divisionIds,
  };
}
