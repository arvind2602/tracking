'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Plus,
    Trash2,
    Loader2,
    Gift,
    Save
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type Holiday = {
    id: string;
    date: string;
    name: string;
    reason?: string;
};

export function HolidayManager() {
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [form, setForm] = useState({
        name: '',
        reason: '',
        date: format(new Date(), 'yyyy-MM-dd')
    });

    const { data: holidays = [], isLoading } = useQuery<Holiday[]>({
        queryKey: ['organizationHolidays'],
        queryFn: async () => {
            const res = await axios.get('/organization/holidays');
            return res.data;
        }
    });

    const addMutation = useMutation({
        mutationFn: (payload: { name: string; reason: string; date: string }) =>
            axios.post('/organization/holidays', payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizationHolidays'] });
            queryClient.invalidateQueries({ queryKey: ['organizationSettings'] });
            setIsAdding(false);
            setForm({ name: '', reason: '', date: format(new Date(), 'yyyy-MM-dd') });
            toast.success('Holiday marked');
        },
        onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to add holiday')
    });

    const deleteMutation = useMutation({
        mutationFn: (key: string) => axios.delete(`/organization/holidays/${key}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizationHolidays'] });
            queryClient.invalidateQueries({ queryKey: ['organizationSettings'] });
            toast.success('Holiday removed');
        },
        onError: () => toast.error('Failed to remove holiday')
    });

    const handleAdd = () => {
        if (!form.name.trim() || !form.date) {
            toast.error('Name and date are required');
            return;
        }
        addMutation.mutate({ name: form.name.trim(), reason: form.reason.trim(), date: form.date });
    };

    if (isLoading) return <div className="p-4"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Gift className="w-5 h-5 text-pink-500" />
                    Public Holidays
                </h3>
                {!isAdding && (
                    <Button onClick={() => setIsAdding(true)} variant="outline" className="rounded-xl flex gap-2 border-pink-500/20 text-pink-500 hover:bg-pink-500/10">
                        <Plus className="w-4 h-4" />
                        Mark Holiday
                    </Button>
                )}
            </div>

            {isAdding && (
                <div className="p-6 bg-card border border-pink-500/20 rounded-3xl space-y-4 animate-in zoom-in-95 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Holiday Name *</label>
                            <Input
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Diwali"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Date *</label>
                            <Input
                                type="date"
                                value={form.date}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Reason</label>
                        <Input
                            value={form.reason}
                            onChange={e => setForm({ ...form, reason: e.target.value })}
                            placeholder="e.g. Festival holiday — office closed"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                        <Button
                            onClick={handleAdd}
                            disabled={addMutation.isPending}
                            className="bg-pink-500 hover:bg-pink-600 text-white"
                        >
                            {addMutation.isPending ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Mark Holiday
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {holidays.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic col-span-full">No holidays configured yet.</p>
                ) : (
                    holidays.map((h) => (
                        <div key={h.id} className="p-4 bg-card border border-border rounded-2xl flex justify-between items-center group hover:border-pink-500/30 transition-all">
                            <div>
                                <p className="font-bold text-foreground">{h.name}</p>
                                <p className="text-xs text-muted-foreground font-medium">{format(new Date(h.date + 'T12:00:00'), 'MMMM dd, yyyy')}</p>
                                {h.reason && <p className="text-xs text-muted-foreground mt-1">{h.reason}</p>}
                            </div>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => deleteMutation.mutate(h.id)}
                                disabled={deleteMutation.isPending}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
