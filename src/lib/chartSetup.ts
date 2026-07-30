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

export const DARK_GRID = "rgba(255,255,255,.08)"
export const DARK_TICK = { color: "#9FB3AF", font: { size: 10 } }
export const DARK_LEGEND = { labels: { color: "#DCEAE6", boxWidth: 12, font: { size: 11 } }, position: "top" as const }

// Original: linear-gradient(160deg, #16323F 0%, #0B1F2A 100%) — durchgängig für
// alle dunklen Kacheln (Übersicht, Statistik), nicht nur Chart-Panels.
export const DARK_CARD = "border-white/10 bg-[linear-gradient(160deg,#16323F_0%,#0B1F2A_100%)] text-white"
export const DARK_INPUT = "border-white/20 bg-white/10 text-white placeholder:text-white/40 [color-scheme:dark]"
