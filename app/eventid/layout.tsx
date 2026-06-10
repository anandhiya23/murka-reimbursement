// Scoped "Backstage Credential" shell for the EventID admin tool. The
// dark + eventid-theme classes flip shadcn tokens to ink/acid-lime for
// everything under /eventid only — reimbursement and public /e/ stay light.
export default function EventidLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark eventid-theme min-h-dvh font-sans antialiased">
      {children}
    </div>
  );
}
