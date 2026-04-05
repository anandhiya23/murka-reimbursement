import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { seen, remember } from "@/lib/idempotency";
import { NextResponse } from "next/server";

function getYYMMDD(): string {
  const jakarta = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );
  const yy = String(jakarta.getFullYear()).slice(2);
  const mm = String(jakarta.getMonth() + 1).padStart(2, "0");
  const dd = String(jakarta.getDate()).padStart(2, "0");
  return yy + mm + dd;
}

interface ExpenseItem {
  project: string;
  expenseDate: string;
  description: string;
  amount: number;
  index: number;
  fileCount: number;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();

    const idemKey = formData.get("idemKey") as string;
    if (seen(idemKey)) {
      return NextResponse.json({ status: "duplicate", ignored: true });
    }
    remember(idemKey);

    const approver = formData.get("approver") as string;
    const items: ExpenseItem[] = JSON.parse(formData.get("items") as string);

    // Resolve requester from logged-in user's email
    const userEmail = user.email || "";
    const { data: requesterData } = await supabase
      .from("requesters")
      .select("name, email")
      .eq("email", userEmail)
      .single();
    if (!requesterData) {
      return NextResponse.json(
        { error: "Your account is not registered as a requester." },
        { status: 403 }
      );
    }
    const requester = requesterData.name;
    const requesterEmail = requesterData.email;

    // Generate group code
    const datePrefix = getYYMMDD();
    const { count } = await supabase
      .from("reimbursement_groups")
      .select("*", { count: "exact", head: true })
      .like("group_code", `#${datePrefix}-%`);
    const groupNum = (count || 0) + 1;
    const groupCode = `#${datePrefix}-${groupNum}`;

    // 1. Create the group
    const { data: group, error: groupError } = await supabase
      .from("reimbursement_groups")
      .insert({
        group_code: groupCode,
        requester,
        requester_email: requesterEmail,
        approver,
      })
      .select("id")
      .single();

    if (groupError) throw groupError;

    // 2. Collect files grouped by item index
    const filesByItem = new Map<
      number,
      { name: string; type: string; buffer: ArrayBuffer }[]
    >();
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        const match = key.match(/items\[(\d+)\]files/);
        if (match) {
          const idx = parseInt(match[1], 10);
          if (!filesByItem.has(idx)) filesByItem.set(idx, []);
          filesByItem.get(idx)!.push({
            name: value.name,
            type: value.type,
            buffer: await value.arrayBuffer(),
          });
        }
      }
    }

    // 3. Upload files to Supabase Storage
    const uploadedByItem: { path: string; name: string; url: string }[][] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemFiles = filesByItem.get(item.index) || [];
      const folderPath = `${datePrefix}-${groupNum}/${i}`;

      const uploadPromises = itemFiles.map((file) => {
        const filePath = `${folderPath}/${file.name}`;
        return supabase.storage
          .from("receipts")
          .upload(filePath, file.buffer, {
            contentType: file.type,
            upsert: false,
          })
          .then((result) => ({ result, fileName: file.name }));
      });

      const results = await Promise.all(uploadPromises);
      const uploaded: { path: string; name: string; url: string }[] = [];
      for (const { result, fileName } of results) {
        if (result.error) {
          console.error("Storage upload error:", result.error);
        } else {
          const { data: urlData } = supabase.storage
            .from("receipts")
            .getPublicUrl(result.data.path);
          uploaded.push({
            path: result.data.path,
            name: fileName,
            url: urlData.publicUrl,
          });
        }
      }
      uploadedByItem.push(uploaded);
    }

    // 4. Insert reimbursement items linked to group
    const rows = items.map((item, i) => ({
      requester,
      project: item.project,
      expense_date: item.expenseDate,
      description: item.description,
      amount: Number(item.amount),
      proof_url: uploadedByItem[i][0]?.url || "",
      approver,
      status: "Pending",
      group_id: groupCode,
      group_id_fk: group.id,
      requester_email: requesterEmail,
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from("reimbursements")
      .insert(rows)
      .select("id");

    if (insertError) throw insertError;

    // 5. Insert proof_files for each reimbursement
    const proofFileRows = insertedRows.flatMap((row, i) =>
      uploadedByItem[i].map((file) => ({
        reimbursement_id: row.id,
        file_path: file.path,
        file_name: file.name,
        public_url: file.url,
      }))
    );

    if (proofFileRows.length > 0) {
      const { error: proofError } = await supabase
        .from("proof_files")
        .insert(proofFileRows);
      if (proofError) console.error("Proof files insert error:", proofError);
    }

    const { data: newGroup } = await supabase
      .from("reimbursement_groups")
      .select(
        "id, group_code, requester, requester_email, approver, created_at, notified_at, reimbursements(id, project, expense_date, description, amount, proof_url, status, reviewed_by, reviewed_at, review_message, proof_files(id, file_name, public_url))"
      )
      .eq("id", group.id)
      .single();

    return NextResponse.json({ status: "OK", group: newGroup });
  } catch (error) {
    console.error("Error uploading/processing reimbursement:", error);
    return NextResponse.json(
      { error: "Failed to upload or submit reimbursement" },
      { status: 500 }
    );
  }
}
