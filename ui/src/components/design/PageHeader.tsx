import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  className?: string;
  children: ReactNode;
};

export function PageHeader({ className, children }: PageHeaderProps) {
  return (
    <div className={cn("pageHeader", className)}>
      {children}
    </div>
  );
}


