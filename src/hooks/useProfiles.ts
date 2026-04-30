import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileLite {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

// Module-level cache shared across all hook consumers
const cache = new Map<string, ProfileLite>();
const inflight = new Map<string, Promise<void>>();
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((cb) => cb());
}

async function fetchMissing(ids: string[]) {
  const missing = ids.filter((id) => id && !cache.has(id) && !inflight.has(id));
  if (missing.length === 0) return;

  const promise = (async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, display_name, avatar_url")
      .in("id", missing);
    (data ?? []).forEach((p: any) => cache.set(p.id, p as ProfileLite));
    // Mark any IDs still missing (e.g. deleted users) so we don't refetch forever
    missing.forEach((id) => {
      if (!cache.has(id)) {
        cache.set(id, { id, email: "", display_name: null, avatar_url: null });
      }
    });
    notify();
  })();

  missing.forEach((id) => inflight.set(id, promise));
  await promise;
  missing.forEach((id) => inflight.delete(id));
}

export function useProfiles(ids: ReadonlyArray<string | null | undefined>) {
  const cleanIds = Array.from(
    new Set(ids.filter((x): x is string => typeof x === "string" && x.length > 0)),
  );
  const key = cleanIds.sort().join(",");

  const [, force] = useState(0);

  useEffect(() => {
    const cb = () => force((n) => n + 1);
    subscribers.add(cb);
    fetchMissing(cleanIds);
    return () => {
      subscribers.delete(cb);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const map: Record<string, ProfileLite> = {};
  cleanIds.forEach((id) => {
    const p = cache.get(id);
    if (p) map[id] = p;
  });
  return map;
}

export function useProfile(id: string | null | undefined) {
  const map = useProfiles(id ? [id] : []);
  return id ? map[id] ?? null : null;
}

// Allow external code to invalidate cache (e.g. after profile update)
export function invalidateProfile(id: string) {
  cache.delete(id);
  notify();
}
