import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Hand-written to unblock development now. Once you run
// `npx shadcn@latest init` (see the `shadcn` skill), regenerate this file
// with `npx shadcn@latest add button` so it matches the CLI's own version
// and stays upgradeable — don't hand-maintain both.
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-opacity disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
  {
    variants: {
      variant: {
        default: "bg-accent text-paper hover:opacity-90",
        outline: "border border-border hover:border-accent hover:text-accent",
        ghost: "hover:bg-accent-soft",
      },
      size: {
        default: "h-11 px-6",
        sm: "h-9 px-4 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
