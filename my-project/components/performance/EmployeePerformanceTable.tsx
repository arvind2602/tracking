'use client';

import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { useState } from 'react';
import { ArrowUpDown, Trophy, Target, CheckCircle, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

// Fetch all employee data
async function getEmployeePerformanceData() {
    const [completionData, leaderboardData, tasksData] = await Promise.all([
        axios.get('/performance/task-completion-rate'),
        axios.get('/performance/points-leaderboard'),
        axios.get('/reports/tasks-per-employee'),
    ]);

    // Merge all data by employee name
    const mergedData = new Map();

    // Add completion rate data
    completionData.data.forEach((emp: any) => {
        mergedData.set(emp.name, {
            id: emp.id,
            name: emp.name,
            completionRate: !isNaN(Number(emp.completionRate)) ? Number(emp.completionRate) : 0,
            totalPoints: 0,
            taskCount: 0,
        });
    });

    // Add leaderboard points
    leaderboardData.data.forEach((emp: any) => {
        const existing = mergedData.get(emp.name) || { id: emp.name, name: emp.name, completionRate: 0, taskCount: 0 };
        existing.totalPoints = emp.totalPoints;
        mergedData.set(emp.name, existing);
    });

    // Add task count data
    tasksData.data.forEach((emp: any) => {
        const existing = mergedData.get(emp.name) || { id: emp.name, name: emp.name, completionRate: 0, totalPoints: 0 };
        existing.taskCount = emp.taskCount;
        existing.totalPoints = emp.totalPoints; // Use this as primary source for total points
        mergedData.set(emp.name, existing);
    });

    return Array.from(mergedData.values());
}

interface EmployeePerformance {
    id: string;
    name: string;
    completionRate: number;
    totalPoints: number;
    taskCount: number;
}

type SortField = 'name' | 'completionRate' | 'totalPoints' | 'taskCount';

export function EmployeePerformanceTable() {
    const [sortField, setSortField] = useState<SortField>('totalPoints');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const { data, isLoading, error } = useQuery<EmployeePerformance[]>({
        queryKey: ['employeePerformanceTable'],
        queryFn: getEmployeePerformanceData,
    });

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const sortedData = data?.slice().sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortOrder === 'asc'
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        }

        return sortOrder === 'asc'
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number);
    });

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full animate-pulse"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-destructive text-center p-8">
                Error loading employee performance data
            </div>
        );
    }

    const getRankBadge = (index: number) => {
        if (index === 0) return <Trophy className="h-4 w-4 text-yellow-400 fill-yellow-400" />;
        if (index === 1) return <Trophy className="h-4 w-4 text-gray-400 fill-gray-400" />;
        if (index === 2) return <Trophy className="h-4 w-4 text-amber-700 fill-amber-700" />;
        return null;
    };

    const getCompletionRateColor = (rate: number) => {
        if (rate >= 80) return 'text-emerald-400 font-bold';
        if (rate >= 60) return 'text-blue-400 font-semibold';
        if (rate >= 40) return 'text-yellow-400 font-medium';
        return 'text-red-400 font-medium';
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <Target className="h-5 w-5 text-blue-400" />
                        Employee Performance Overview
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Comprehensive view of tasks, points, and completion rates
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                        <CheckCircle className="h-3 w-3 text-blue-400" />
                        <span className="text-blue-400 font-medium">{sortedData?.length || 0} Employees</span>
                    </div>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden bg-card">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                <th className="px-2 py-2 md:px-4 md:py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-xs">
                                    Rank
                                </th>
                                <th
                                    className="px-2 py-2 md:px-4 md:py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors text-xs group"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center gap-1">
                                        Emp
                                        <ArrowUpDown className={cn(
                                            "h-2.5 w-2.5 md:h-3 md:w-3 opacity-50 group-hover:opacity-100 transition-opacity",
                                            sortField === 'name' && "text-blue-400 opacity-100"
                                        )} />
                                    </div>
                                </th>
                                <th
                                    className="px-2 py-2 md:px-4 md:py-3 text-center font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors text-xs group"
                                    onClick={() => handleSort('taskCount')}
                                >
                                    <div className="flex items-center justify-center gap-1">
                                        <ListChecks className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                        Tsk
                                        <ArrowUpDown className={cn(
                                            "h-2.5 w-2.5 md:h-3 md:w-3 opacity-50 group-hover:opacity-100 transition-opacity",
                                            sortField === 'taskCount' && "text-blue-400 opacity-100"
                                        )} />
                                    </div>
                                </th>
                                <th
                                    className="px-2 py-2 md:px-4 md:py-3 text-center font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors text-xs group"
                                    onClick={() => handleSort('completionRate')}
                                >
                                    <div className="flex items-center justify-center gap-1">
                                        <CheckCircle className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                        %
                                        <ArrowUpDown className={cn(
                                            "h-2.5 w-2.5 md:h-3 md:w-3 opacity-50 group-hover:opacity-100 transition-opacity",
                                            sortField === 'completionRate' && "text-blue-400 opacity-100"
                                        )} />
                                    </div>
                                </th>
                                <th
                                    className="px-2 py-2 md:px-4 md:py-3 text-center font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors text-xs group"
                                    onClick={() => handleSort('totalPoints')}
                                >
                                    <div className="flex items-center justify-center gap-1">
                                        <Trophy className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                        Pts
                                        <ArrowUpDown className={cn(
                                            "h-2.5 w-2.5 md:h-3 md:w-3 opacity-50 group-hover:opacity-100 transition-opacity",
                                            sortField === 'totalPoints' && "text-blue-400 opacity-100"
                                        )} />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sortedData?.map((emp, index) => (
                                <tr
                                    key={emp.id}
                                    className={cn(
                                        "hover:bg-muted/30 transition-colors",
                                        index < 3 && sortField === 'totalPoints' && sortOrder === 'desc' && "bg-muted/20"
                                    )}
                                >
                                    <td className="px-2 py-2 md:px-4 md:py-3 text-center">
                                        <div className="flex items-center justify-center">
                                            {sortField === 'totalPoints' && sortOrder === 'desc' ? (
                                                getRankBadge(index) || <span className="text-muted-foreground text-xs font-mono">{index + 1}</span>
                                            ) : (
                                                <span className="text-muted-foreground text-xs font-mono">{index + 1}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-2 py-2 md:px-4 md:py-3 font-semibold text-foreground text-xs md:text-sm">
                                        {emp.name}
                                    </td>
                                    <td className="px-2 py-2 md:px-4 md:py-3 text-center">
                                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 md:px-2 md:py-1 rounded-md bg-blue-500/10 text-blue-400 font-mono text-xs min-w-[2rem] md:min-w-[3rem]">
                                            {emp.taskCount}
                                        </span>
                                    </td>
                                    <td className="px-2 py-2 md:px-4 md:py-3 text-center">
                                        <span className={cn(
                                            "inline-flex items-center justify-center px-1.5 py-0.5 md:px-2 md:py-1 rounded-md font-mono text-xs min-w-[2.5rem] md:min-w-[4rem]",
                                            getCompletionRateColor(emp.completionRate)
                                        )}>
                                            {emp.completionRate.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-2 py-2 md:px-4 md:py-3 text-center">
                                        <span className="inline-flex items-center justify-center px-2 py-0.5 md:px-3 md:py-1 rounded-md bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-400 font-bold text-xs min-w-[2.5rem] md:min-w-[4rem]">
                                            {emp.totalPoints}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>

                    </table>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-muted/30 rounded-lg p-3 border border-border">
                    <div className="text-muted-foreground mb-1">Avg Completion Rate</div>
                    <div className="text-foreground font-bold text-lg">
                        {sortedData && sortedData.length > 0
                            ? (sortedData.reduce((sum, emp) => sum + emp.completionRate, 0) / sortedData.length).toFixed(1)
                            : '0.0'}%
                    </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 border border-border">
                    <div className="text-muted-foreground mb-1">Total Tasks</div>
                    <div className="text-foreground font-bold text-lg">
                        {sortedData?.reduce((sum, emp) => sum + emp.taskCount, 0) || 0}
                    </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 border border-border">
                    <div className="text-muted-foreground mb-1">Total Points</div>
                    <div className="text-foreground font-bold text-lg">
                        {sortedData?.reduce((sum, emp) => sum + emp.totalPoints, 0) || 0}
                    </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 border border-border">
                    <div className="text-muted-foreground mb-1">Avg Points/Employee</div>
                    <div className="text-foreground font-bold text-lg">
                        {sortedData && sortedData.length > 0
                            ? Math.round(sortedData.reduce((sum, emp) => sum + emp.totalPoints, 0) / sortedData.length)
                            : 0}
                    </div>
                </div>
            </div>
        </div>
    );
}
