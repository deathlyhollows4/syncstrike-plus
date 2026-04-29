import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
export const Route = createFileRoute("/_app/teams")({ component: () => <Stub title="Teams" /> });
function Stub({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      <Construction className="h-12 w-12 text-gold-shine" />
      <h1 className="mt-6 font-display text-3xl font-bold">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Coming up next. The backend is ready — just iterating on the UI.
      </p>
    </div>
  );
}
