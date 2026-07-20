import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d8ce8]/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#04a16b] text-white hover:bg-[#03875a] dark:bg-[#06ba7c] dark:text-white dark:hover:bg-[#049a68]",
        outline:
          "border border-[#9ec0ec] bg-white text-[#1f3b5f] hover:bg-[#eef5ff] dark:border-[#5987c2] dark:bg-[#12273f] dark:text-[#cde2ff] dark:hover:bg-[#1a3557]",
        ghost:
          "text-[#1f3b5f] hover:bg-[#eef5ff] dark:text-[#cde2ff] dark:hover:bg-[#1a3557]",
        secondary:
          "bg-[#edf5ff] text-[#2f63a7] hover:bg-[#dfeeff] dark:bg-[#1b3555] dark:text-[#cde2ff] dark:hover:bg-[#24456f]",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:text-white dark:hover:bg-red-400",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
