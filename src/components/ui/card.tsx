import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-4 rounded-xl border border-finova-border py-5",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1 px-5", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-sm font-bold uppercase leading-none tracking-wide", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-xs", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-5", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-5", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }

/** Icon im mint-getönten Quadrat, wie links neben den Kartentiteln der Finova-App. */
function CardIcon({ icon: Icon, className }: { icon: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg bg-finova-soft", className)}>
      <Icon className="size-4 text-finova-green" aria-hidden="true" />
    </span>
  )
}

/** Sektionskarte mit grünem Kopfbalken (z. B. "PERSÖNLICHE DATEN"), rechts optional Aktionen. */
function SectionCard({
  title, actions, children, className, bodyClassName,
}: {
  title: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-finova-border bg-card", className)}>
      <header className="flex items-center justify-between gap-3 bg-primary px-5 py-3 text-primary-foreground">
        <h3 className="text-sm font-extrabold uppercase tracking-wide">{title}</h3>
        {actions && <div className="flex items-center gap-2 text-xs font-semibold">{actions}</div>}
      </header>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  )
}

export { CardIcon, SectionCard }
