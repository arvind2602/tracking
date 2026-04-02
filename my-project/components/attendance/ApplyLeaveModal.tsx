'use client';

import React, { useState } from 'react';
import axios from '@/lib/axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Calendar, Type, FileText } from 'lucide-react';

interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApplyLeaveModal({ isOpen, onClose }: ApplyLeaveModalProps) {
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    type: 'CASUAL',
    reason: ''
  });

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await axios.post('/attendance/leave/apply', {
        ...data,
        createdAt: new Date().toISOString()
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLeaves'] });
      onClose();
    }
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-card w-full max-w-md border border-border rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
          <h3 className="text-xl font-bold text-foreground">Apply for Leave</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                From Date
              </label>
              <input
                type="date"
                required
                className="w-full px-4 py-2 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                To Date
              </label>
              <input
                type="date"
                required
                className="w-full px-4 py-2 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
              <Type className="w-3 h-3" />
              Leave Type
            </label>
            <select
              className="w-full px-4 py-2 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="CASUAL">Casual Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="EARNED">Earned Leave</option>
              <option value="WFH">WFH (Request)</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
              <FileText className="w-3 h-3" />
              Reason for Leave
            </label>
            <textarea
              required
              rows={4}
              placeholder="Explain why you need leave..."
              className="w-full px-4 py-2 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-medium"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {mutation.isPending ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  );
}
