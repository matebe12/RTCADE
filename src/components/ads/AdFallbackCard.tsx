import { Gamepad2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdFallbackCardProps {
  description: string;
  title: string;
}

export function AdFallbackCard({ description, title }: AdFallbackCardProps) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm shadow-primary/5">
      <CardHeader className="gap-3 px-4 py-4">
        <div className="flex size-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Gamepad2 className="size-5" />
        </div>
        <CardTitle className="text-sm leading-5 text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 text-xs leading-5 text-muted-foreground">
        {description}
      </CardContent>
    </Card>
  );
}