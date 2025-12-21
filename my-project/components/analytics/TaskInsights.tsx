'use client';

import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, AlertCircle } from "lucide-react";
import { formatDateTimeIST, formatDateIST } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface StuckTask {
    id: string;
    description: string;
    updatedAt: string;
    firstName: string;
    lastName: string;
}

interface TaskInsightsData {
    avgResolutionHours: number;
    stuckTasks: StuckTask[];
}

export function TaskInsights() {
    const { data, isLoading: loading } = useQuery<TaskInsightsData>({
        queryKey: ['task-insights'],
        queryFn: async () => {
            const response = await axios.get('/analytics/task-insights');
            return response.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes cache
    });

    if (loading) return <div>Loading...</div>;

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        Avg Resolution Time
                    </CardTitle>
                    <CardDescription>Average time to complete a task</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-4xl font-bold text-primary">
                        {data?.avgResolutionHours} <span className="text-lg font-normal text-muted-foreground">hours</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                        Stuck Tasks
                    </CardTitle>
                    <CardDescription>Tasks not updated in 5+ days</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {data?.stuckTasks.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No stuck tasks found.</p>
                        ) : (
                            data?.stuckTasks.slice(0, 3).map((task) => (
                                <div key={task.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                                    <div>
                                        <p className="text-sm font-medium truncate max-w-[200px]">{task.description}</p>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            {task.firstName} {task.lastName} •
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="cursor-help">{formatDateIST(task.updatedAt)}</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{formatDateTimeIST(task.updatedAt)}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                        {data?.stuckTasks && data.stuckTasks.length > 3 && (
                            <p className="text-xs text-center text-muted-foreground">
                                + {data.stuckTasks.length - 3} more
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
