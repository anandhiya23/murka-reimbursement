import { createClient } from "@/utils/supabase/server";
import { getAuthIdentity } from "@/utils/supabase/claims";
import { cookies } from "next/headers";

export async function verifyAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const identity = await getAuthIdentity(supabase);
  if (!identity?.email) return { supabase, admin: null };

  const { data } = await supabase
    .from("requesters")
    .select("name, is_admin")
    .eq("email", identity.email)
    .single();

  return { supabase, admin: data?.is_admin ? data : null };
}
