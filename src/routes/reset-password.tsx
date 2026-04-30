import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({ component: ResetPage });

// Synchronously detect a recovery link in the URL hash so we can render the
// form on first paint instead of waiting for an auth event that may have
// already fired before our listener attached.
function hashLooksLikeRecovery() {
  if (typeof window === "undefined") return false;
  const h = window.location.hash || "";
  return h.includes("type=recovery") || h.includes("access_token=");
}

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<boolean>(hashLooksLikeRecovery());

  useEffect(() => {
    // Listener catches PASSWORD_RECOVERY / SIGNED_IN / INITIAL_SESSION events.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_IN" ||
        (event === "INITIAL_SESSION" && s)
      ) {
        setReady(true);
      }
    });
    // Fallback: if a session is already established, allow the form.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    // Sign out so they re-authenticate cleanly with the new password.
    await supabase.auth.signOut();
    setBusy(false);
    toast.success("Password updated. Please sign in.");
    navigate({ to: "/login" });
  };

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Enter and confirm your new password."
      footer={<Link to="/login" className="text-foreground hover:underline">Back to sign in</Link>}
    >
      {!ready ? (
        <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-sm text-muted-foreground space-y-3">
          <p>
            Open this page from the password-reset email link. If you got here directly,
            request a new link.
          </p>
          <Link to="/forgot-password" className="inline-block text-gold-shine hover:underline">
            Request a new reset link →
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" required minLength={8} autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" required minLength={8} autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1.5" />
          </div>
          <Button type="submit" disabled={busy}
            className="w-full bg-gold-shine text-[oklch(0.16_0.02_75)] hover:opacity-90 font-semibold">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
