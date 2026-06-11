// EventID admin tool shell. Uses the site's default light theme so form
// fields and text stay legible, matching the rest of the website.
export default function EventidLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh font-sans antialiased">
      {children}
    </div>
  );
}
