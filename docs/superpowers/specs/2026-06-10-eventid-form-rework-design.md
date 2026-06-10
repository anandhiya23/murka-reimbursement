# EventID Form Rework — Design

**Date:** 2026-06-10
**Status:** Approved (design), pending spec review
**Approach:** A — Shared form primitives, no new dependencies

## Problem

The EventID feature has 8 forms that grew independently. The user's complaints:

**Structure**
- Photo / ID photo fields are bare `<input type="file">` — no drag-drop, no preview, no remove.
- Fields jammed into flex rows (event create, add division, assign PIC) — no labels, no spacing, inconsistent.
- No inline validation — errors only surface as one post-submit banner, no per-field feedback or required markers.
- Every form is structured differently (some dialog, some inline, some card) — no shared pattern.
- **Some text is dark-on-dark** — unreadable against the ink background.

**Actions / missing features**
- Reject member uses native `prompt()` for the reason — ugly, no validation.
- No way to **edit** an existing member's fields.
- No **bulk actions** — verify/reject is one row at a time.
- Weak feedback — buttons lack clear loading/disabled states; actions fire silently.

## Goal

One consistent, accessible, on-brand (ink + acid-lime) form system applied across all EventID forms, plus the missing member-management features. No new runtime dependencies — built on the existing shadcn/radix primitives.

## Form Kit

New directory `app/components/eventid/form/`:

### `Field`
Wrapper rendering: uppercase label, lime `*` required marker, the control (as children), and an inline per-field error message below. Sets the error border state on the control when an error is present. Replaces ad-hoc `Label` + `Input` pairings everywhere.

Props: `label`, `required?`, `error?`, `htmlFor?`, `children`.

### `FileDrop`
Replaces raw file inputs. States:
- **Empty:** dashed drag-drop zone, click-to-browse, accepts JPG/PNG/HEIC.
- **Filled:** thumbnail preview, filename + size, remove (✕) button.
- Integrates existing `heic-convert` so HEIC uploads preview/convert to JPG; shows a "converted to JPG" hint.

Props: `value: File | null`, `onChange`, `accept?`, `label?` (passed through Field by caller).

### `FormGrid`
Responsive 2-column grid (single column on narrow widths) with consistent gap. `FormGrid.Full` (or a `full` prop on Field) spans both columns. Kills the cramped flex rows.

### `validate` helper
Small synchronous helper (no new dep): takes field values + a rules object, returns `{ field: errorMessage }`. Forms hold an `errors` state object; `Field` reads its own error. Runs on submit and clears a field's error on change. Keeps validation declarative without react-hook-form/zod.

## Theme contrast fix

Audit the eventid theme tokens (the `eventid-theme` / ink+lime scope introduced in commit 450c667) and the affected form/table markup. Ensure all body text, placeholders, labels, select items, and table cells meet readable contrast on the ink background. Lime is reserved for primary actions and active/selected states, not body text.

## Member-management features

### Edit member
Reuse the Add Member dialog for editing — same kit, fields prefilled from the row, submits a PATCH instead of POST. Add an edit (pencil) action to each table row.

### Bulk actions
When ≥1 row checkbox is selected, show a bulk toolbar above the table: selected count, **Verify selected**, **Reject selected**, **Clear**. Verify/Reject iterate the existing single-row endpoints (or a batch endpoint if trivial) and report aggregate success/failure via sonner.

### Reject-reason dialog
Replace `prompt()` with a proper dialog: a `Field` textarea for the reason (required) + Cancel / Confirm reject. Used by both single-row reject and bulk reject.

### Feedback states
Every submit/action button: disabled + spinner while pending, restored on completion, sonner toast on success/error. No silent fires.

## Forms to refactor onto the kit

1. Public Apply form (`ApplyForm.tsx`)
2. Add/Edit Member dialog (`MembersPanel.tsx`)
3. Create Event (`eventid/events/page.tsx`)
4. Event Settings (`eventid/e/[slug]/page.tsx`)
5. Add Division (same page)
6. Assign PIC (same page)
7. Invite PIC (same page) — division checkboxes restyled consistently

## Out of scope

- New backend data model changes beyond an edit-member PATCH (and an optional batch verify/reject endpoint).
- react-hook-form / zod or any new dependency.
- Redesign of non-form surfaces (table columns, navigation, public landing) beyond the contrast fix.

## Testing

- Manual verification of each refactored form in the running dev app (forms are client UI; primary check is behavioral parity + the new features).
- Confirm: required validation blocks submit with inline errors; FileDrop preview/remove works incl. HEIC; edit prefills and PATCHes; bulk verify/reject updates rows; reject dialog requires a reason; no dark-on-dark text remains.
- Lint passes (`eslint`).

## Constraint

Per `AGENTS.md`: this is a modified Next.js (16.2.2) with breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing code that touches Next.js APIs/conventions.
