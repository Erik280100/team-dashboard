// Zentrale Chart.js-Registrierung, einmal importiert von jeder Section, die
// Charts braucht (react-chartjs-2 verlangt explizite Element-Registrierung).
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js"

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler
)

export const CHART_GRID = "#e2e8f0"
export const CHART_TICK = { color: "#64748b", font: { size: 10 } }
export const CHART_LEGEND = { labels: { color: "#1e293b", boxWidth: 12, font: { size: 11 } }, position: "top" as const }

// Weiße Karte mit zartem Mint-Rand — durchgängig für alle Kacheln (Übersicht, Statistik), nicht nur Chart-Panels.
export const SURFACE_CARD = "border-finova-border bg-card text-foreground"
