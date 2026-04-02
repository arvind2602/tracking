'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { format } from 'date-fns';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Filter,
  User,
  MoreVertical,
  Check,
  X as XIcon,
  Search,
  LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ApplyLeaveModal } from './ApplyLeaveModal';

interface LeaveHistoryProps {
  isAdmin: boolean;
}

export function LeaveHistory({ isAdmin }: LeaveHistoryProps) {
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const queryClient = useQueryClient();

  const { data: leaves, isLoading } = useQuery({
    queryKey: [isAdmin ? 'orgLeaves' : 'myLeaves'],
    queryFn: async () => {
      const endpoint = isAdmin ? '/attendance/leave/org' : '/attendance/leave/my';
      const res = await axios.get(endpoint);
      return res.data;
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: string, status: string, adminNote?: string }) => {
      const res = await axios.patch(`/attendance/leave/${id}/status`, { 
        status, 
        adminNote,
        updatedAt: new Date().toISOString()
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [isAdmin ? 'orgLeaves' : 'myLeaves'] });
    }
  });

  const handleUpdateStatus = (id: string, status: 'APPROVED' | 'REJECTED') => {
    if (status === 'REJECTED') {
      const note = prompt('Please enter a reason for rejection (optional):');
      updateStatusMutation.mutate({ id, status, adminNote: note || '' });
    } else {
      if (confirm('Are you sure you want to approve this leave request?')) {
        updateStatusMutation.mutate({ id, status });
      }
    }
  };

  const filteredLeaves = leaves?.filter((leave: any) => {
    const matchesFilter = activeFilter === 'ALL' || leave.status === activeFilter;
    const matchesSearch = isAdmin
      ? `${leave.firstName} ${leave.lastName} ${leave.reason}`.toLowerCase().includes(searchTerm.toLowerCase())
      : leave.reason.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex bg-muted p-1 rounded-xl border border-border w-full md:w-auto">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f as any)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-1 md:flex-none uppercase tracking-wider",
                activeFilter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search requests..."
              className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsApplyModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity whitespace-nowrap shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Apply Leave
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
              <div className="flex justify-between">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))
        ) : filteredLeaves?.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground italic bg-card/50 border border-dashed border-border rounded-3xl">
             <LayoutGrid className="w-12 h-12 mb-4 opacity-10" />
             No leave requests found
          </div>
        ) : (
          filteredLeaves?.map((leave: any) => (
            <div key={leave.id} className="group relative bg-card border border-border hover:border-primary/50 rounded-3xl p-6 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1">
              <div className="flex justify-between items-start mb-4">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                  leave.status === 'PENDING' && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
                  leave.status === 'APPROVED' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                  leave.status === 'REJECTED' && "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                )}>
                  {leave.status}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-1 rounded-lg">
                  {leave.type}
                </span>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <User className="w-5 h-5 font-black" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground leading-tight">
                      {leave.firstName} {leave.lastName}
                    </h4>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                      {leave.position}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground bg-muted/30 p-2 rounded-xl">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd, yyyy')}</span>
                </div>
                <div className="p-3 bg-muted/10 rounded-2xl border border-border/50">
                   <p className="text-sm text-foreground/90 font-medium leading-relaxed italic">
                    "{leave.reason}"
                  </p>
                </div>
              </div>

              {leave.adminNote && (
                <div className="mt-4 p-3 bg-red-500/5 border border-red-500/10 rounded-2xl">
                   <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest mb-1 items-center flex gap-1">
                      <XCircle className="w-3 h-3" />
                      Admin Response
                   </p>
                   <p className="text-xs text-red-600/80 font-medium">
                      {leave.adminNote}
                   </p>
                </div>
              )}

              {isAdmin && leave.status === 'PENDING' && (
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleUpdateStatus(leave.id, 'APPROVED')}
                    className="flex items-center justify-center gap-2 py-2 bg-emerald-500 text-white rounded-xl text-[11px] font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/10"
                  >
                    <Check className="w-3 h-3" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(leave.id, 'REJECTED')}
                    className="flex items-center justify-center gap-2 py-2 bg-card border border-red-500/30 text-red-500 rounded-xl text-[11px] font-bold hover:bg-red-50 transition-colors"
                  >
                    <XIcon className="w-3 h-3" />
                    Reject
                  </button>
                </div>
              )}
              
              <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 pt-3 font-bold uppercase tracking-tighter">
                <div className="flex items-center gap-1">
                   <Clock className="w-3 h-3" />
                   Applied {format(new Date(leave.createdAt), 'MMM dd')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <ApplyLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
      />
    </div>
  );
}
