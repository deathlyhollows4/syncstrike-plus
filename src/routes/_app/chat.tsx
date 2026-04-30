import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, MessageSquare, Users } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ChatTeam { id: string; name: string; }
interface ChatMessage {
  id: string; team_id: string; sender_id: string;
  body: string; created_at: string;
}
interface Profile { id: string; email: string; display_name: string | null; }

export const Route = createFileRoute("/_app/chat")({
  validateSearch: (s: Record<string, unknown>) => ({ team: typeof s.team === "string" ? s.team : undefined }),
  component: ChatPage,
});

function ChatPage() {
  const { user } = useAuth();
  const search = useSearch({ from: "/_app/chat" });
  const navigate = useNavigate();
  const [teams, setTeams] = useState<ChatTeam[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(search.team ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Load teams I can see
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("teams").select("id, name").order("name");
      setTeams((data as ChatTeam[]) ?? []);
      if (!activeId && data && data.length) setActiveId(data[0].id);
    })();
  }, [user]);

  // Sync URL param when active changes
  useEffect(() => {
    if (activeId && activeId !== search.team) {
      navigate({ to: "/chat", search: { team: activeId } as any, replace: true });
    }
  }, [activeId]);

  // Load messages + sender profiles when team changes
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    (async () => {
      const { data } = await supabase.from("chat_messages")
        .select("*").eq("team_id", activeId)
        .order("created_at", { ascending: true }).limit(200);
      const msgs = (data as ChatMessage[]) ?? [];
      setMessages(msgs);
      const ids = Array.from(new Set(msgs.map((m) => m.sender_id)));
      if (ids.length) {
        const { data: ps } = await supabase.from("profiles")
          .select("id, email, display_name").in("id", ids);
        const map: Record<string, Profile> = {};
        (ps ?? []).forEach((p: any) => { map[p.id] = p; });
        setProfiles((prev) => ({ ...prev, ...map }));
      }
    })();
  }, [activeId]);

  // Realtime
  useEffect(() => {
    if (!activeId) return;
    const ch = supabase.channel(`chat-${activeId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `team_id=eq.${activeId}` },
        async (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          if (!profiles[m.sender_id]) {
            const { data } = await supabase.from("profiles")
              .select("id, email, display_name").eq("id", m.sender_id).maybeSingle();
            if (data) setProfiles((prev) => ({ ...prev, [m.sender_id]: data as Profile }));
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId]);

  // Auto-scroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const activeTeam = useMemo(() => teams?.find((t) => t.id === activeId) ?? null, [teams, activeId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeId || !draft.trim()) return;
    setSending(true);
    const body = draft.trim().slice(0, 2000);
    const { error } = await supabase.from("chat_messages").insert({
      body, team_id: activeId, sender_id: user.id,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setDraft("");
  };

  if (teams === null) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  }

  return (
    <div className="space-y-6 h-[calc(100vh-9rem)] flex flex-col">
      <div>
        <p className="text-sm text-muted-foreground">Realtime</p>
        <h1 className="font-display text-3xl font-bold mt-1">Team Chat</h1>
      </div>

      {teams.length === 0 ? (
        <Card className="surface border-border/60 p-12 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-gold-shine" />
          <p className="mt-4 font-display text-lg font-semibold">No teams to chat in</p>
          <p className="mt-1 text-sm text-muted-foreground">Join or create a team first.</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr] flex-1 min-h-0">
          {/* Sidebar */}
          <Card className="surface border-border/60 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Teams
            </div>
            <ul className="flex-1 overflow-y-auto divide-y divide-border/40">
              {teams.map((t) => (
                <li key={t.id}>
                  <button onClick={() => setActiveId(t.id)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-2 transition ${
                      t.id === activeId ? "bg-gold-shine/10 border-l-2 border-gold-shine" : "hover:bg-accent/30"
                    }`}>
                    <Users className="h-4 w-4 text-gold-shine" />
                    <span className="text-sm font-medium truncate">{t.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* Thread */}
          <Card className="surface border-border/60 flex flex-col overflow-hidden">
            {!activeTeam ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select a team to start chatting.
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-border/60">
                  <h2 className="font-display font-semibold">{activeTeam.name}</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {messages.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-12">
                      No messages yet. Say hi 👋
                    </p>
                  ) : messages.map((m) => {
                    const mine = m.sender_id === user?.id;
                    const p = profiles[m.sender_id];
                    const name = p?.display_name ?? p?.email?.split("@")[0] ?? "Unknown";
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                          mine
                            ? "bg-gold-shine text-[oklch(0.16_0.02_75)] rounded-br-sm"
                            : "bg-card border border-border/60 rounded-bl-sm"
                        }`}>
                          {!mine && <p className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">{name}</p>}
                          <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                          <p className={`text-[10px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                            {format(new Date(m.created_at), "p")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                <form onSubmit={send} className="border-t border-border/60 p-3 flex gap-2">
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000}
                    placeholder={`Message ${activeTeam.name}…`} className="flex-1" />
                  <Button type="submit" disabled={sending || !draft.trim()}
                    className="bg-gold-shine text-[oklch(0.16_0.02_75)] hover:opacity-90 font-semibold">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
