"use client";

import { useState, useEffect, useRef } from "react";
import Select from "react-select";
import ExpenseItem from "./components/ExpenseItem";
import ReimbursementTable from "./components/ReimbursementTable";

interface Option {
  value: string;
  label: string;
}

interface ExpenseItemData {
  project: string;
  expenseDate: string;
  description: string;
  amount: string;
  files: FileList | null;
}

interface ReimbursementRow {
  requester: string;
  project: string;
  date: string;
  description: string;
  status: string;
}

const emptyItem: ExpenseItemData = {
  project: "",
  expenseDate: "",
  description: "",
  amount: "",
  files: null,
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const [approverOptions, setApproverOptions] = useState<Option[]>([]);
  const [requesterOptions, setRequesterOptions] = useState<Option[]>([]);
  const [projectOptions, setProjectOptions] = useState<Option[]>([]);

  const [requester, setRequester] = useState<Option | null>(null);
  const [approver, setApprover] = useState<Option | null>(null);

  const [items, setItems] = useState<ExpenseItemData[]>([{ ...emptyItem }]);
  const fileInputsRef = useRef<Map<number, FileList>>(new Map());

  const [tableRows, setTableRows] = useState<ReimbursementRow[]>([]);

  function parseTableRows(values: string[][]): ReimbursementRow[] {
    const rows: ReimbursementRow[] = [];
    for (let i = values.length - 1; i >= 0; i--) {
      const r = values[i];
      rows.push({
        requester: r[1] || "",
        project: r[2] || "",
        date: r[3] || "",
        description: r[4] || "",
        status: r[11] || "",
      });
    }
    return rows;
  }

  async function loadData() {
    try {
      const json = await fetch("/init").then((res) => res.json());

      const dropdownValues: string[][] = json.valueRanges[1].values || [];
      const approvers: Option[] = [];
      const requesters: Option[] = [];
      const projects: Option[] = [];

      for (const row of dropdownValues) {
        const [approverVal, requesterVal, , projectVal] = row;
        if (approverVal)
          approvers.push({ value: approverVal, label: approverVal });
        if (requesterVal)
          requesters.push({ value: requesterVal, label: requesterVal });
        if (projectVal)
          projects.push({ value: projectVal, label: projectVal });
      }

      setApproverOptions(approvers);
      setRequesterOptions(requesters);
      setProjectOptions(projects);

      const tableValues: string[][] = json.valueRanges[0].values || [];
      setTableRows(parseTableRows(tableValues));

      setLoading(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus("Error loading: " + message);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleItemChange(index: number, data: ExpenseItemData) {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  }

  function handleFilesChange(index: number, files: FileList | null) {
    if (files) {
      fileInputsRef.current.set(index, files);
    }
  }

  function addItem() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
    fileInputsRef.current.delete(index);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("Uploading...");

    const savedRequester = requester;
    const savedApprover = approver;

    const fd = new FormData();
    fd.append("requester", requester?.value || "");
    fd.append("approver", approver?.value || "");
    fd.append("idemKey", crypto.randomUUID());

    const itemsPayload = items.map((item, idx) => {
      const files = fileInputsRef.current.get(idx);
      if (files) {
        for (const f of Array.from(files)) {
          fd.append(`items[${idx}]files`, f);
        }
      }
      return {
        project: item.project,
        expenseDate: item.expenseDate,
        description: item.description,
        amount: Number(item.amount.replace(/[^\d-]/g, "")) || 0,
        index: idx,
        fileCount: files?.length || 0,
      };
    });

    fd.append("items", JSON.stringify(itemsPayload));

    try {
      const resp = await fetch("/postreimburse", {
        method: "POST",
        body: fd,
      });
      await resp.json();

      setStatus("Submitted successfully!");

      setItems([{ ...emptyItem }]);
      fileInputsRef.current.clear();
      setRequester(savedRequester);
      setApprover(savedApprover);

      // Refresh table
      const json = await fetch("/init").then((res) => res.json());
      const tableValues: string[][] = json.valueRanges[0].values || [];
      setTableRows(parseTableRows(tableValues));

      setLoading(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus("Error: " + message);
      setLoading(false);
    }
  }

  return (
    <div className="main-grid">
      <div className="container">
        <h2>Murka Reimbursement Tool</h2>
        <form
          id="reimbursementForm"
          className={loading ? "loading" : ""}
          onSubmit={handleSubmit}
        >
          <label>Requester Name</label>
          <Select
            options={requesterOptions}
            value={requester}
            onChange={setRequester}
            placeholder="Select..."
            isDisabled={loading}
            classNamePrefix="react-select"
          />

          <div id="items">
            {items.map((item, idx) => (
              <ExpenseItem
                key={idx}
                index={idx}
                data={item}
                projectOptions={projectOptions}
                showRemove={items.length > 1}
                onChange={handleItemChange}
                onRemove={removeItem}
                onFilesChange={handleFilesChange}
              />
            ))}
          </div>

          <button type="button" className="add-item-btn" onClick={addItem}>
            + Add another expense
          </button>

          <label>Approver</label>
          <Select
            options={approverOptions}
            value={approver}
            onChange={setApprover}
            placeholder="Select..."
            isDisabled={loading}
            classNamePrefix="react-select"
          />

          <button type="submit">Submit</button>
        </form>
        <div id="status">{status}</div>
      </div>

      <ReimbursementTable rows={tableRows} />
    </div>
  );
}
