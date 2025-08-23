import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ChipVariant = 'success' | 'primary' | 'secondary' | 'accent' | 'warning' | 'muted';

type ChipProps = {
  className?: string;
  children: ReactNode;
  variant?: ChipVariant;
};

export function Chip({ className, children, variant = 'muted' }: ChipProps) {
  return (
    <span className={cn("chip", variant && `chip--${variant}`, className)}>
      {children}
    </span>
  );
}


