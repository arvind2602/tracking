'use client';

import { useQuery } from '@tanstack/react-query';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Award, AlertCircle, Target } from 'lucide-react';

import axios from '@/lib/axios';

async function getMonthlyProductivityTrend() {
    const res = await axios.get('/performance/monthly-productivity-trend');
    return res.data;
}

interface AnalysisData {
    avgPoints: number;
    trend: number;
    bestMonth: { name: string; points: number };
    worstMonth: { name: string; points: number };
    totalTasks: number;
}

interface ProductivityData {
    data: Array<{ name: string; points: number; taskCount: number }>;
    analysis: AnalysisData | null;
}

export function MonthlyProductivityTrend() {
    const { data, isLoading, error } = useQuery<ProductivityData>({
        queryKey: ['monthlyProductivityTrend'],
        queryFn: getMonthlyProductivityTrend,
    });

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Error loading data</div>;

    const analysis = data?.analysis;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Monthly Productivity (Points per Month)</h3>
                {analysis && (
                    <div className="flex items-center gap-2">
                        {analysis.trend > 0 ? (
                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="h-4 w-4" />
                                <span className="text-sm font-semibold">+{analysis.trend}%</span>
                            </div>
                        ) : analysis.trend < 0 ? (
                            <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                                <TrendingDown className="h-4 w-4" />
                                <span className="text-sm font-semibold">{analysis.trend}%</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <span className="text-sm font-semibold">No change</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data?.data}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                        dataKey="name"
                        className="text-xs"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                    />
                    <YAxis className="text-xs" />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                        }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line
                        type="monotone"
                        dataKey="points"
                        stroke="#10b981"
                        strokeWidth={2}
                        activeDot={{ r: 8 }}
                        name="Points"
                    />
                </LineChart>
            </ResponsiveContainer>

            {/* Analysis Section */}
            {analysis && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4 border-t border-border">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Target className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">Avg/Month</span>
                        </div>
                        <p className="text-lg font-bold text-foreground">{analysis.avgPoints}</p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Award className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">Best Month</span>
                        </div>
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{analysis.bestMonth.name}</p>
                        <p className="text-xs text-muted-foreground">{analysis.bestMonth.points} pts</p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">Worst Month</span>
                        </div>
                        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{analysis.worstMonth.name}</p>
                        <p className="text-xs text-muted-foreground">{analysis.worstMonth.points} pts</p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            {analysis.trend >= 0 ? (
                                <TrendingUp className="h-3.5 w-3.5" />
                            ) : (
                                <TrendingDown className="h-3.5 w-3.5" />
                            )}
                            <span className="text-xs font-medium">Trend</span>
                        </div>
                        <p className={`text-lg font-bold ${analysis.trend > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : analysis.trend < 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-muted-foreground'
                            }`}>
                            {analysis.trend > 0 ? '+' : ''}{analysis.trend}%
                        </p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="text-xs font-medium">Total Tasks</span>
                        </div>
                        <p className="text-lg font-bold text-foreground">{analysis.totalTasks}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
