"use client";

import { useParams } from "next/navigation";
import ApplyForm from "@/app/components/eventid/ApplyForm";

export default function PublicDivisionApply() {
  const { slug, division } = useParams();
  return <ApplyForm eventSlug={String(slug)} divisionSlug={String(division)} />;
}
