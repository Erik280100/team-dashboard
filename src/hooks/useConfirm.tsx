// Bestätigungs- und Hinweisdialog
// (Promise-basiert: await confirm("Text …") -> boolean). Fokus-Trap, Escape-to-cancel
// und Klick-außerhalb-schließt-Verhalten übernimmt Radix' AlertDialog von selbst.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/** `info: true` zeigt nur einen Hinweis mit OK (ersetzt alert()); das Ergebnis ist dann immer true. */
type ConfirmFn = (message: string, options?: { info?: boolean }) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const [info, setInfo] = useState(false)
  const resolveRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((msg, options) => {
    setMessage(msg)
    setInfo(options?.info === true)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  function settle(result: boolean) {
    setMessage(null)
    resolveRef.current?.(result)
    resolveRef.current = null
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={message !== null} onOpenChange={(open) => { if (!open) settle(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{info ? "Hinweis" : "Bestätigung erforderlich"}</AlertDialogTitle>
            <AlertDialogDescription>{message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {!info && <AlertDialogCancel onClick={() => settle(false)}>Abbrechen</AlertDialogCancel>}
            <AlertDialogAction onClick={() => settle(true)}>{info ? "OK" : "Bestätigen"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

/** await confirm("Text …") -> true/false; confirm("Text", { info: true }) zeigt nur einen Hinweis. */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm muss innerhalb von <ConfirmProvider> verwendet werden.")
  return ctx
}
