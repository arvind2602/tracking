import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import localizedFormat from "dayjs/plugin/localizedFormat"

// Extend dayjs with plugins
dayjs.extend(utc)
dayjs.extend(localizedFormat)

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Parse date as UTC and get dayjs object
export function parseAsUTC(date: string | Date | undefined | null) {
  if (!date) return null;
  // dayjs.utc() parses the date as UTC, then .local() converts to local timezone
  return dayjs.utc(date).local();
}

// Formats date/time in user's local timezone
export function formatDateTimeLocal(date: string | Date | undefined | null) {
  const d = parseAsUTC(date);
  if (!d) return '-';
  return d.format('DD MMM YYYY, hh:mm A');
}

// Formats date in user's local timezone
export function formatDateLocal(date: string | Date | undefined | null) {
  const d = parseAsUTC(date);
  if (!d) return '-';
  return d.format('DD/MM/YY');
}

// Formats time only in user's local timezone
export function formatTimeLocal(date: string | Date | undefined | null) {
  const d = parseAsUTC(date);
  if (!d) return '-';
  return d.format('hh:mm A');
}

// Legacy aliases for backward compatibility
export const formatDateTimeIST = formatDateTimeLocal;
export const formatDateIST = formatDateLocal;
