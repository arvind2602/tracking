'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Timer, Target, TrendingDown, Briefcase, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type BacklogDay = {
    date: string;
    label: string;
    required: number;
    worked: number;
    isLeave?: boolean;
    isHoliday?: boolean;
    missingCheckout?: boolean;
};

type MyBacklog = {
    org: string;
    week: { weekStart: string; weekEnd: string; reminderDay: string; isOffWeek: boolean };
    today: string;
    backlog: {
        name: string;
        requiredSoFar: number;
        workedSoFar: number;
        backlogSoFar: number;
        todayRequired: number;
        todayTarget: number;
        days: BacklogDay[];
    };
};

const fmt = (n: number) => `${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2)}h`;

function prettyDayLabel(dateStr: string, label: string) {
    try {
        return format(new Date(dateStr + 'T12:00:00'), 'EEE, MMM dd');
    } catch {
        return label;
    }
}

export function PersonalBacklog() {
    const { data, isLoading, isError, refetch, isFetching } = useQuery<MyBacklog>({
        queryKey: ['backlog', 'my'],
        queryFn: async () => {
            const res = await axios.get('/backlog/my', { params: { mode: 'morning' } });
            return res.data;
        },
    });

    if (isLoading) {
        return (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
                <Skeleton className="h-5 w-48" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
                </div>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between shadow-sm">
                <p className="text-sm text-muted-foreground">Could not load this week's backlog.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
            </div>
        );
    }

    const { backlog, week, today } = data;
    // Monday → yesterday (exclude today, which is still in progress)
    const pastDays = backlog.days.filter((d) => d.date < today);
    const isMonday = pastDays.length === 0;

    const tiles = [
        { title: 'Required so far', value: fmt(backlog.requiredSoFar), icon: <Briefcase className="h-5 w-5 text-blue-500" />, className: 'bg-blue-500/5 border-blue-500/20' },
        { title: 'Worked so far', value: fmt(backlog.workedSoFar), icon: <Timer className="h-5 w-5 text-emerald-500" />, className: 'bg-emerald-500/5 border-emerald-500/20' },
        { title: 'Backlog', value: fmt(backlog.backlogSoFar), icon: <TrendingDown className="h-5 w-5 text-amber-500" />, className: 'bg-amber-500/5 border-amber-500/20' },
        { title: 'Target for today', value: fmt(backlog.todayTarget), icon: <Target className="h-5 w-5 text-purple-500" />, className: 'bg-purple-500/5 border-purple-500/20' },
    ];

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 px-6 pt-5 pb-4">
                <div>
                    <h3 className="text-base font-bold text-foreground">This week's backlog</h3>
                    <p className="text-xs text-muted-foreground font-medium">
                        Mon {week.weekStart} → {week.isOffWeek ? `Fri ${week.weekEnd} (Sat off)` : `Sat ${week.weekEnd}`} · Mon till yesterday · 9h/day
                    </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="self-start md:self-auto">
                    <RefreshCw className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')} />Refresh
                </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 pb-4">
                {tiles.map((t) => (
                    <div key={t.title} className={cn('rounded-xl border p-4', t.className)}>
                        <div className="flex items-center gap-2">{t.icon}<p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t.title}</p></div>
                        <p className="text-xl font-bold text-foreground mt-1">{t.value}</p>
                    </div>
                ))}
            </div>

            <div className="overflow-x-auto border-t border-border">
                {isMonday ? (
                    <p className="px-6 py-6 text-sm text-muted-foreground italic">Week just started — no backlog days yet. Hit your 9h today to stay clear.</p>
                ) : (
                    <table className="w-full text-left text-xs md:text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-border bg-muted/40">
                                <th className="px-6 py-3 text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Day</th>
                                <th className="px-6 py-3 text-right text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Required</th>
                                <th className="px-6 py-3 text-right text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Worked</th>
                                <th className="px-6 py-3 text-right text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Note</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {pastDays.map((d) => (
                                <tr key={d.date} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-6 py-3 font-bold text-foreground">{prettyDayLabel(d.date, d.label)}</td>
                                    <td className="px-6 py-3 text-right font-medium">{fmt(d.required)}</td>
                                    <td className="px-6 py-3 text-right font-medium">{fmt(d.worked)}</td>
                                    <td className="px-6 py-3 text-right text-[11px] text-muted-foreground">
                                        {d.isLeave ? 'Leave' : d.isHoliday ? 'Holiday' : d.missingCheckout ? 'Missing checkout' : d.required > 0 && d.worked === 0 ? 'No record' : d.label.startsWith('week-off') || d.label.startsWith('before-joining') ? '—' : d.label}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
