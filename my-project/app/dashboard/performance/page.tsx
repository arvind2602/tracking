import { TaskCompletionRate } from "@/components/performance/TaskCompletionRate";
import { PointsLeaderboard } from "@/components/performance/PointsLeaderboard";
import { ProductivityTrend } from "@/components/performance/ProductivityTrend";
import React from "react";

export default function PerformancePage() {
  return (
    <div className="space-y-10">
      <div className="mt-4">
        <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-200 to-purple-200">
          Performance
        </h1>
        <p className="text-slate-400 mt-2 font-medium">Track employee and organization performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] p-8 shadow-2xl hover:bg-white/10 transition-all duration-300">
          <TaskCompletionRate />
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] p-8 shadow-2xl hover:bg-white/10 transition-all duration-300">
          <PointsLeaderboard />
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] p-8 shadow-2xl hover:bg-white/10 transition-all duration-300 lg:col-span-3">
          <ProductivityTrend />
        </div>
      </div>
    </div>
  );
}