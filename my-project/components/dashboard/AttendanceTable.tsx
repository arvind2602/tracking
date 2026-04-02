'use client';

import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { format, differenceInSeconds } from 'date-fns';
import { useEffect, useState } from 'react';
import { 
  Clock, 
  User, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { cn } from "@/lib/utils";

interface AttendanceRecord {
  id: string;
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
}

// Function to fetch attendance records
async function getOrganizationAttendance() {
  const res = await axios.get('/attendance/organization');
  return res.data;
}

// Sub-component to handle the running timer for work hours
function LiveWorkHours({ checkIn, checkOut, initialWorkHours }: { 
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

export function AttendanceFeedTable({ searchTerm = '' }: { searchTerm?: string }) {
  const { data, isLoading, error } = useQuery<AttendanceRecord[]>({
    queryKey: ['orgAttendance'],
    queryFn: getOrganizationAttendance,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
  if (error) return (
    <div className="p-8 text-center text-red-500">
      <AlertCircle className="w-12 h-12 mx-auto mb-4" />
      <p>Failed to load attendance feed</p>
    </div>
  );

  // Filter by search term
  const filteredData = data?.filter(record => 
    `${record.firstName || ''} ${record.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (record.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (record.status || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (record.position || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Check-In</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Check-Out</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Work Hours</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {groupedData[dateStr].map((record) => (
                  <tr key={record.id} className="hover:bg-white/5 transition-colors group">
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
                        <span className="text-muted-foreground text-sm italic">Active...</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Clock className={cn("w-4 h-4", !record.checkOut ? "text-emerald-500" : "text-muted-foreground")} />
                        <LiveWorkHours 
                          checkIn={record.checkIn} 
                          checkOut={record.checkOut} 
                          initialWorkHours={record.workHours} 
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter",
                        record.status === 'PRESENT' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                        record.status === 'LATE' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                        "bg-red-500/10 text-red-500 border border-red-500/20"
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
        <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
          <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
          <p className="text-muted-foreground font-medium">No attendance records found</p>
        </div>
      )}
    </div>
  );
}
