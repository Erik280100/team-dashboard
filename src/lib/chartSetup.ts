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
