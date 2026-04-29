import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
export const Route = createFileRoute("/_app/chat")({
  component: () => (
    <div className="flex flex-col items-center justify-center text-center py-24">
      <Construction className="h-12 w-12 text-gold-shine" />
      <h1 className="mt-6 font-display text-3xl font-bold">Chat</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">Realtime team chat coming next iteration.</p>
    </div>
  ),
});
