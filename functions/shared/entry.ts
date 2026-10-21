// Einstiegspunkt für das Bündeln des Browser-Rechencodes in die Cloud Functions (siehe ../build-shared.mjs).
// Liegt bewusst außerhalb von functions/src, damit tsc ihn nicht mitkompiliert.
export {
  buildIndexEntry, buildSnapshot, monthKeyOf, nextMonthGoal, resetRowsForNewMonth,
} from "../../src/lib/calc/archive"
export { employeeDocToRow, rowToEmployeeData } from "../../src/lib/calc/employees"
export { insuranceReconcile } from "../../src/lib/calc/planStufen"
