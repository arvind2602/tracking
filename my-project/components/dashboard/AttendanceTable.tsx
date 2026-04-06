'use client';

import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { format, differenceInSeconds, subDays, isAfter, startOfDay } from 'date-fns';
import { useEffect, useState } from 'react';
import { 
  Clock, 
  User, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  AlertCircle,
  TrendingUp,
  Wifi,
  Globe,
  Smartphone,
  MapPin
} from 'lucide-react';
import { cn } from "@/lib/utils";

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  workHours: number | null;
  withinGeofence: boolean;
  deviceMismatch: boolean;
  deviceName?: string;
  ipAddress?: string;
  location?: string;
}

interface AttendanceFilters {
  statusFilter: string;
  userFilter: string;
  dateRangeFilter: string;
  flagsFilter: string;
}

// Function to fetch attendance records
async function getOrganizationAttendance() {
  const res = await axios.get('/attendance/organization');
  return res.data;
}

// Sub-component to handle the running timer for work hours
export function LiveWorkHours({ checkIn, checkOut, initialWorkHours }: { 
  checkIn: string; 
  checkOut: string | null; 
  initialWorkHours: number | null 
}) {
  const [seconds, setSeconds] = useState<number>(0);

  useEffect(() => {
    if (checkOut) {
      setSeconds(initialWorkHours ? initialWorkHours * 3600 : 0);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const start = new Date(checkIn);
      const diff = Math.max(0, differenceInSeconds(now, start));
      setSeconds(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [checkIn, checkOut, initialWorkHours]);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return (
    <span className={cn(
      "font-mono font-medium tabular-nums",
      !checkOut ? "text-emerald-500 animate-pulse" : "text-muted-foreground"
    )}>
      {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
    </span>
  );
}

export function AttendanceFeedTable({ 
  data,
  isLoading
}: { 
  data?: AttendanceRecord[];
  isLoading?: boolean;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  const filteredData = data;

  // Group by date
  const groupedData = filteredData?.reduce((acc, record) => {
    const dateStr = format(new Date(record.date), 'yyyy-MM-dd');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(record);
    return acc;
  }, {} as Record<string, AttendanceRecord[]>) || {};

  // Sort dates descending
  const sortedDates = Object.keys(groupedData).sort((a, b) => b.localeCompare(a));

  // Sort records within each date by work hours descending
  Object.keys(groupedData).forEach(date => {
    groupedData[date].sort((a, b) => {
      const getHours = (r: AttendanceRecord) => {
        if (r.checkOut) return r.workHours || 0;
        return (new Date().getTime() - new Date(r.checkIn).getTime()) / (1000 * 3600);
      };
      return getHours(b) - getHours(a);
    });
  });

  return (
    <div className="space-y-8">
      {sortedDates.map((dateStr) => (
        <div key={dateStr} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-transparent rounded-full" />
            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {format(new Date(dateStr), 'EEEE, MMMM do, yyyy')}
            </h4>
          </div>

          <div className="overflow-hidden border border-border rounded-2xl bg-card shadow-sm">
            <table className="w-full text-left text-xs md:text-sm border-collapse">
              <thead className="bg-secondary text-foreground italic px-6 py-4 uppercase tracking-wider text-[10px] font-bold">
                <tr className="border-b border-border">
                  <th className="px-6 py-4 text-muted-foreground">Employee</th>
                  <th className="px-6 py-4 text-center text-muted-foreground">Check-In</th>
                  <th className="px-6 py-4 text-center text-muted-foreground">Check-Out</th>
                  <th className="px-6 py-4 text-center text-muted-foreground">Work Hours</th>
                  <th className="px-6 py-4 text-center text-muted-foreground">Signal</th>
                  <th className="px-6 py-4 text-center text-muted-foreground">Device</th>
                  <th className="px-6 py-4 text-right text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {groupedData[dateStr].map((record) => (
                  <tr key={record.id} className="hover:bg-muted/50 transition-colors group bg-background">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground group-hover:text-blue-400 transition-colors">
                            {record.firstName} {record.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{record.position}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-emerald-400">
                        <ArrowUpRight className="w-4 h-4" />
                        <span className="font-medium">{format(new Date(record.checkIn), 'HH:mm:ss')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {record.checkOut ? (
                        <div className="flex items-center justify-center gap-2 text-rose-400">
                          <ArrowDownRight className="w-4 h-4" />
                          <span className="font-medium">{format(new Date(record.checkOut), 'HH:mm:ss')}</span>
                        </div>
                      ) : (
                        <span className={cn(
                          "text-sm font-medium",
                          dateStr !== today ? "text-amber-500 font-bold" : "text-muted-foreground italic animate-pulse"
                        )}>
                          {dateStr !== today ? 'NA' : 'Active...'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Clock className={cn("w-4 h-4", !record.checkOut ? (dateStr !== today ? "text-amber-500" : "text-emerald-500") : "text-muted-foreground")} />
                        {dateStr !== today && !record.checkOut ? (
                          <span className="text-sm font-bold text-amber-500">NA</span>
                        ) : (
                          <LiveWorkHours 
                            checkIn={record.checkIn} 
                            checkOut={record.checkOut} 
                            initialWorkHours={record.workHours} 
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {record.withinGeofence ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg border border-emerald-500/20">
                            <Wifi className="w-3 h-3" />
                            <span className="text-[10px] font-bold">OFFICE</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-500/10 text-rose-600 rounded-lg border border-rose-500/20">
                            <Globe className="w-3 h-3" />
                            <span className="text-[10px] font-bold">REMOTE</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Smartphone className="w-3 h-3" />
                          <span className="max-w-[120px] truncate" title={record.deviceName}>{record.deviceName || 'Unknown'}</span>
                        </div>
                        {record.ipAddress && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                            <Activity className="w-2.5 h-2.5" />
                            <span>{record.ipAddress}</span>
                          </div>
                        )}
                        {record.location && (
                          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/50 italic px-2 py-0.5 bg-muted/30 rounded">
                            <MapPin className="w-2.5 h-2.5" />
                            <span className="max-w-[100px] truncate" title={record.location}>{record.location}</span>
                          </div>
                        )}
                        {record.deviceMismatch && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-500/10 text-rose-600 rounded-md border border-rose-500/20 text-[8px] font-black uppercase mt-0.5">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Mismatch
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                        record.status === 'PRESENT' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                        record.status === 'LATE' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                        "bg-red-500/10 text-red-600 dark:text-red-400"
                      )}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      
      {sortedDates.length === 0 && (
        <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
          <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
          <p className="text-muted-foreground font-medium">No attendance records found</p>
        </div>
      )}
    </div>
  );
}
