import { Badge } from "@/components/ui/badge";

interface AdDisclosureProps {
  text: string;
}

export function AdDisclosure({ text }: AdDisclosureProps) {
  return (
    <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      {text}
    </Badge>
  );
}