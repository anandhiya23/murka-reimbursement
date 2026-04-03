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

    // Resolve requester from logged-in user's email — must exist in requesters table
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

    // Generate group ID
    // Get current max group count from reimbursements to stay consistent
    const datePrefix = getYYMMDD();
    const { count } = await supabase
      .from("reimbursements")
      .select("*", { count: "exact", head: true })
      .like("group_id", `#${datePrefix}-%`);
    const groupNum = (count || 0) + 1;
    const groupId = `#${datePrefix}-${groupNum}`;

    // Collect files grouped by item index
    const filesByItem = new Map<number, { name: string; type: string; buffer: ArrayBuffer }[]>();
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        // key format: items[0]files, items[1]files, etc.
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

    // Upload files to Supabase Storage, track per item
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

    // Insert reimbursement rows and get IDs back
    const rows = items.map((item, i) => ({
      requester,
      project: item.project,
      expense_date: item.expenseDate,
      description: item.description,
      amount: Number(item.amount),
      proof_url: uploadedByItem[i][0]?.url || "",
      approver,
      status: "Pending",
      group_id: groupId,
      requester_email: requesterEmail,
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from("reimbursements")
      .insert(rows)
      .select("id");

    if (insertError) throw insertError;

    // Insert proof_files for each reimbursement
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

    return NextResponse.json({ status: "OK" });
  } catch (error) {
    console.error("Error uploading/processing reimbursement:", error);
    return NextResponse.json(
      { error: "Failed to upload or submit reimbursement" },
      { status: 500 }
    );
  }
}
