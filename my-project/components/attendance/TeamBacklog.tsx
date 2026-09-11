'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Search, RefreshCw, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatHoursDual, decimalHoursToClock } from '@/lib/utils';
import { format } from 'date-fns';

type EmpBacklog = {
    id: string;
    name: string;
    email: string;
    required: number;
    worked: number;
    remaining: number;
    flags: string;
    days: { date: string; label: string; required: number; worked: number; isLeave?: boolean; isHoliday?: boolean; missingCheckout?: boolean }[];
};

type Preview = {
    org: { name: string };
    week: { weekStart: string; weekEnd: string; isOffWeek: boolean };
    today: string;
    employees: EmpBacklog[];
    defaulters: EmpBacklog[];
    totalEmployees: number;
};

const fmt = (n: number) => formatHoursDual(n);

export function TeamBacklog() {
    const [search, setSearch] = useState('');
    const [defaultersOnly, setDefaultersOnly] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);

    const { data, isLoading, isError, refetch, isFetching } = useQuery<Preview>({
        queryKey: ['backlog', 'preview'],
        queryFn: async () => {
            const res = await axios.get('/backlog/preview', { params: { mode: 'morning' } });
            return res.data;
        },
    });

    const rows = useMemo(() => {
        if (!data) return [];
        let list = defaultersOnly ? data.defaulters : data.employees;
        const q = search.trim().toLowerCase();
        if (q) list = list.filter((e) => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q));
        return [...list].sort((a, b) => b.remaining - a.remaining);
    }, [data, defaultersOnly, search]);

    if (isLoading) {
        return (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-3 shadow-sm">
                <Skeleton className="h-5 w-56" />
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between shadow-sm">
                <p className="text-sm text-muted-foreground">Could not load team backlog.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
                <div>
                    <h3 className="text-base font-bold text-foreground">Team backlog — Mon {data.week.weekStart} → {data.week.isOffWeek ? `Fri ${data.week.weekEnd} (Sat off)` : `Sat ${data.week.weekEnd}`}</h3>
                    <p className="text-xs text-muted-foreground font-medium">
                        {data.defaulters.length} of {data.totalEmployees} have backlog · Mon till yesterday · 9h/day
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-muted p-1 rounded-xl border border-border">
                        <button
                            onClick={() => setDefaultersOnly(true)}
                            className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all', defaultersOnly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                        >
                            Defaulters ({data.defaulters.length})
                        </button>
                        <button
                            onClick={() => setDefaultersOnly(false)}
                            className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all', !defaultersOnly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                        >
                            Everyone ({data.totalEmployees})
                        </button>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
                        <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
                    </Button>
                </div>
            </div>

            <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs md:text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-border bg-muted/40">
                                <th className="px-6 py-3 text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Employee</th>
                                <th className="px-6 py-3 text-right text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Required</th>
                                <th className="px-6 py-3 text-right text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Worked</th>
                                <th className="px-6 py-3 text-right text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Backlog</th>
                                <th className="px-6 py-3 text-right text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                                    {defaultersOnly ? 'All clear — no backlog defaulters this week.' : 'No employees found.'}
                                </td></tr>
                            ) : rows.map((e) => (
                                <React.Fragment key={e.id}>
                                    <tr
                                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                                        onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                                    >
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', expanded === e.id && 'rotate-180')} />
                                                <div>
                                                    <p className="font-bold text-foreground">{e.name}</p>
                                                    <p className="text-[11px] text-muted-foreground">{e.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right font-medium">{fmt(e.required)}</td>
                                        <td className="px-6 py-3 text-right font-medium">{fmt(e.worked)}</td>
                                        <td className={cn('px-6 py-3 text-right font-bold', e.remaining > 0.25 ? 'text-red-500' : 'text-emerald-500')}>{fmt(e.remaining)}</td>
                                        <td className="px-6 py-3 text-right text-[11px] text-muted-foreground">{e.flags || '—'}</td>
                                    </tr>
                                    {expanded === e.id && (
                                        <tr className="bg-muted/20">
                                            <td colSpan={5} className="px-6 py-3">
                                                <div className="flex flex-wrap gap-2">
                                                    {e.days.filter((d) => d.date < (data?.today ?? '')).map((d) => (
                                                        <span key={d.date} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-[11px] font-medium">
                                                            {format(new Date(d.date + 'T12:00:00'), 'EEE dd')}: {decimalHoursToClock(d.required)} req / {decimalHoursToClock(d.worked)}
                                                            {d.isLeave ? ' · leave' : d.isHoliday ? ' · holiday' : d.missingCheckout ? ' · no checkout' : ''}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
