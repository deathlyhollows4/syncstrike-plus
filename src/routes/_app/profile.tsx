import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, role } = useAuth();
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const updatePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("At least 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPwd(""); toast.success("Password updated");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Account</p>
        <h1 className="font-display text-3xl font-bold mt-1">Profile</h1>
      </div>

      <Card className="p-6 surface border-border/60 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Email</p>
          <p className="font-medium">{user?.email}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Role</p>
          <p className="font-medium capitalize">{role}</p>
        </div>
      </Card>

      <Card className="p-6 surface border-border/60">
        <h2 className="font-display text-lg font-semibold">Change password</h2>
        <form onSubmit={updatePwd} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="np">New password</Label>
            <Input id="np" type="password" minLength={8} value={pwd}
              onChange={(e) => setPwd(e.target.value)} className="mt-1.5" />
          </div>
          <Button type="submit" disabled={busy}
            className="bg-gold-shine text-[oklch(0.16_0.02_75)] hover:opacity-90 font-semibold">
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
}
