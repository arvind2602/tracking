import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from 'date-fns-tz';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TIMEZONE_IST = 'Asia/Kolkata';

/** Default fallback value for all date formatters when input is null/invalid. */
const DEFAULT_FALLBACK = '-';

/**
 * Core date format helper. All public formatters delegate to this.
 * Eliminates duplicated try/catch + null-check logic across 6 functions.
 * @param date - Raw date input (string, Date, null, undefined)
 * @param format - date-fns format string
 * @param fallback - String returned when input is null/invalid (default: '-')
 */
function formatDateBase(
  date: string | Date | undefined | null,
  format: string,
  fallback: string = DEFAULT_FALLBACK
): string {
  if (!date) return fallback;
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return fallback;
    return formatInTimeZone(d, TIMEZONE_IST, format);
  } catch {
    return fallback;
  }
}

/** Full date + time: "16 Feb 2026, 04:31 PM" */
export function formatDateTimeIST(date: string | Date | undefined | null) {
  return formatDateBase(date, 'dd MMM yyyy, hh:mm a');
}

/** Compact date + time: "16/02/26, 04:31 PM" */
export function formatDateIST(date: string | Date | undefined | null) {
  return formatDateBase(date, 'dd/MM/yy, hh:mm a');
}

/** Date only: "16/02/2026" */
export function formatDateOnlyIST(date: string | Date | undefined | null) {
  return formatDateBase(date, 'dd/MM/yyyy');
}

/** Time only: "04:31 PM" */
export function formatTimeIST(date: string | Date | undefined | null) {
  return formatDateBase(date, 'hh:mm a');
}

/** Long date: "Sunday, 16 February 2026" */
export function formatDateLongIST(date: string | Date | undefined | null) {
  return formatDateBase(date, 'EEEE, dd MMMM yyyy');
}

/** Full long date + time: "Sunday, 16 February 2026, 04:31 PM" */
export function formatFullDateTimeIST(date: string | Date | undefined | null) {
  return formatDateBase(date, 'EEEE, dd MMMM yyyy, hh:mm a');
}