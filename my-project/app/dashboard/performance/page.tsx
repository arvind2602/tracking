import { TaskCompletionRate } from "@/components/performance/TaskCompletionRate";
import { PointsLeaderboard } from "@/components/performance/PointsLeaderboard";
import { ProductivityTrend } from "@/components/performance/ProductivityTrend";

export default function PerformancePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2 md:mb-4">Performance</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <TaskCompletionRate />
        </div>
        <div className="border rounded-lg p-4">
          <PointsLeaderboard />
        </div>
        <div className="border rounded-lg p-4 md:col-span-3">
          <ProductivityTrend />
        </div>
      </div>
    </div>
  );
}