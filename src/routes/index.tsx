import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Bell, Users, BarChart3, MessageSquare, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen overflow-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/50 backdrop-blur-xl bg-background/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#how" className="hover:text-foreground transition">How it works</a>
            <a href="#trust" className="hover:text-foreground transition">Security</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="bg-gold-shine text-[oklch(0.16_0.02_75)] hover:opacity-90 font-semibold">
              <Link to="/signup">Get started <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-28 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-shine animate-pulse" />
              SyncStrike v2 · Realtime backend
            </span>
            <h1 className="mt-6 font-display text-5xl md:text-7xl font-black tracking-tight leading-[1.02]">
              Team productivity,
              <br />
              with <span className="text-gold-shine">rhythm</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
              Chrono-Dashboard, blocker escalation, team chat, and analytics —
              all wired to a real backend, not a sticky note.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gold-shine text-[oklch(0.16_0.02_75)] hover:opacity-90 font-semibold elevated">
                <Link to="/signup">Start for free <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-border/60">
                <Link to="/login">I have an account</Link>
              </Button>
            </div>
          </motion.div>

          {/* Floating preview card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-20 mx-auto max-w-5xl"
          >
            <div className="relative rounded-2xl border border-border/60 surface elevated p-2">
              <div className="rounded-xl border border-border/40 bg-background/60 p-6 grid md:grid-cols-3 gap-4">
                {[
                  { label: "Pending", count: 12, color: "oklch(0.68 0.018 80)" },
                  { label: "In progress", count: 7, color: "oklch(0.82 0.16 86)" },
                  { label: "Blocked", count: 2, color: "oklch(0.62 0.22 25)" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border/40 bg-card/40 p-4">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
                    <div className="mt-2 font-display text-4xl font-bold" style={{ color: s.color }}>
                      {s.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="font-display text-4xl font-bold max-w-2xl">
            Everything a small team needs.
            <span className="text-muted-foreground"> Nothing it doesn't.</span>
          </h2>
          <div className="mt-14 grid md:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="group rounded-xl border border-border/60 surface p-6 hover:border-primary/40 transition">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gold-shine text-[oklch(0.16_0.02_75)]">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto max-w-7xl px-6 flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} SyncStrike. Built on Lovable Cloud.</p>
        </div>
      </footer>
    </div>
  );
}

const features = [
  { icon: Calendar, title: "Chrono-Dashboard", desc: "Day, week, month — click any slot to schedule a task. Drag-friendly, deadline-aware." },
  { icon: Bell, title: "Blocker escalation", desc: "Blocked tasks fire urgent alerts to the creator and every admin. Audible. Inescapable." },
  { icon: Users, title: "Teams", desc: "Admins create teams, add members by email. Per-team data scopes." },
  { icon: BarChart3, title: "Analytics", desc: "7-day completion trend, status pie, peer leaderboard. Personal + team." },
  { icon: MessageSquare, title: "Realtime chat", desc: "Auto-created team channels with instant message delivery." },
  { icon: Shield, title: "Role-based access", desc: "Admins vs team members enforced at the database layer with RLS." },
];
