import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  url?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
};

export function UserAvatar({
  url,
  name,
  email,
  size = "md",
  className,
}: UserAvatarProps) {
  const initial = (name || email || "?").trim().charAt(0).toUpperCase() || "?";
  const safeUrl = typeof url === "string" && url.trim().length > 0 ? url.trim() : undefined;

  return (
    <Avatar className={cn(SIZE_CLASSES[size], className)}>
      {safeUrl && <AvatarImage src={safeUrl} alt={name ?? email ?? "User avatar"} />}
      <AvatarFallback className="bg-gold-shine text-[oklch(0.16_0.02_75)] font-bold">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
