import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from 'date-fns-tz';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TIMEZONE_IST = 'Asia/Kolkata';

export function formatDateTimeIST(date: string | Date | undefined | null) {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return formatInTimeZone(d, TIMEZONE_IST, 'dd MMM yyyy, hh:mm a');
  } catch {
    return '-';
  }
}

export function formatDateIST(date: string | Date | undefined | null) {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return formatInTimeZone(d, TIMEZONE_IST, 'dd/MM/yy, hh:mm a');
  } catch {
    return '-';
  }
}

export function formatDateOnlyIST(date: string | Date | undefined | null) {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return formatInTimeZone(d, TIMEZONE_IST, 'dd/MM/yyyy');
  } catch {
    return '';
  }
}

export function formatTimeIST(date: string | Date | undefined | null) {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return formatInTimeZone(d, TIMEZONE_IST, 'hh:mm a');
  } catch {
    return '';
  }
}

export function formatDateLongIST(date: string | Date | undefined | null) {
  if (!date) return 'Unassigned Date';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Unassigned Date';
    return formatInTimeZone(d, TIMEZONE_IST, 'EEEE, dd MMMM yyyy');
  } catch {
    return 'Unassigned Date';
  }
}