import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <div className="relative h-9 w-9 rounded-lg bg-gold-shine elevated flex items-center justify-center overflow-hidden">
        <span className="font-display text-[15px] font-black text-[oklch(0.16_0.02_75)]">S</span>
        <span className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,oklch(1_0_0/40%)_50%,transparent_70%)] -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
      </div>
      <span className="font-display text-lg font-bold tracking-tight">
        Sync<span className="text-gold-shine">Strike</span>
      </span>
    </Link>
  );
}
