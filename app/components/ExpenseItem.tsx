"use client";

import Select from "react-select";

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

interface ExpenseItemProps {
  index: number;
  data: ExpenseItemData;
  projectOptions: Option[];
  showRemove: boolean;
  onChange: (index: number, data: ExpenseItemData) => void;
  onRemove: (index: number) => void;
  onFilesChange: (index: number, files: FileList | null) => void;
}

function formatAmount(raw: string): string {
  const digits = raw.replace(/[\D]/g, "");
  const num = digits ? parseInt(digits, 10) : 0;
  return num === 0 ? "" : "Rp" + num.toLocaleString("id-ID");
}

export default function ExpenseItem({
  index,
  data,
  projectOptions,
  showRemove,
  onChange,
  onRemove,
  onFilesChange,
}: ExpenseItemProps) {
  const selectedProject = projectOptions.find((o) => o.value === data.project) || null;

  return (
    <div className="expense-item">
      <label>Project</label>
      <Select
        instanceId={`project-${index}`}
        options={projectOptions}
        value={selectedProject}
        onChange={(opt) =>
          onChange(index, { ...data, project: opt?.value || "" })
        }
        placeholder="Select..."
        classNamePrefix="react-select"
      />

      <label>Expense Date</label>
      <input
        type="date"
        className="expenseDate"
        value={data.expenseDate}
        onChange={(e) =>
          onChange(index, { ...data, expenseDate: e.target.value })
        }
        style={{ width: "50%" }}
        required
      />

      <label>Description / Purpose</label>
      <textarea
        className="description"
        rows={2}
        value={data.description}
        onChange={(e) =>
          onChange(index, { ...data, description: e.target.value })
        }
      />

      <label>Amount (IDR)</label>
      <input
        type="text"
        inputMode="numeric"
        className="amount"
        value={data.amount}
        onChange={(e) =>
          onChange(index, {
            ...data,
            amount: formatAmount(e.target.value),
          })
        }
        required
      />

      <label>Proof Files (JPG / PNG / HEIC)</label>
      <input
        type="file"
        className="itemFiles"
        accept=".jpg,.jpeg,.png,.heic"
        multiple
        required
        onChange={(e) => onFilesChange(index, e.target.files)}
      />

      {showRemove && (
        <div style={{ textAlign: "right" }}>
          <button
            type="button"
            className="remove-item"
            onClick={() => onRemove(index)}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
