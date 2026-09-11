import * as React from "react";
import { cn } from "@/lib/utils";

// Same note as button.tsx: placeholder until `npx shadcn@latest add card`
// generates the real one.
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-paper/60 p-5 shadow-sm", className)}
      {...props}
    />
  );
}
