import { Button } from "@/components/ui/button"

function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background text-foreground">
      <p className="text-sm text-muted-foreground">
        React-Migrations-Gerüst steht. App-Shell folgt in Phase 2.
      </p>
      <Button>shadcn/ui Testkomponente</Button>
    </div>
  )
}

export default App
