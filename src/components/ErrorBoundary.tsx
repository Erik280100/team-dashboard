import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
  /** Wechselt dieser Wert (z. B. die geöffnete Sektion), wird der Fehlerzustand zurückgesetzt. */
  resetKey?: string
}

interface State { error: Error | null; resetKey?: string }

/** Nach einem Deploy kennt ein offener Tab die alten Chunk-Dateien nicht mehr; ein Neuladen holt die neuen. */
const isChunkLoadError = (err: Error) => /dynamically imported module|importing a module script|Loading chunk/i.test(err.message)
const RELOAD_FLAG = "chunk-reload"

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Anzeigefehler", error, info.componentStack)
    if (!isChunkLoadError(error)) return
    // Einmal automatisch neu laden; schlägt es erneut fehl, bleibt die Meldung mit Knopf stehen (keine Endlosschleife).
    try {
      if (sessionStorage.getItem(RELOAD_FLAG)) return
      sessionStorage.setItem(RELOAD_FLAG, "1")
    } catch { /* ohne sessionStorage keine automatische Wiederholung */ return }
    window.location.reload()
  }

  componentDidMount() {
    // Das Flag gilt nur kurz, damit eine spätere neue Version wieder automatisch geladen wird.
    window.setTimeout(() => { try { sessionStorage.removeItem(RELOAD_FLAG) } catch { /* egal */ } }, 10_000)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div role="alert" className="mx-auto max-w-md rounded-lg border bg-card p-6 text-center">
        <h2 className="text-lg font-semibold">Diese Seite konnte nicht geladen werden</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isChunkLoadError(error)
            ? "Es gibt eine neue Version der Anwendung. Bitte die Seite neu laden."
            : "Beim Anzeigen ist ein Fehler aufgetreten. Deine Daten sind nicht betroffen."}
        </p>
        <Button className="mt-4" onClick={() => window.location.reload()}>Seite neu laden</Button>
      </div>
    )
  }
}
