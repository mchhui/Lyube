export const AXIS_LOCK = 10;

export function lockAxis(dx: number, dy: number): "x" | "y" | null {
  if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return null;
  return Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
}
