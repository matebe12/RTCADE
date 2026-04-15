import { cn } from "@/lib/utils";

interface UserBadgeProps {
  nickname: string;
  avatar: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { icon: "text-lg", text: "text-xs" },
  md: { icon: "text-2xl", text: "text-sm" },
  lg: { icon: "text-3xl", text: "text-base" },
};

export function UserBadge({ nickname, avatar, size = "md", className }: UserBadgeProps) {
  const s = sizes[size];
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={s.icon}>{avatar}</span>
      <span className={cn("font-medium text-foreground", s.text)}>{nickname}</span>
    </div>
  );
}
