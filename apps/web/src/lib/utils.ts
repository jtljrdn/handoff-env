import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// `?preview=1` arrives as number 1, string '1', 'true', or boolean true
// depending on the parser. Treat every truthy form the same.
export function isPreviewEnabled(preview: unknown): boolean {
  return preview === true || preview === 'true' || preview === 1 || preview === '1'
}
