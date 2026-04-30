import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { clsx } from "clsx";
import {
  Calendar,
  ListTodo,
  Users,
  BarChart3,
  MessageSquare,
  Shield,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { UserAvatar } from "@/components/UserAvatar";
import { useProfile } from "@/hooks/useProfiles";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const NAV = [
  { to: "/dashboard", label: "Chrono", icon: Calendar },
  { to: "/tasks", label: "Tasks", icon: ListTodo },
  { to: "/teams", label: "Teams", icon: Users },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

function AppLayout() {
  const { user, loading, role, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const profile = useProfile(user?.id);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border/60 bg-sidebar p-4">
        <div className="mb-8 px-2">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => {
            const active = loc.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/admin"
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                loc.pathname.startsWith("/admin") ? "bg-card/60 text-[oklch(0.16_0.02_75)]" : "text-gold-shine hover:bg-sidebar-accent/50",
              )}
            >
              <Shield
                className="h-4 w-4 mr-3"
                style={{
                  color: loc.pathname.startsWith("/admin") ? "var(--primary-foreground)" : "var(--gold)",
                }}
              />
              <span className="truncate">Admin</span>
            </Link>
          )}
        </nav>
        <div className="mt-4 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/30 p-3">
          <div className="flex items-center gap-2.5">
            <UserAvatar
              url={profile?.avatar_url}
              name={profile?.display_name}
              email={user.email}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                {profile?.display_name ?? user.email}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {role ?? "loading…"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="mt-3 w-full justify-start text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 sm:px-8 py-3">
            <div className="md:hidden">
              <Logo />
            </div>
            <div className="hidden md:block" />
            <div className="flex items-center gap-1">
              <NotificationBell />
              <Link to="/profile">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <UserAvatar
                    url={profile?.avatar_url}
                    name={profile?.display_name}
                    email={user.email}
                    size="sm"
                  />
                </Button>
              </Link>
            </div>
          </div>
          {/* mobile nav */}
          <div className="md:hidden flex gap-1 overflow-x-auto px-4 pb-3">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md border border-border/40 px-3 py-1.5 text-xs whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-gold-shine whitespace-nowrap"
              >
                Admin
              </Link>
            )}
          </div>
        </header>
        <main className="flex-1 px-4 sm:px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
