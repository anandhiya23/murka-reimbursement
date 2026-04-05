import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function verifyAdmin() {
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
