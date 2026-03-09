'use client';

import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, Clock } from "lucide-react";
import Link from 'next/link';

async function getActiveProjectsThisWeek() {
    const res = await axios.get('/performance/active-projects-this-week');
    return res.data;
}

interface ActiveProject {
    id: string;
    name: string;
    activityCount: number;
    completedTasks: number;
    ongoingTasks: number;
}

export function ActiveProjectsThisWeek() {
    const { data, isLoading, error } = useQuery<ActiveProject[]>({
        queryKey: ['activeProjectsThisWeek'],
        queryFn: getActiveProjectsThisWeek,
    });

    if (isLoading) return <div className="p-4 text-muted-foreground animate-pulse">Loading active projects...</div>;
    if (error) return <div className="p-4 text-destructive">Error loading data</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-500" />
                    Active Projects This Week
                </h3>
                <Badge variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/20">
                    Last 7 Days
                </Badge>
            </div>

            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="font-semibold">Project Name</TableHead>
                            <TableHead className="text-center font-semibold text-blue-500">Total Activity</TableHead>
                            <TableHead className="text-center font-semibold text-emerald-500">Done</TableHead>
                            <TableHead className="text-center font-semibold text-amber-500">Ongoing</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data && data.length > 0 ? (
                            data.map((proj) => (
                                <TableRow key={proj.id} className="group transition-colors">
                                    <TableCell className="font-medium">
                                        <Link
                                            href={`/dashboard/projects/${proj.id}`}
                                            className="hover:text-primary hover:underline underline-offset-4 decoration-primary/30 transition-all"
                                        >
                                            {proj.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 font-mono text-xs font-bold">
                                            {proj.activityCount}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1.5 text-emerald-600">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span className="font-mono text-xs">{proj.completedTasks}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1.5 text-amber-600">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span className="font-mono text-xs">{proj.ongoingTasks}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    No project activity recorded this week.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
