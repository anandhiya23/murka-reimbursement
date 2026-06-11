import { ImageIcon } from "lucide-react";

// Single 2:1 event banner surface. Renders the image when present, otherwise a
// branded placeholder (ink + acid-lime) carrying the event name — so events
// without a banner still look intentional everywhere they appear.
export default function EventBanner({
  url,
  name,
  className = "",
  rounded = "rounded-xl",
}: {
  url?: string | null;
  name?: string;
  className?: string;
  rounded?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? "Event banner"}
        className={`aspect-2/1 w-full border border-border object-cover ${rounded} ${className}`}
      />
    );
  }

  return (
    <div
      className={`relative flex aspect-2/1 w-full items-center justify-center overflow-hidden border border-border ${rounded} ${className}`}
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--primary) 14%, var(--card)) 0%, var(--card) 60%)",
      }}
    >
      {/* faint diagonal hatch for the 'backstage credential' texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, var(--foreground) 0 1px, transparent 1px 11px)",
        }}
      />
      <div className="relative flex flex-col items-center gap-2 px-4 text-center">
        <ImageIcon className="h-6 w-6 text-primary/70" />
        {name ? (
          <span className="font-display text-sm font-semibold uppercase tracking-wide text-foreground/80 line-clamp-2">
            {name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No banner yet</span>
        )}
      </div>
    </div>
  );
}
