// Rundes Profilbild mit Initialen als Ersatz (kein Bild hochgeladen oder noch nicht geladen).
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { avatarUrl } from "@/lib/avatar"
import { initials } from "@/lib/calc/format"

export function Avatar({
  name, avatar, className,
}: {
  name: string
  avatar?: { id: string; version: number }
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const id = avatar?.id
  const version = avatar?.version
  useEffect(() => {
    setUrl(null)
    if (!id || !version) return
    let cancelled = false
    avatarUrl(id, version).then((u) => { if (!cancelled) setUrl(u) }).catch(() => { /* Initialen bleiben */ })
    return () => { cancelled = true }
  }, [id, version])

  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-bold", className)}>
      {url ? <img src={url} alt="" loading="lazy" className="size-full object-cover" /> : initials(name)}
    </div>
  )
}
