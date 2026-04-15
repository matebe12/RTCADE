import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  className?: string;
}

export function CodeInput({ value, onChange, onSubmit, className }: CodeInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.slice(0, 6).split("");
  const digits = Array.from({ length: 6 }, (_, i) => chars[i] ?? "");

  const handleChange = (index: number, char: string) => {
    if (!/^\d?$/.test(char)) return;
    const next = [...digits];
    next[index] = char;
    const newValue = next.join("").replace(/\s/g, "");
    onChange(newValue);

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (newValue.length === 6 && onSubmit) {
      onSubmit();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && value.length === 6 && onSubmit) {
      onSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  return (
    <div className={cn("flex gap-2 justify-center", className)}>
      {digits.map((d, i) => (
        <Input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          value={d}
          onChange={(e) => handleChange(i, e.target.value.slice(-1))}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          maxLength={1}
          className="size-12 text-center text-xl font-mono"
          inputMode="numeric"
        />
      ))}
    </div>
  );
}
