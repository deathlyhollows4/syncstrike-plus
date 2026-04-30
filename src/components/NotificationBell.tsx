import { useEffect, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { playBeep } from "@/lib/audio";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  is_urgent: boolean;
  created_at: string;
  task_id: string | null;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) {
      setItems(data as Notification[]);
      data.forEach((n) => seenIds.current.add(n.id));
    }
  };

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          if (seenIds.current.has(n.id)) return;
          seenIds.current.add(n.id);
          setItems((prev) => [n, ...prev].slice(0, 30));
          if (n.is_urgent) playBeep(880, 250);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unread = items.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    const ids = items.filter((n) => !n.is_read).map((n) => n.id);
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span
              className={`absolute top-1 right-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                items.some((n) => !n.is_read && n.is_urgent)
                  ? "bg-destructive text-destructive-foreground pulse-gold"
                  : "bg-gold-shine text-[oklch(0.16_0.02_75)]"
              }`}
            >
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display font-semibold">Notifications</h3>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            items.map((n) => (
              <Link
                key={n.id}
                to="/tasks"
                className={`block border-b border-border/60 px-4 py-3 hover:bg-accent/40 transition ${!n.is_read ? "bg-accent/20" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {n.is_urgent && (
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    {n.body && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                    )}
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
