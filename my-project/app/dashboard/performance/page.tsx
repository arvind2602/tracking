import { TaskCompletionRate } from "@/components/performance/TaskCompletionRate";
import { PointsLeaderboard } from "@/components/performance/PointsLeaderboard";
import { ProductivityTrend } from "@/components/performance/ProductivityTrend";
import React from "react";

export default function PerformancePage() {
  return (
    <div className="space-y-10">
      <div className="mt-4">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Performance
        </h1>
        <p className="text-muted-foreground mt-2 font-medium">Track employee and organization performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="bg-card border border-border rounded-[2rem] p-8 shadow-lg hover:border-primary/50 transition-all duration-300">
          <TaskCompletionRate />
        </div>
        <div className="bg-card border border-border rounded-[2rem] p-8 shadow-lg hover:border-primary/50 transition-all duration-300">
          <PointsLeaderboard />
        </div>
        <div className="bg-card border border-border rounded-[2rem] p-8 shadow-lg hover:border-primary/50 transition-all duration-300 lg:col-span-3">
          <ProductivityTrend />
        </div>
      </div>
    </div>
  );
}