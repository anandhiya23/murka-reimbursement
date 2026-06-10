# EventID Redesign — System Design (Flow, UI, UX)

Status: **proposal for review** (no code yet). Supersedes the phase-1 EventID flow.

## Why
Phase 1 modeled public submissions as *requests to review*. The real domain is **event
committee members who need printed IDs**. The request/member split is artificial, navigation is
flat (no per-event context), PICs can't self-serve their public link or add people directly, and
the UI uses `alert/prompt/confirm` + hand-rolled tables. This redesign fixes all of that.

Confirmed decisions: **members-centric** · **slugs only** (no opaque tokens) · **auto member
numbers per event** · shadcn-based UI overhaul.

---

## 1. Domain reframe — Members, not Requests

Single core entity `eventid_members` with a lifecycle:

```
status:  applicant ──verify──▶ member ──print──▶ (printed_at set)
              └─────reject─────▶ rejected
source:  public        (came from the public form, needs verifying)
       | pic           (PIC added directly, already a member)
```

- Public form → `status=applicant`, `source=public`.
- PIC "Add Member" → `status=member`, `source=pic` (trusted, skips verify).
- Verify an applicant → `status=member`, assign `member_no`.
- Members = printable roster. Applicants = intake queue. No member accounts (just rows).

---

## 2. Schema changes

```sql
-- events
alter table eventid_events add column slug text unique;        -- admin-editable
alter table eventid_events add column member_counter int not null default 0; -- auto-no source
alter table eventid_events drop column public_token;           -- replaced by slug

-- divisions
alter table eventid_divisions add column slug text;            -- unique within event
alter table eventid_divisions add constraint uq_div_slug unique (event_id, slug);
alter table eventid_divisions drop column public_token;

-- requests -> members
alter table eventid_requests rename to eventid_members;
-- status values migrate: pending->applicant, approved->member, rejected->rejected
alter table eventid_members add column source text default 'public';   -- public | pic
alter table eventid_members add column member_no text;                 -- e.g. 0001 (per event)
alter table eventid_members add column position text;                  -- optional role/title
-- printed_at already reserved in phase-1 plan; add if absent
alter table eventid_members add column printed_at timestamptz;
```

**Slug generation:** slugify(name) + uniqueness suffix on create; admin can edit event slug in
Settings (revalidate uniqueness). Division slug unique within its event.

**Auto member_no (per event, gap-free, concurrency-safe):** on transition to `member` (verify or
PIC add), atomically bump the event counter and format:
```sql
update eventid_events set member_counter = member_counter + 1
where id = $event returning member_counter;   -- e.g. 7 -> "0007"
```
Run inside the same service-role request, set `member_no = lpad(counter::text,4,'0')`. Members
keep their number for life; rejected/applicant rows have none. (Format configurable later, e.g.
prefix from event slug.)

---

## 3. URLs — slugs only

| Purpose | URL |
|---|---|
| Event-wide public form | `/e/[eventSlug]` |
| Division-locked public form | `/e/[eventSlug]/[divisionSlug]` |
| Admin/PIC workspace | `/eventid/e/[eventSlug]/...` |

- No more token generation. **PIC always has a copy-able division link** (`/e/slug/div`).
- Closed event → submit blocked server-side (slug resolves, `is_open=false` rejects).
- Tradeoff accepted: links are guessable; the form is public by design, gov-ID scans stay in the
  private bucket (signed URLs only).

---

## 4. Roles

| Capability | PIC (own divisions) | Admin / super-admin |
|---|---|---|
| Copy division public link | ✅ | ✅ |
| Add member directly | ✅ | ✅ |
| Verify / reject applicants | ✅ | ✅ |
| Edit / remove members | ✅ | ✅ |
| Create event, edit slug, open/close | — | ✅ |
| Create divisions, assign/invite PIC | — | ✅ |
| View all members across event | own divisions | ✅ |
| Print IDs | own divisions (optional) | ✅ |

Invite-as-PIC flow unchanged (email invite → set password → scoped to assigned divisions).

---

## 5. Information architecture — event workspace

Replace flat pages with an **event-scoped workspace** (the main UX win).

```
/eventid                         Launcher
   Admin: Events grid (cards: name, open/closed, #members)  + "New Event"
   PIC:   My Divisions (grouped by event)

/eventid/e/[slug]                EVENT WORKSPACE  (tabbed)
   ├─ Overview    stat cards: applicants / members / printed; open/close switch; quick links
   ├─ Members     data table: filter by division + status; bulk Verify; bulk Print; row → detail sheet
   ├─ Divisions   list: slug, copy public link, PIC chips, add/delete           (admin)
   ├─ Team        assign existing / invite new PIC                              (admin)
   └─ Settings    name, slug (editable), dates, open/close                       (admin)

PIC view = same workspace, scoped: Overview (their divisions) + Members (their divisions) +
their division public links. No Divisions/Team/Settings tabs.
```

Global: ⌘K command palette to jump between events/divisions.

---

## 6. UI components (shadcn)

| Surface | Component |
|---|---|
| Members table (hundreds, sort/filter/paginate/select) | `data-table` (TanStack) |
| Member detail (photo + ID via signed URL) | `sheet` slide-over |
| Add / edit member | `dialog` + `form` (react-hook-form + zod) |
| Status | `badge` — applicant amber / member green / rejected red |
| Open/close | `switch` |
| Event nav | `tabs` + `command` (⌘K) |
| Confirmations | `alert-dialog` (replaces `confirm`) |
| Feedback | `sonner` toasts (replaces `alert`) |
| Public apply | centered `card` + `form` + drag/drop file `input` + success state |
| Stat cards | `card` |

Removes all `alert/prompt/confirm` and the hand-rolled `project-item` lists.

---

## 7. Flows

**Public applicant** — `/e/[slug]` (or `/e/[slug]/[div]`): name + photo + ID photo → submit →
"received." Row = `applicant`. Closed event → friendly "not accepting" screen.

**PIC** — Division/Members tab with sub-tabs [Applicants | Members]:
- Applicant → open sheet (photo + ID) → **Verify** (→member, gets member_no) or **Reject**.
- **+ Add Member** dialog → fill name/photo/(ID optional)/position → instant `member` + member_no.
- Copy public link button always visible.

**Admin print** — Event → Members → filter `status=member` → select (or all) → **Print** → PDF
(existing pdf-lib pipeline, now prints `member_no` on card) → set `printed_at`, optional "exclude
already printed" filter.

---

## 8. API surface (rename + add)

```
/api/eventid/events            + slug create/edit, drop token actions
/api/eventid/divisions         + slug, drop token actions
/api/eventid/members           (was /requests)
     GET    list (scoped, signed photo urls)
     POST   add member directly (source=pic, status=member, member_no)   [PIC/admin]
     PATCH  action: verify | reject | edit                               [verify assigns member_no]
     DELETE remove + photos
/api/eventid/public/resolve    by slug (event or event+division)
/api/eventid/public/submit     by slug; status=applicant, source=public
/api/eventid/print             prints status=member; stamps printed_at; member_no on card
/api/eventid/me                unchanged (role + divisions)
```

Card renderer (`lib/id-card-pdf.ts`): add `member_no` line.

---

## 9. Migration steps (when approved)
1. SQL migration: rename table, status map, add columns, slugs backfill, drop tokens.
2. shadcn init + add components (`data-table, sheet, dialog, form, badge, switch, tabs, command,
   alert-dialog, sonner, card`).
3. Build event workspace shell + tabs; port Members to data-table.
4. Wire member lifecycle (verify/add/reject), auto member_no.
5. Public `/e/[slug]` slug routes; retire `/eventid/apply/[token]`.
6. Update proxy public prefixes (`/e/`, keep `/api/eventid/public`).
7. Update print to include member_no + printed_at.

## 10. Open items (default picks in parens)
- Card shows member_no? (yes)
- "Exclude already-printed" filter on print? (yes, nice-to-have)
- ID photo required for PIC-added members? (optional)
- Keep `/eventid/apply/[token]` as redirect for old shared links? (no — none in the wild yet)
- member_no format: plain `0007` vs `SLUG-0007` (plain now; prefix later if wanted)
```
