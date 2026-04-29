import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left visual */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 surface elevated overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gold-shine opacity-20 blur-3xl" />
        <Logo />
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">
            Block. <span className="text-gold-shine">Strike.</span> Sync.
          </h2>
          <p className="mt-4 text-muted-foreground">
            The team task ops platform that doesn't let blockers slip through the cracks.
          </p>
        </div>
        <p className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} SyncStrike</p>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8"><Logo /></div>
          <h1 className="font-display text-3xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
          <p className="mt-10 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
