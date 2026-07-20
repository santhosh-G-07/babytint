import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#4d8ce8] text-white dark:bg-[#5ea0ff] dark:text-white",
        secondary:
          "border-transparent bg-[#edf5ff] text-[#2f63a7] dark:bg-[#1a3557] dark:text-[#cde2ff]",
        outline:
          "border-[#9ec0ec] text-[#2f63a7] dark:border-[#5987c2] dark:text-[#cde2ff]",
        success: "border-transparent bg-emerald-100 text-emerald-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
