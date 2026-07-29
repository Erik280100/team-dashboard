// Guide-Sektion — Äquivalent zu initGuide() aus legacy/index.html:5038–5061.
import { useState } from "react"
import { cn } from "@/lib/utils"
import { GUIDE_SECTIONS } from "@/lib/data/guide"
import { Card, CardContent } from "@/components/ui/card"

export function Guide() {
  const [active, setActive] = useState(0)
  const g = GUIDE_SECTIONS[active]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {GUIDE_SECTIONS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active === i
                ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {s.title}
          </button>
        ))}
      </div>

      <Card>
        <CardContent>
          {g.html ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: g.html }}
            />
          ) : (
            <>
              <h2 className="text-lg font-semibold">{g.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Inhalte folgen in Kürze.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
