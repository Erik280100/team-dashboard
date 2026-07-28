import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

// Bewusst ein natives <select>, kein Radix-Select: für einfache Dropdowns
// (Filter/Sortierung) ausreichend und deutlich leichter als die volle
// Radix-Select-Komponente.
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative inline-block">
      <select
        data-slot="select"
        className={cn(
          "border-input bg-background flex h-9 w-full appearance-none items-center rounded-md border px-3 py-1 pr-8 text-sm shadow-xs outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 opacity-50" />
    </div>
  )
}

export { Select }
