# EventID Form Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ad-hoc EventID forms with one consistent, accessible form kit (Field / FileDrop / FormGrid / validate), fix dark-on-dark contrast, and add edit-member, bulk verify/reject, and a proper reject-reason dialog.

**Architecture:** A small set of shared client components in `app/components/eventid/form/` built on the existing shadcn/radix primitives. Every EventID form is refactored onto the kit. No new runtime dependencies. The backend already supports member `edit` and reject `message` via the existing `PATCH /api/eventid/members`; bulk actions loop that endpoint, so no API changes are required.

**Tech Stack:** Next.js 16.2.2 (App Router, all `/eventid/*` under `dark eventid-theme`), React 19, Tailwind v4, shadcn/ui (radix), lucide-react, sonner.

## Verification model (no test runner)

This project has **no test framework** (package.json scripts are only `dev`, `build`, `lint`, `start`). Do not invent a test runner or add one. Each task is verified by:

1. **Typecheck:** `npx tsc --noEmit` → expect no errors.
2. **Lint:** `npm run lint` → expect no errors/warnings in touched files.
3. **Manual:** with `npm run dev` already running on http://localhost:3000, exercise the form described in the task's "Manual check" and confirm the stated behavior.

Where a task has pure logic (the `validate` helper), verify it with a one-off `node` snippet shown in the task — not a persisted test file.

## File Structure

- Create: `app/components/eventid/form/validate.ts` — pure validation helper + reusable rules.
- Create: `app/components/eventid/form/Field.tsx` — label + required marker + control slot + inline error.
- Create: `app/components/eventid/form/FormGrid.tsx` — responsive 2-col grid; `full` spans both columns (via Field prop).
- Create: `app/components/eventid/form/FileDrop.tsx` — drag-drop upload with image preview + remove. Replaces raw `<input type=file>`.
- Create: `app/components/eventid/form/index.ts` — barrel export.
- Modify: `app/components/eventid/ApplyForm.tsx` — refactor onto kit + FileDrop + inline validation.
- Modify: `app/components/eventid/MembersPanel.tsx` — Add/Edit dialog on kit + FileDrop; reject-reason dialog (remove `prompt()`); bulk toolbar; per-row edit action.
- Modify: `app/eventid/events/page.tsx` — Create-event form onto kit.
- Modify: `app/eventid/e/[slug]/page.tsx` — SettingsForm, AddDivision, AssignPic, InvitePic onto kit; replace native `<input type=checkbox>` in InvitePic with shadcn `Checkbox`.

`cn` is imported from `@/lib/utils` (existing shadcn helper). shadcn UI components live under `@/components/ui/*`.

---

### Task 1: Validation helper

**Files:**
- Create: `app/components/eventid/form/validate.ts`

- [ ] **Step 1: Write the helper**

```ts
// app/components/eventid/form/validate.ts
// Tiny synchronous form-validation helper. No dependencies.
// Usage:
//   const errors = validate({ name, division }, { name: [required()], division: [required("Pick a division")] });
//   if (Object.keys(errors).length) { setErrors(errors); return; }

export type Rule = (value: unknown) => string | null;

export const required =
  (msg = "Required"): Rule =>
  (v) => {
    if (v == null) return msg;
    if (typeof v === "string" && v.trim() === "") return msg;
    return null;
  };

export const email =
  (msg = "Enter a valid email"): Rule =>
  (v) => {
    if (typeof v !== "string" || v.trim() === "") return null; // pair with required() if mandatory
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : msg;
  };

export function validate<T extends Record<string, unknown>>(
  values: T,
  rules: Partial<Record<keyof T, Rule[]>>,
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {};
  for (const key in rules) {
    for (const rule of rules[key] ?? []) {
      const err = rule(values[key]);
      if (err) {
        errors[key] = err;
        break;
      }
    }
  }
  return errors;
}
```

- [ ] **Step 2: Verify the logic with a one-off node snippet**

Run (PowerShell, from repo root):

```
npx tsx -e "import {validate,required,email} from './app/components/eventid/form/validate.ts'; console.log(JSON.stringify(validate({n:'',e:'bad'},{n:[required()],e:[required(),email()]})))"
```

If `tsx` is unavailable, transpile-free check instead: run `npx tsc --noEmit` and reason through the logic. Expected validate output: `{"n":"Required","e":"Enter a valid email"}`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```
git add app/components/eventid/form/validate.ts
git commit -m "feat(eventid): add form validation helper"
```

---

### Task 2: Field + FormGrid primitives

**Files:**
- Create: `app/components/eventid/form/Field.tsx`
- Create: `app/components/eventid/form/FormGrid.tsx`

- [ ] **Step 1: Write `Field.tsx`**

```tsx
// app/components/eventid/form/Field.tsx
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  required,
  error,
  full,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  /** Span both columns inside a FormGrid. */
  full?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-2", full && "sm:col-span-2", className)}>
      <Label
        htmlFor={htmlFor}
        className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground"
      >
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Write `FormGrid.tsx`**

```tsx
// app/components/eventid/form/FormGrid.tsx
import { cn } from "@/lib/utils";

export function FormGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```
git add app/components/eventid/form/Field.tsx app/components/eventid/form/FormGrid.tsx
git commit -m "feat(eventid): add Field and FormGrid form primitives"
```

---

### Task 3: FileDrop + barrel export

**Files:**
- Create: `app/components/eventid/form/FileDrop.tsx`
- Create: `app/components/eventid/form/index.ts`

Note: the server (`/api/eventid/members`, `/api/eventid/public/submit`) already converts HEIC→JPG via `toJpeg`. FileDrop is client-only preview/selection; it must accept `.heic`/`.heif` so phone photos can be chosen.

- [ ] **Step 1: Write `FileDrop.tsx`**

```tsx
// app/components/eventid/form/FileDrop.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { UploadCloud, X } from "lucide-react";

export function FileDrop({
  value,
  onChange,
  accept = "image/*,.heic,.heif",
  id,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  id?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value || !value.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  function pick(files: FileList | null) {
    onChange(files?.[0] ?? null);
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-input bg-input/20 p-2.5">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded bg-muted text-[10px] text-muted-foreground">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            "FILE"
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{value.name}</p>
          <p className="text-xs text-muted-foreground">
            {(value.size / 1024 / 1024).toFixed(1)} MB
          </p>
        </div>
        <button
          type="button"
          aria-label="Remove file"
          onClick={() => {
            onChange(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => pick(e.target.files)}
        />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-input bg-input/10 px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-ring/60 hover:text-foreground",
          drag && "border-ring/60 text-foreground",
        )}
      >
        <UploadCloud className="h-4 w-4" /> Drag &amp; drop or click to upload
      </button>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
    </>
  );
}
```

- [ ] **Step 2: Write `index.ts` barrel**

```ts
// app/components/eventid/form/index.ts
export { Field } from "./Field";
export { FormGrid } from "./FormGrid";
export { FileDrop } from "./FileDrop";
export { validate, required, email, type Rule } from "./validate";
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```
git add app/components/eventid/form/FileDrop.tsx app/components/eventid/form/index.ts
git commit -m "feat(eventid): add FileDrop upload component + form barrel"
```

---

### Task 4: Refactor ApplyForm onto the kit

**Files:**
- Modify: `app/components/eventid/ApplyForm.tsx`

Goal: replace the four `<div className="grid gap-2">` blocks with `Field`, swap both raw file inputs for `FileDrop`, and add inline per-field validation (errors object) instead of the single banner. Keep the `Shell`, fetch, and submit wiring intact.

- [ ] **Step 1: Update imports**

Add below the existing imports:

```tsx
import { Field, FileDrop, validate, required } from "./form";
```

Remove the now-unused `Label` import (line 7) and `Input` import only if no longer used — `Input` is still used for the name field, so keep `Input`; remove `Label`.

- [ ] **Step 2: Add an errors state**

After the `const [done, setDone] = useState(false);` line, add:

```tsx
  const [errors, setErrors] = useState<Record<string, string>>({});
```

- [ ] **Step 3: Replace the `submit` validation block**

Replace the body of `submit` from `setError("");` through the two early-return validation lines with:

```tsx
    setError("");
    const errs = validate(
      { name, division: scope?.kind === "event" ? divisionId : "ok", photo, idPhoto },
      {
        name: [required("Enter your full name")],
        division: [required("Please choose a division")],
        photo: [required("Portrait photo is required")],
        idPhoto: [required("ID photo is required")],
      },
    );
    setErrors(errs);
    if (Object.keys(errs).length) return;
```

(The `division` value is set to `"ok"` when the scope is a division so the required rule passes; for event scope it uses `divisionId`.)

- [ ] **Step 4: Replace the form body**

Replace the `<form ...>` block (currently lines 103–138) with:

```tsx
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Full name" htmlFor="name" required error={errors.name}>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </Field>

          {scope.kind === "event" && (
            <Field label="Division" required error={errors.division}>
              <Select value={divisionId} onValueChange={setDivisionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a division" />
                </SelectTrigger>
                <SelectContent>
                  {scope.openDivisions?.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label="Photo (portrait)" htmlFor="photo" required error={errors.photo}>
            <FileDrop id="photo" value={photo} onChange={setPhoto} />
          </Field>

          <Field label="Identification photo" htmlFor="idphoto" required error={errors.idPhoto}>
            <FileDrop id="idphoto" value={idPhoto} onChange={setIdPhoto} />
          </Field>

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit
          </Button>
        </form>
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors. (If `Label` is reported unused elsewhere, remove its import.)

- [ ] **Step 6: Manual check**

With dev running, open a public apply link `http://localhost:3000/e/<some-event-slug>` (event-scoped). Submit empty → each field shows its own inline error in readable text. Choose a portrait image → thumbnail preview + filename + size appear, with a working remove (✕). Submitting with all fields filled still succeeds (success card shows).

- [ ] **Step 7: Commit**

```
git add app/components/eventid/ApplyForm.tsx
git commit -m "refactor(eventid): rebuild ApplyForm on the form kit with inline validation"
```

---

### Task 5: MembersPanel — Add/Edit dialog on the kit

**Files:**
- Modify: `app/components/eventid/MembersPanel.tsx`

Goal: rebuild the Add Member dialog with `FormGrid` + `Field` + `FileDrop`, add inline validation, and make the same dialog handle **Edit** (name + position only — the backend `edit` action supports `full_name`/`position`; photos and division are not editable). Add a per-row edit (pencil) action that opens the dialog prefilled.

- [ ] **Step 1: Update imports**

Add:

```tsx
import { Field, FormGrid, FileDrop, validate, required } from "./form";
import { Pencil } from "lucide-react";
```

Remove the now-unused `Label` import (line 7).

- [ ] **Step 2: Add edit state + error state**

Replace the add-member state block (lines 53–60) with:

```tsx
  // add/edit-member form
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [aName, setAName] = useState("");
  const [aPos, setAPos] = useState("");
  const [aDiv, setADiv] = useState<string>(divisionId ? String(divisionId) : "");
  const [aPhoto, setAPhoto] = useState<File | null>(null);
  const [aId, setAId] = useState<File | null>(null);
  const [aErrors, setAErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
```

- [ ] **Step 3: Add open helpers (reset / prefill)**

Immediately after that state block, add:

```tsx
  function openAdd() {
    setEditId(null);
    setAName(""); setAPos(""); setADiv(divisionId ? String(divisionId) : "");
    setAPhoto(null); setAId(null); setAErrors({});
    setAddOpen(true);
  }
  function openEdit(r: MemberRow) {
    setEditId(r.id);
    setAName(r.full_name); setAPos(r.position ?? ""); setADiv(String(r.division_id));
    setAPhoto(null); setAId(null); setAErrors({});
    setAddOpen(true);
  }
```

- [ ] **Step 4: Replace `addMember` with a save handler that covers both modes**

Replace the whole `addMember` function (lines 88–107) with:

```tsx
  async function saveMember(e: React.FormEvent) {
    e.preventDefault();
    const divId = divisionId ?? Number(aDiv);
    const errs = validate(
      { name: aName, division: divisionId ? "ok" : aDiv },
      { name: [required("Name is required")], division: [required("Choose a division")] },
    );
    setAErrors(errs);
    if (Object.keys(errs).length || !eventId) return;
    setSaving(true);
    try {
      if (editId != null) {
        const res = await fetch("/api/eventid/members", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, action: "edit", full_name: aName, position: aPos }),
        });
        if (res.ok) { toast.success("Member updated"); setAddOpen(false); await load(); }
        else toast.error((await res.json()).error || "Failed");
      } else {
        const fd = new FormData();
        fd.set("event_id", String(eventId));
        fd.set("division_id", String(divId));
        fd.set("full_name", aName);
        if (aPos) fd.set("position", aPos);
        if (aPhoto) fd.set("photo", aPhoto);
        if (aId) fd.set("id_photo", aId);
        const res = await fetch("/api/eventid/members", { method: "POST", body: fd });
        if (res.ok) { toast.success("Member added"); setAddOpen(false); await load(); }
        else toast.error((await res.json()).error || "Failed");
      }
    } finally {
      setSaving(false);
    }
  }
```

- [ ] **Step 5: Replace the Add Member dialog markup**

Replace the `<Dialog open={addOpen} ...>...</Dialog>` block (lines 158–183) with:

```tsx
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openAdd}>
                  <Plus className="h-4 w-4" /> Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editId != null ? "Edit member" : "Add member"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={saveMember}>
                  <FormGrid>
                    <Field label="Full name" required error={aErrors.name} full>
                      <Input value={aName} onChange={(e) => setAName(e.target.value)} />
                    </Field>
                    <Field label="Position" error={aErrors.position}>
                      <Input value={aPos} onChange={(e) => setAPos(e.target.value)} placeholder="optional" />
                    </Field>
                    {!divisionId && (
                      <Field label="Division" required error={aErrors.division}>
                        {editId != null ? (
                          <Input value={divName(Number(aDiv))} disabled />
                        ) : (
                          <Select value={aDiv} onValueChange={setADiv}>
                            <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                            <SelectContent>
                              {divisions.map((d) => (
                                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </Field>
                    )}
                    {editId == null && (
                      <>
                        <Field label="Portrait photo" full>
                          <FileDrop value={aPhoto} onChange={setAPhoto} />
                        </Field>
                        <Field label="ID photo" full>
                          <FileDrop value={aId} onChange={setAId} />
                        </Field>
                      </>
                    )}
                  </FormGrid>
                  <DialogFooter className="mt-5">
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      {editId != null ? "Save changes" : "Add member"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
```

- [ ] **Step 6: Add the per-row edit button**

In the row actions cell, immediately after the `setDetail(r)` view button (line 227), add (only for managers):

```tsx
                    {canManage && (
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
```

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 8: Manual check**

With dev running, open `http://localhost:3000/eventid/e/<slug>` → Members tab. "Add Member" opens the redesigned dialog (2-col grid, labels, FileDrop previews). Submit empty → inline errors on name + division. Add a member successfully. Click the new pencil on a row → dialog opens prefilled, division shown disabled, photo fields hidden; change the name → "Save changes" updates the row. No dark-on-dark text in the dialog.

- [ ] **Step 9: Commit**

```
git add app/components/eventid/MembersPanel.tsx
git commit -m "feat(eventid): add/edit member dialog on form kit with inline validation"
```

---

### Task 6: MembersPanel — reject dialog + bulk actions

**Files:**
- Modify: `app/components/eventid/MembersPanel.tsx`

Goal: remove the native `prompt()` reject, add a reject-reason dialog (textarea, used by single + bulk), and add a bulk toolbar (verify/reject/clear) driven by row selection. Selection currently only renders for `enablePrint`; extend so managers can always select rows for bulk actions.

- [ ] **Step 1: Add Textarea import (and confirm it exists)**

Run: `npx shadcn@latest add textarea` only if `components/ui/textarea.tsx` does not already exist. Then add:

```tsx
import { Textarea } from "@/components/ui/textarea";
```

- [ ] **Step 2: Add reject-dialog state**

After the existing `const [saving, setSaving] = useState(false);` line, add:

```tsx
  // reject dialog (single id or bulk list)
  const [rejectIds, setRejectIds] = useState<number[] | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
```

- [ ] **Step 3: Replace `act` so reject routes through the dialog**

Keep `act` for verify but have reject open the dialog. Replace the `act` function (lines 74–81) with:

```tsx
  async function act(id: number, action: "verify" | "reject", message?: string) {
    const res = await fetch("/api/eventid/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, message }),
    });
    if (res.ok) return true;
    toast.error((await res.json()).error || "Failed");
    return false;
  }

  async function verify(id: number) {
    if (await act(id, "verify")) { toast.success("Verified — now a member"); await load(); }
  }

  async function confirmReject() {
    if (!rejectIds) return;
    setBulkBusy(true);
    try {
      const results = await Promise.all(rejectIds.map((id) => act(id, "reject", rejectReason)));
      const ok = results.filter(Boolean).length;
      if (ok) toast.success(`Rejected ${ok} ${ok === 1 ? "member" : "members"}`);
    } finally {
      setBulkBusy(false);
      setRejectIds(null);
      setRejectReason("");
      setSelected(new Set());
      await load();
    }
  }

  async function bulkVerify(ids: number[]) {
    setBulkBusy(true);
    try {
      const results = await Promise.all(ids.map((id) => act(id, "verify")));
      const ok = results.filter(Boolean).length;
      if (ok) toast.success(`Verified ${ok} ${ok === 1 ? "member" : "members"}`);
    } finally {
      setBulkBusy(false);
      setSelected(new Set());
      await load();
    }
  }
```

- [ ] **Step 4: Update single-row verify/reject buttons**

In the row actions, change the verify button's `onClick` (line 229) from `() => act(r.id, "verify")` to `() => verify(r.id)`, and change the reject button's `onClick` (line 232) from `() => act(r.id, "reject", prompt(...) ?? undefined)` to:

```tsx
                      onClick={() => { setRejectReason(""); setRejectIds([r.id]); }}
```

- [ ] **Step 5: Always render the row checkbox for managers**

The checkbox cell currently renders only when `enablePrint`. Change the header cell (line 192) and body cell (lines 207–215) condition from `enablePrint` to `(enablePrint || canManage)`, and adjust the empty/loading `colSpan` (lines 202, 204) from `6` to a computed value. Replace those two `colSpan={6}` with `colSpan={(enablePrint || canManage) ? 6 : 5}`. The checkbox should render for any selectable row; relax the inner `r.status === "member"` guard to also allow selection of `applicant`/`rejected` rows so bulk verify/reject works:

```tsx
                {(enablePrint || canManage) && (
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() =>
                        setSelected((p) => {
                          const n = new Set(p);
                          n.has(r.id) ? n.delete(r.id) : n.add(r.id);
                          return n;
                        })
                      }
                    />
                  </TableCell>
                )}
```

- [ ] **Step 6: Add the bulk toolbar above the table**

Directly before the `<div className="rounded-md border">` table wrapper (line 188), insert:

```tsx
      {canManage && selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={() => bulkVerify([...selected].filter((id) => rows.some((r) => r.id === id && r.status !== "member")))}
            >
              <Check className="h-4 w-4" /> Verify
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={() => { setRejectReason(""); setRejectIds([...selected].filter((id) => rows.some((r) => r.id === id && r.status !== "rejected"))); }}
            >
              <X className="h-4 w-4" /> Reject
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}
```

- [ ] **Step 7: Add the reject-reason dialog**

Before the closing `</div>` of the component (just before the `<Sheet ...>` detail panel at line 253), add:

```tsx
      <Dialog open={!!rejectIds} onOpenChange={(o) => { if (!o) { setRejectIds(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject {rejectIds && rejectIds.length > 1 ? `${rejectIds.length} members` : "member"}
            </DialogTitle>
          </DialogHeader>
          <Field label="Reason" htmlFor="reject-reason">
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Optional — shown to reviewers"
            />
          </Field>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setRejectIds(null); setRejectReason(""); }}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={bulkBusy} onClick={confirmReject}>
              {bulkBusy && <Loader2 className="h-4 w-4 animate-spin" />} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 8: Typecheck + lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 9: Manual check**

Members tab: rejecting a single row now opens the reason dialog (no browser `prompt()`); confirming rejects and toasts. Selecting multiple rows shows the bulk toolbar; "Verify" promotes all non-members, "Reject" opens the dialog and rejects all, "Clear" deselects. Toolbar text and buttons are clearly readable on the ink background.

- [ ] **Step 10: Commit**

```
git add app/components/eventid/MembersPanel.tsx
git commit -m "feat(eventid): reject-reason dialog and bulk verify/reject"
```

---

### Task 7: Workspace + events forms on the kit (and contrast fix)

**Files:**
- Modify: `app/eventid/events/page.tsx`
- Modify: `app/eventid/e/[slug]/page.tsx`

Goal: bring the create-event, settings, add-division, assign-PIC, and invite-PIC forms onto `Field`/`FormGrid`, give them inline validation where they had silent failures, and replace the native `<input type=checkbox>` in InvitePic (the dark-on-dark culprit) with shadcn `Checkbox`.

- [ ] **Step 1: events/page.tsx — imports + create-form**

In `app/eventid/events/page.tsx` add `import { Field } from "@/app/components/eventid/form";` and remove the `Label` import. Replace the `<CardContent className="flex flex-wrap items-end gap-3">...</CardContent>` block (lines 59–65) with:

```tsx
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Event name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pesta Inklusif 2026" />
              </Field>
              <Field label="Description">
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" />
              </Field>
              <Button onClick={create} disabled={!name.trim()}>
                <Plus className="h-4 w-4" /> Create
              </Button>
            </div>
          </CardContent>
```

- [ ] **Step 2: [slug]/page.tsx — imports**

In `app/eventid/e/[slug]/page.tsx` add:

```tsx
import { Field } from "@/app/components/eventid/form";
import { Checkbox } from "@/components/ui/checkbox";
```

Remove the `Label` import only if no remaining usage (the Overview "Public application link" label at line 128 uses `<Label>` — keep `Label`).

- [ ] **Step 3: SettingsForm onto Field**

Replace the `<CardContent className="space-y-3 max-w-md">...</CardContent>` block inside `SettingsForm` (lines 280–292) with:

```tsx
      <CardContent className="space-y-3 max-w-md">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Slug (URL)" required>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <Input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} />
          </Field>
          <Field label="Ends">
            <Input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
          </Field>
        </div>
        <Button
          disabled={!name.trim() || !slug.trim()}
          onClick={async () => {
            const slugChanged = slug !== event.slug;
            await onSaved({ name, slug, starts_on: starts || null, ends_on: ends || null });
            if (slugChanged) window.location.href = `/eventid/e/${slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
          }}
        >
          Save
        </Button>
      </CardContent>
```

- [ ] **Step 4: InvitePic — replace native checkboxes**

In `InvitePic`, replace the `<div className="grid gap-2"><Label>Email</Label>...` + the `<div className="flex flex-wrap gap-3">...</div>` block (lines 251–261) with:

```tsx
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pic@example.com" />
        </Field>
        <div className="space-y-1.5">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Divisions</p>
          <div className="flex flex-wrap gap-3">
            {divisions.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={sel.includes(d.id)}
                  onCheckedChange={(c) => setSel((s) => (c ? [...s, d.id] : s.filter((x) => x !== d.id)))}
                />
                {d.name}
              </label>
            ))}
          </div>
        </div>
```

`Label` is still imported and used elsewhere in this file (Overview link label), so leave the import.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 6: Manual check**

`http://localhost:3000/eventid/events`: create form is a clean labeled grid; Create is disabled until a name is typed. `http://localhost:3000/eventid/e/<slug>`: Settings fields are labeled and Save disables when name/slug empty. Team tab → Invite PIC: division checkboxes are now visible shadcn checkboxes (no dark-on-dark), toggling them works and Send Invite posts the selected divisions.

- [ ] **Step 7: Commit**

```
git add app/eventid/events/page.tsx app/eventid/e/[slug]/page.tsx
git commit -m "refactor(eventid): workspace forms on form kit; fix dark-on-dark checkboxes"
```

---

### Task 8: Full-flow verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + lint the whole project**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds (catches RSC/"use client" boundary issues the dev server may tolerate).

- [ ] **Step 3: Manual end-to-end against the running dev app**

Confirm each, on http://localhost:3000:
- Public apply (event + division scope): inline validation, FileDrop preview/remove, successful submit.
- Members: add (with photos), edit (name/position prefilled), single reject via dialog, bulk verify, bulk reject via dialog, delete.
- Events: create disabled-until-valid, settings save.
- Team: invite PIC with shadcn checkboxes; assign existing PIC.
- Scan every EventID form for any remaining dark-on-dark or unreadable text — there should be none.

- [ ] **Step 4: Final commit (if the build surfaced fixes)**

```
git add -A
git commit -m "chore(eventid): form rework verification fixes"
```

---

## Self-Review

**Spec coverage:**
- Raw file inputs → FileDrop (Tasks 3,4,5). ✓
- Cramped flex rows → FormGrid/Field (Tasks 4,5,7). ✓
- No inline validation → validate + Field error (Tasks 1,4,5,7). ✓
- Inconsistent layout → shared kit across all forms (Tasks 4–7). ✓
- Dark-on-dark → native file inputs replaced by FileDrop; native checkbox replaced by shadcn Checkbox; final sweep (Tasks 5,7,8). ✓
- Native prompt() reject → reject dialog (Task 6). ✓
- No edit member → edit mode in dialog + row pencil (Task 5). ✓
- No bulk actions → bulk toolbar verify/reject (Task 6). ✓
- Weak feedback → disabled/spinner states + toasts on every action (Tasks 4,5,6,7). ✓

**Type consistency:** `Field`/`FormGrid`/`FileDrop`/`validate`/`required`/`email` names match across the barrel (Task 3) and all consumers. `act` returns `boolean` after Task 6 and is only consumed by `verify`/`bulkVerify`/`confirmReject` (updated in the same task). `saveMember` replaces `addMember` and is the only `onSubmit` consumer.

**Placeholder scan:** No TBD/TODO; every code step contains full code.

**Note on TDD:** This repo has no test runner; per the verification model at the top, tasks are verified by typecheck + lint + build + manual checks rather than automated tests.
```
