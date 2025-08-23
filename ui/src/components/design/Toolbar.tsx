import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToolbarProps = {
  className?: string;
  children: ReactNode;
};

export function Toolbar({ className, children }: ToolbarProps) {
  return (
    <div className={cn("toolbar", className)}>
      {children}
    </div>
  );
}


