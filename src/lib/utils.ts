import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  return `${hours > 0 ? `${hours}h ` : ""}${minutes}m ${seconds}s`;
}

export function formatTrailDistance(distance?: number): string {
  if (distance === undefined) return "N/A";
  if (distance < 1000) return `${distance.toFixed(0)} m`;
  return `${(distance / 1000).toFixed(2)} km`;
}
