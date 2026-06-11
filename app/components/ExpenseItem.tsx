"use client";

import { useState, useEffect, useRef } from "react";
import Select from "react-select";
import { Trash2, X, Upload, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Option {
  value: string;
  label: string;
}

interface ExpenseItemData {
  project: string;
  expenseDate: string;
  description: string;
  amount: string;
  files: File[] | null;
}

export interface ItemError {
  project?: boolean;
  expenseDate?: boolean;
  amount?: boolean;
  files?: boolean;
}

interface ExpenseItemProps {
  index: number;
  data: ExpenseItemData;
  projectOptions: Option[];
  showRemove: boolean;
  error?: ItemError;
  onChange: (index: number, data: ExpenseItemData) => void;
  onRemove: (index: number) => void;
  onFilesChange: (index: number, files: File[]) => void;
}

function formatAmount(raw: string): string {
  const digits = raw.replace(/[\D]/g, "");
  const num = digits ? parseInt(digits, 10) : 0;
  return num === 0 ? "" : "Rp" + num.toLocaleString("id-ID");
}

// HEIC can't render in <img>; everything else with an image/* type can.
function canPreview(f: File): boolean {
  return f.type.startsWith("image/") && f.type !== "image/heic" && !/\.heic$/i.test(f.name);
}

const ACCEPT = ".jpg,.jpeg,.png,.heic";

export default function ExpenseItem({
  index,
  data,
  projectOptions,
  showRemove,
  error,
  onChange,
  onRemove,
  onFilesChange,
}: ExpenseItemProps) {
  const selectedProject = projectOptions.find((o) => o.value === data.project) || null;
  const files = data.files ?? [];

  const [previews, setPreviews] = useState<(string | null)[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build (and revoke) object URLs for previewable files.
  useEffect(() => {
    const urls = files.map((f) => (canPreview(f) ? URL.createObjectURL(f) : null));
    setPreviews(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.files]);

  function addFiles(incoming: FileList | File[]) {
    const seen = new Set(files.map((f) => `${f.name}:${f.size}`));
    const merged = [...files, ...Array.from(incoming).filter((f) => !seen.has(`${f.name}:${f.size}`))];
    onFilesChange(index, merged);
  }

  function removeFile(i: number) {
    onFilesChange(index, files.filter((_, idx) => idx !== i));
  }

  return (
    <div className="relative space-y-3 rounded-lg border bg-card p-4">
      {showRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      <div className="space-y-1.5">
        <Label>Project</Label>
        <Select
          instanceId={`project-${index}`}
          options={projectOptions}
          value={selectedProject}
          onChange={(opt) => onChange(index, { ...data, project: opt?.value || "" })}
          placeholder="Select..."
          classNamePrefix="react-select"
          classNames={{ control: () => (error?.project ? "rs-invalid" : "") }}
        />
        {error?.project && <p className="text-xs text-destructive">Select a project.</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`date-${index}`}>Expense Date</Label>
          <Input
            id={`date-${index}`}
            type="date"
            value={data.expenseDate}
            aria-invalid={!!error?.expenseDate}
            onChange={(e) => onChange(index, { ...data, expenseDate: e.target.value })}
          />
          {error?.expenseDate && <p className="text-xs text-destructive">Required.</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`amount-${index}`}>Amount (IDR)</Label>
          <Input
            id={`amount-${index}`}
            type="text"
            inputMode="numeric"
            value={data.amount}
            aria-invalid={!!error?.amount}
            onChange={(e) => onChange(index, { ...data, amount: formatAmount(e.target.value) })}
          />
          {error?.amount && <p className="text-xs text-destructive">Required.</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`desc-${index}`}>Description / Purpose</Label>
        <Textarea
          id={`desc-${index}`}
          rows={2}
          value={data.description}
          onChange={(e) => onChange(index, { ...data, description: e.target.value })}
          className="h-20 resize-none overflow-y-auto field-sizing-fixed"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Proof Files (JPG / PNG / HEIC)</Label>

        {/* Drag-and-drop zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center text-sm transition-colors ${
            dragActive
              ? "border-ring bg-muted"
              : error?.files
                ? "border-destructive hover:bg-muted/50"
                : "border-input hover:bg-muted/50"
          }`}
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">Click to upload </span> or drag &amp; drop
          </span><span className="text-xs text-muted-foreground">JPG, PNG, HEIC</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {error?.files && <p className="text-xs text-destructive">Attach at least one proof file.</p>}

        {/* Inline thumbnail previews */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="group/thumb relative h-16 w-16 overflow-hidden rounded-md border bg-muted"
                title={f.name}
              >
                {previews[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[i]!} alt={f.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-center">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="w-full truncate text-[9px] text-muted-foreground">{f.name.split(".").pop()?.toUpperCase()}</span>
                  </div>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-background/90 opacity-0 shadow hover:bg-background group-hover/thumb:opacity-100 [&_svg]:size-3"
                  title="Remove"
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
