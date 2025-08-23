import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionProps = {
  className?: string;
  title?: ReactNode;
  children: ReactNode;
};

export function Section({ className, title, children }: SectionProps) {
  return (
    <section className={cn("section", className)}>
      {title && <h3 className="sectionHeader">{title}</h3>}
      {children}
    </section>
  );
}


