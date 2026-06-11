"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import { flushSync } from "react-dom";
import Select from "react-select";
import ExpenseItem, { type ItemError } from "@/app/components/ExpenseItem";
import ReimbursementTable from "@/app/components/ReimbursementTable";
import SiteHeader from "@/app/components/SiteHeader";
import AuthCard from "@/app/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { createClient } from "@/utils/supabase/client";
import { FetchError } from "@/lib/swr";
import { LogOut, Plus, ShieldCheck, Send, KeyRound, ChevronLeft, ChevronRight } from "lucide-react";

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

interface ReimbursementGroup {
  id: number;
  group_code: string;
  requester: string;
  requester_email: string;
  approver: string;
  created_at: string;
  reimbursements: {
    id: number;
    project: string;
    expense_date: string;
    description: string;
    amount: number;
    status: string;
    proof_url: string;
    proof_files: { id: number; file_name: string; public_url: string }[];
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_message: string | null;
  }[];
}

interface UserInfo {
  email: string;
  name: string;
  avatar_url: string | null;
  isAdmin: boolean;
}

interface InitResponse {
  user: UserInfo;
  groups: ReimbursementGroup[];
  approvers: string[];
  projects: string[];
}

const emptyItem: ExpenseItemData = {
  project: "",
  expenseDate: "",
  description: "",
  amount: "",
  files: null,
};

export default function Home() {
  const { data, error, isLoading, mutate } = useSWR<InitResponse>("/api/init");

  const user = data?.user ?? null;
  const unregistered =
    error instanceof FetchError &&
    (error.info as { error?: string } | undefined)?.error === "Unregistered";

  const approverOptions = useMemo<Option[]>(
    () => (data?.approvers ?? []).map((n) => ({ value: n, label: n })),
    [data]
  );
  const projectOptions = useMemo<Option[]>(
    () => (data?.projects ?? []).map((n) => ({ value: n, label: n })),
    [data]
  );
  // Newest group first for the history table.
  const groups = useMemo<ReimbursementGroup[]>(
    () => [...(data?.groups ?? [])].reverse(),
    [data]
  );

  // `submitting` gates the form during POST; initial read uses SWR's isLoading.
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  const [approver, setApprover] = useState<Option | null>(null);

  const [items, setItems] = useState<ExpenseItemData[]>([{ ...emptyItem }]);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const scrollToLastRef = useRef(false);
  const [errors, setErrors] = useState<Record<number, ItemError>>({});
  const [approverError, setApproverError] = useState(false);
  const [removingIdx, setRemovingIdx] = useState<number | null>(null);

  // Track the active slide for the "Expense N of M" indicator + dots.
  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setCurrent(carouselApi.selectedScrollSnap());
    onSelect();
    carouselApi.on("select", onSelect);
    carouselApi.on("reInit", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
      carouselApi.off("reInit", onSelect);
    };
  }, [carouselApi]);

  // Items changed: re-scan slides so embla registers the new/removed slide,
  // then jump to the freshly added (last) one.
  useEffect(() => {
    if (!carouselApi) return;
    carouselApi.reInit();
    if (scrollToLastRef.current) {
      carouselApi.scrollTo(items.length - 1);
      scrollToLastRef.current = false;
    }
  }, [items.length, carouselApi]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  // Drop a field's error once it has a value, so the red clears as the user fixes it.
  function clearItemErrors(index: number, data: Partial<ExpenseItemData>) {
    setErrors((prev) => {
      if (!prev[index]) return prev;
      const e = { ...prev[index] };
      if (data.project) delete e.project;
      if (data.expenseDate) delete e.expenseDate;
      if (data.amount) delete e.amount;
      if (data.files && data.files.length > 0) delete e.files;
      const next = { ...prev };
      if (Object.keys(e).length > 0) next[index] = e;
      else delete next[index];
      return next;
    });
  }

  function handleItemChange(index: number, data: ExpenseItemData) {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
    clearItemErrors(index, data);
  }

  function handleFilesChange(index: number, files: File[]) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, files } : item)));
    clearItemErrors(index, { files });
  }

  function addItem() {
    scrollToLastRef.current = true;
    setItems((prev) => [...prev, { ...emptyItem }]);
    setErrors({});
  }

  function removeItem(index: number) {
    // 1) fade the card out (still mounted), 2) slide to the neighbour so the
    // invisible card moves off-screen, 3) drop it, 4) jump embla to where that
    // neighbour now lives (indices shift) so it doesn't teleport to the wrong one.
    setRemovingIdx(index);
    const neighbor = index === 0 ? 1 : index - 1;
    setTimeout(() => {
      carouselApi?.scrollTo(neighbor);
      setTimeout(() => {
        // post-removal index of the neighbour item we're viewing
        const target = neighbor > index ? neighbor - 1 : neighbor;
        flushSync(() => {
          setItems((prev) => prev.filter((_, i) => i !== index));
          setErrors({});
          setRemovingIdx(null);
        });
        // items.length effect already reInit'd during flushSync; just correct
        // the index (instant) so the viewed neighbour stays put.
        carouselApi?.scrollTo(target, true);
      }, 750);
    }, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Surface ONE error at a time: the first missing field of the first
    // incomplete expense. As the user fixes it, the next is revealed.
    let target: { idx: number; field: keyof ItemError } | null = null;
    for (let i = 0; i < items.length && !target; i++) {
      const it = items[i];
      if (!it.project) target = { idx: i, field: "project" };
      else if (!it.expenseDate) target = { idx: i, field: "expenseDate" };
      else if (!it.amount) target = { idx: i, field: "amount" };
      else if (!(it.files && it.files.length > 0)) target = { idx: i, field: "files" };
    }

    if (target) {
      setApproverError(false);
      setErrors({ [target.idx]: { [target.field]: true } });
      setStatus("");
      carouselApi?.scrollTo(target.idx);
      return;
    }

    setErrors({});
    if (!approver) {
      setApproverError(true);
      setStatus("");
      return;
    }
    setApproverError(false);

    setSubmitting(true);
    setStatus("Uploading...");

    const savedApprover = approver;
    const fd = new FormData();
    fd.append("approver", approver?.value || "");
    fd.append("idemKey", crypto.randomUUID());

    const itemsPayload = items.map((item, idx) => {
      const files = item.files ?? [];
      for (const f of files) {
        fd.append(`items[${idx}]files`, f);
      }
      return {
        project: item.project,
        expenseDate: item.expenseDate,
        description: item.description,
        amount: Number(item.amount.replace(/[^\d-]/g, "")) || 0,
        index: idx,
        fileCount: files.length,
      };
    });

    fd.append("items", JSON.stringify(itemsPayload));

    try {
      const resp = await fetch("/api/postreimburse", {
        method: "POST",
        body: fd,
      });
      const json = await resp.json();
      setStatus("Submitted successfully!");
      setItems([{ ...emptyItem }]);
      setApprover(savedApprover);

      if (json.group) {
        // Optimistically prepend the new group, then revalidate from server.
        mutate(
          (cur) =>
            cur
              ? { ...cur, groups: [...cur.groups, json.group as ReimbursementGroup] }
              : cur,
          { revalidate: true }
        );
      }
      setSubmitting(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus("Error: " + message);
      setSubmitting(false);
    }
  }

  const totalAmount = items.reduce((sum, item) => {
    const digits = item.amount.replace(/[^\d]/g, "");
    return sum + (digits ? parseInt(digits, 10) : 0);
  }, 0);

  function formatAmount(amount: number): string {
    return "Rp" + amount.toLocaleString("id-ID");
  }

  if (isLoading && !unregistered) {
    return (
      <>
        <SiteHeader actions={[]} />
        <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-4 md:p-6 lg:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader className="p-4 pb-0 md:p-6 md:pb-0"><Skeleton className="h-6 w-44" /></CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 md:p-6 md:pt-0">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <Card className="flex min-h-0 flex-col gap-3 p-4 md:p-6">
            <Skeleton className="h-9 w-full max-w-xs" />
            <div className="rounded-md border divide-y">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-none" />)}
            </div>
          </Card>
        </main>
      </>
    );
  }

  if (unregistered) {
    return (
      <AuthCard>
        <div className="space-y-2 text-center">
          <h1 className="text-lg font-semibold tracking-tight">Access Restricted</h1>
          <p className="text-sm text-muted-foreground">
            Your account is not registered as a requester. Contact an admin to get access.
          </p>
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </AuthCard>
    );
  }

  const userNode = user ? (
    <div className="mr-1 hidden items-center gap-2 sm:flex">
      {user.avatar_url && (
        <img
          src={user.avatar_url}
          alt=""
          referrerPolicy="no-referrer"
          className="h-7 w-7 rounded-full border"
        />
      )}
      <span className="text-sm text-muted-foreground">{user.name}</span>
    </div>
  ) : undefined;

  return (
    <>
      <SiteHeader
        user={userNode}
        actions={[
          ...(user?.isAdmin
            ? [{ label: "Admin", icon: ShieldCheck, href: "/reimbursement/admin" } as const]
            : []),
          { label: "Password", icon: KeyRound, href: "/account", variant: "outline" },
          { label: "Sign out", icon: LogOut, onClick: handleSignOut, variant: "outline" },
        ]}
      />

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-4 md:p-6 lg:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader className="p-4 pb-0 md:p-6 md:pb-0">
            <CardTitle>New Reimbursement</CardTitle>
            <p className="text-sm text-muted-foreground">
              Submitting as <strong className="text-foreground">{user?.name || "…"}</strong>
            </p>
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <form
              id="reimbursementForm"
              noValidate
              className={submitting ? "pointer-events-none opacity-60" : ""}
              onSubmit={handleSubmit}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">
                  Expense {current + 1} <span className="text-muted-foreground">of {items.length}</span>
                </span>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4" /> Add expense
                </Button>
              </div>

              <Carousel
                setApi={setCarouselApi}
                opts={{ align: "start" }}
                className="w-full"
              >
                <CarouselContent>
                  {items.map((item, idx) => (
                    <CarouselItem key={idx}>
                      <div
                        className={`transition-all duration-200 ${
                          removingIdx === idx ? "scale-95 opacity-0" : "opacity-100"
                        }`}
                      >
                        <ExpenseItem
                          index={idx}
                          data={item}
                          projectOptions={projectOptions}
                          showRemove={items.length > 1}
                          error={errors[idx]}
                          onChange={handleItemChange}
                          onRemove={removeItem}
                          onFilesChange={handleFilesChange}
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>

              {items.length > 1 && (
                <div className="mt-3 flex items-center justify-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => carouselApi?.scrollPrev()}
                    disabled={current === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {items.length <= 10 ? (
                    <div className="flex items-center gap-1.5">
                      {items.map((_, i) => (
                        <Button
                          key={i}
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => carouselApi?.scrollTo(i)}
                          className={`h-2 w-2 rounded-full p-0 hover:bg-foreground/60 ${i === current ? "bg-foreground" : "bg-muted-foreground/30"}`}
                          aria-label={`Go to expense ${i + 1}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {current + 1} / {items.length}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => carouselApi?.scrollNext()}
                    disabled={current === items.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {totalAmount > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-lg bg-secondary px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Total <span className="text-xs">({items.length} item{items.length !== 1 ? "s" : ""})</span>
                  </span>
                  <span className="font-mono text-lg font-bold">{formatAmount(totalAmount)}</span>
                </div>
              )}

              <div className="mt-4 space-y-1.5">
                <Label>Approver</Label>
                <Select
                  instanceId="approver"
                  options={approverOptions}
                  value={approver}
                  onChange={(opt) => {
                    setApprover(opt);
                    if (opt) setApproverError(false);
                  }}
                  placeholder="Select..."
                  isDisabled={submitting}
                  classNamePrefix="react-select"
                  classNames={{ control: () => (approverError ? "rs-invalid" : "") }}
                />
                {approverError && <p className="text-xs text-destructive">Select an approver.</p>}
              </div>

              <Button type="submit" className="mt-4 w-full" disabled={submitting}>
                <Send className="h-4 w-4" /> Submit
              </Button>
            </form>
            {status && <p className="mt-3 text-sm text-muted-foreground">{status}</p>}
          </CardContent>
        </Card>

        <ReimbursementTable groups={groups} />
      </main>
    </>
  );
}
