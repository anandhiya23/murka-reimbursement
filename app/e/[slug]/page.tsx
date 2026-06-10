"use client";

import { useParams } from "next/navigation";
import ApplyForm from "@/app/components/eventid/ApplyForm";

export default function PublicEventApply() {
  const { slug } = useParams();
  return <ApplyForm eventSlug={String(slug)} />;
}
