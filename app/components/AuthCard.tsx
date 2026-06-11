import { Card, CardContent } from "@/components/ui/card";

// Centered auth shell shared by login / forgot-password / set-password.
export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-5 p-6 sm:p-8">
          <img src="/murka-logo-dark.svg" alt="Murka" className="h-6 w-auto self-start" />
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
