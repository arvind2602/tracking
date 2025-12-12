'use client';

import { useEffect, useState } from 'react';
import axios from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Trophy, Users } from "lucide-react";

interface EmployeeAnalytics {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    totalAssigned: string | number;
    completedTasks: string | number;
    pendingTasks: string | number; // This includes pending, todo, in-progress
    overdueTasks: string | number;
    totalPoints: string | number;
    pointsLast30Days: string | number;
    avgCompletionTimeHours: string | number;
}

export function EmployeePerformance() {
    const [employees, setEmployees] = useState<EmployeeAnalytics[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/analytics/employee-performance');
                // Ensure response data is an array
                if (Array.isArray(response.data)) {
                    setEmployees(response.data);
                } else {
                    console.error('Unexpected API response format', response.data);
                    setEmployees([]);
                }
            } catch (error) {
                console.error('Failed to fetch employee performance', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div>Loading...</div>;

    // Derived lists
    const workloadList = [...employees]
        .sort((a, b) => Number(b.pendingTasks) - Number(a.pendingTasks))
        .slice(0, 5);

    const topContributorsList = [...employees]
        .sort((a, b) => Number(b.pointsLast30Days) - Number(a.pointsLast30Days))
        .slice(0, 5);

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Workload Balance
                    </CardTitle>
                    <CardDescription>Active tasks per employee</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {workloadList.map((emp) => {
                            const activeLoad = Number(emp.pendingTasks);
                            const maxLoad = 10; // Assumption for visualization
                            const loadPercent = Math.min((activeLoad / maxLoad) * 100, 100);

                            return (
                                <div key={emp.id} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium">{emp.firstName} {emp.lastName}</span>
                                        <span className="text-muted-foreground">{activeLoad} active tasks</span>
                                    </div>
                                    <Progress value={loadPercent} className="h-2" />
                                </div>
                            );
                        })}
                        {workloadList.length === 0 && <p className="text-sm text-muted-foreground">No data available.</p>}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Top Contributors
                    </CardTitle>
                    <CardDescription>Points earned in last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {topContributorsList.map((emp, index) => (
                            <div key={emp.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                        index === 1 ? 'bg-gray-100 text-gray-700' :
                                            index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{emp.firstName} {emp.lastName}</p>
                                    </div>
                                </div>
                                <div className="font-bold text-primary">{emp.pointsLast30Days} pts</div>
                            </div>
                        ))}
                        {topContributorsList.length === 0 && <p className="text-sm text-muted-foreground">No data available.</p>}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
