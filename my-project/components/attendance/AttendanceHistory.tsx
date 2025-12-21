"use client";

import React, { useEffect, useState, useMemo } from "react";
import axios from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeLocal, formatTimeLocal, parseAsUTC } from "@/lib/utils";
import { Check, Copy, MapPin, User as UserIcon, Clock } from "lucide-react";
import toast from "react-hot-toast";

interface TimeLog {
    id: string;
    checkIn: string;
    checkOut: string | null;
    type: string;
    reason: string | null;
    createdAt: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    deviceId?: string;
    deviceType?: string;
}

export default function AttendanceHistory({ refreshTrigger, userRole }: { refreshTrigger: number, userRole: string | null }) {
    const [logs, setLogs] = useState<TimeLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedDate, setCopiedDate] = useState<string | null>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                // If userRole is passed, we might want to respect the parent logic or just fetch
                // The endpoint logic in backend handles Admin/User distinction via token/scope
                // But specifically for 'AttendancePage' which calls this, it uses /history without scope for Admin default
                // We'll trust the parent or default behavior.
                // However, the previous step modified Page to use ?scope=personal for status check.
                // The history table should probably show based on role (All for Admin).
                const response = await axios.get("/attendance/history");
                setLogs(response.data);
            } catch (error) {
                console.error("Failed to fetch logs", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [refreshTrigger]);

    const dateFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    }), []);

    const groupedLogs = useMemo(() => {
        const groups: Record<string, TimeLog[]> = {};
        if (!Array.isArray(logs)) return groups;

        logs.forEach((log) => {
            let dateKey = "Unknown Date";
            if (log.checkIn) {
                try {
                    const d = parseAsUTC(log.checkIn);
                    if (d && d.isValid()) {
                        dateKey = d.format('dddd, MMMM D, YYYY');
                    }
                } catch (e) { }
            }

            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(log);
        });

        return groups;
    }, [logs, dateFormatter]);

    const sortedDateKeys = useMemo(() => {
        return Object.keys(groupedLogs).sort((a, b) => {
            if (a === "Unknown Date") return 1;
            if (b === "Unknown Date") return -1;
            return new Date(b).getTime() - new Date(a).getTime(); // Newest first
        });
    }, [groupedLogs]);

    const copySummary = (dateKey: string) => {
        const logsForDate = groupedLogs[dateKey];
        // Generate a text summary
        let summary = `ATTENDANCE REPORT - ${dateKey}\n`;
        summary += `${'='.repeat(50)}\n`;
        logsForDate.forEach((log, i) => {
            const name = log.firstName ? `${log.firstName} ${log.lastName}` : "Me";
            const time = `${formatDateTimeLocal(log.checkIn)} - ${log.checkOut ? formatDateTimeLocal(log.checkOut) : 'Active'}`;
            summary += `${i + 1}. ${name} | ${log.type} | ${time}\n`;
        });

        navigator.clipboard.writeText(summary).then(() => {
            setCopiedDate(dateKey);
            toast.success('Summary copied!');
            setTimeout(() => setCopiedDate(null), 2000);
        });
    };

    const getBadgeColor = (type: string) => {
        switch (type) {
            case 'WORK': return 'default'; // dark/black usually
            case 'LUNCH': return 'secondary';
            case 'BREAK': return 'outline';
            case 'WASHROOM': return 'destructive';
            default: return 'secondary';
        }
    };

    const getDuration = (start: string, end: string | null) => {
        if (!end) return <span className="text-green-600 font-medium animate-pulse">Active</span>;
        const diff = new Date(end).getTime() - new Date(start).getTime();
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(mins / 60);
        const remainingMins = mins % 60;

        if (hours > 0) return `${hours}h ${remainingMins}m`;
        return `${mins}m`;
    };

    if (loading) return (
        <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    );

    return (
        <div className="bg-card/50 backdrop-blur-lg rounded-xl border border-accent/20 shadow-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-border">
                <p className="text-sm font-medium">Recorded Logs: {logs.length}</p>
            </div>

            <div className="overflow-x-auto bg-background">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-muted/40 sticky top-0 z-10">
                        <tr>
                            <th className="border border-border px-4 py-3 font-medium text-muted-foreground w-[50px] text-center">#</th>
                            {userRole === 'ADMIN' && (
                                <th className="border border-border px-4 py-3 font-medium text-muted-foreground">Employee</th>
                            )}
                            <th className="border border-border px-4 py-3 font-medium text-muted-foreground">Type</th>
                            <th className="border border-border px-4 py-3 font-medium text-muted-foreground">Time</th>
                            <th className="border border-border px-4 py-3 font-medium text-muted-foreground">Duration</th>
                            <th className="border border-border px-4 py-3 font-medium text-muted-foreground">Reason/Note</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedDateKeys.map((dateKey) => (
                            <React.Fragment key={dateKey}>
                                <tr className="bg-muted/30">
                                    <td colSpan={userRole === 'ADMIN' ? 6 : 5} className="px-4 py-2 border-y border-border">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                <Clock className="h-3 w-3" />
                                                {dateKey}
                                            </span>
                                            <button
                                                onClick={() => copySummary(dateKey)}
                                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors hover:bg-accent/10 p-1.5 rounded"
                                            >
                                                {copiedDate === dateKey ? (
                                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5" />
                                                )}
                                                Copy
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {groupedLogs[dateKey].map((log, index) => (
                                    <tr key={log.id} className="group hover:bg-accent/5 transition-colors border-b border-border last:border-0">
                                        <td className="px-4 py-3 text-center text-muted-foreground text-xs">
                                            {index + 1}
                                        </td>

                                        {userRole === 'ADMIN' && (
                                            <td className="px-4 py-3 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                                                        {log.firstName?.[0]}{log.lastName?.[0]}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-foreground text-sm">
                                                            {log.firstName} {log.lastName}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">{log.email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                        )}

                                        <td className="px-4 py-3 align-middle">
                                            <Badge variant={getBadgeColor(log.type) as any} className="capitalize shadow-none rounded-md px-2 py-0.5">
                                                {log.type.replace('_', ' ').toLowerCase()}
                                            </Badge>
                                        </td>

                                        <td className="px-4 py-3 align-middle">
                                            <div className="flex flex-col text-xs space-y-0.5">
                                                <div className="flex items-center gap-1.5 text-green-600/90 dark:text-green-500/90">
                                                    <span className="font-bold">IN:</span>
                                                    <span className="font-mono">{formatTimeLocal(log.checkIn)}</span>
                                                </div>
                                                {log.checkOut && (
                                                    <div className="flex items-center gap-1.5 text-red-600/80 dark:text-red-500/80">
                                                        <span className="font-bold">OUT:</span>
                                                        <span className="font-mono">{formatTimeLocal(log.checkOut)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 align-middle font-medium text-sm">
                                            {getDuration(log.checkIn, log.checkOut)}
                                        </td>

                                        <td className="px-4 py-3 align-middle text-muted-foreground text-sm">
                                            {log.reason ? (
                                                <span className="italic">{log.reason}</span>
                                            ) : (
                                                <span className="opacity-30">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {logs.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                    <p>No attendance logs found.</p>
                </div>
            )}
        </div>
    );
}
