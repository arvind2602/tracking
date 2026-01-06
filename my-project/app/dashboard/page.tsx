"use client";
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { jwtDecode } from 'jwt-decode';
import { Users, Briefcase, ListChecks, CheckCircle, Download, Activity, Sparkles } from 'lucide-react';
import { cn } from "@/lib/utils";


import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

// Analytics Components
import { TaskCompletionRate } from "@/components/performance/TaskCompletionRate";
import { PointsLeaderboard } from "@/components/performance/PointsLeaderboard";
import { ProductivityTrend } from "@/components/performance/ProductivityTrend";
import { EmployeeCountPerOrg } from "@/components/reports/EmployeeCountPerOrg";
import { ActiveVsArchivedEmployees } from "@/components/reports/ActiveVsArchivedEmployees";
import { ProjectsPerOrg } from "@/components/reports/ProjectsPerOrg";
import { TasksByStatus } from "@/components/reports/TasksByStatus";
import { TasksPerEmployee } from "@/components/reports/TasksPerEmployee";
import { TaskPoints } from "@/components/reports/TaskPoints";
import { RoleDistribution } from "@/components/reports/RoleDistribution";
import { ProjectsAtRisk } from "@/components/analytics/ProjectsAtRisk";
import { TaskInsights } from "@/components/analytics/TaskInsights";
import { EmployeePerformance } from "@/components/analytics/EmployeePerformance";

interface DecodedToken {
  user: {
    firstName: string;
  };
}

// Fetch dashboard summary data
async function getDashboardData() {
  const res = await axios.get('/performance/dashboard-summary');
  return res.data;
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      try {
        const payload: DecodedToken = jwtDecode(token);
        setUserName(payload.user.firstName);
      } catch (error) {
        console.error('Invalid token', error);
      }
    }
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: getDashboardData,
  });

  const handleExport = async () => {
    const toastId = toast.loading('Exporting data...');
    try {
      const res = await axios.get('/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export successful', { id: toastId });
    } catch (error) {
      console.error('Export failed', error);
      toast.error('Export failed', { id: toastId });
    }
  };

  if (isLoading) return <div className="p-8">Loading dashboard...</div>;
  if (error) return <div className="p-8">Error loading data.</div>;

  // Calculate ToDo count safely
  const tasksTodo = Array.isArray(data?.tasksByStatus)
    ? data.tasksByStatus.find((t: any) => t.status === 'TODO')?._count?.status || 0
    : 0;

  return (
    <div className="p-4 md:p-8 space-y-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-200 to-purple-200">
            Welcome, {userName}!
          </h1>
          <p className="text-slate-400 mt-2 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Here is your organization's performance overview.
          </p>
        </div>
        <Button
          onClick={handleExport}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-none rounded-xl px-6 py-5 shadow-lg shadow-blue-500/20 transition-all duration-300 gap-2 font-semibold"
        >
          <Download className="h-5 w-5" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard title="Total Employees" value={data?.totalEmployees ?? 0} icon={<Users className="h-5 w-5 text-blue-400" />} />
        <SummaryCard title="Total Projects" value={data?.totalProjects ?? 0} icon={<Briefcase className="h-5 w-5 text-purple-400" />} />
        <SummaryCard title="Tasks Pending" value={tasksTodo} icon={<ListChecks className="h-5 w-5 text-cyan-400" />} />
        <SummaryCard title="Total Points" value={data?.totalPoints ?? 0} icon={<CheckCircle className="h-5 w-5 text-emerald-400" />} />
      </div>

      {/* Key Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          <EmployeeCountPerOrg />,
          <ActiveVsArchivedEmployees />,
          <ProjectsPerOrg />
        ].map((child, idx) => (
          <div key={idx} className={cn(
            "backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-300 group",
            idx === 2 ? "md:col-span-2" : ""
          )}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 group-hover:text-blue-400 transition-colors">
                {idx === 0 ? "Employee Distribution" : idx === 1 ? "Employee Status" : "Active Projects"}
              </h3>
            </div>
            {child}
          </div>
        ))}
      </div>

      {/* Advanced Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-300">
          <ProjectsAtRisk />
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-300">
          <TaskInsights />
        </div>
      </div>

      {/* Employee Deep Dive */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-300">
        <EmployeePerformance />
      </div>

      {/* Performance Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-300 lg:col-span-2">
          <ProductivityTrend />
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-300">
          <TaskCompletionRate />
        </div>
      </div>

      {/* Task & Role Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-300">
          <TasksByStatus />
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-300">
          <RoleDistribution />
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-300">
          <PointsLeaderboard />
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-300">
          <TaskPoints />
        </div>
      </div>

      {/* Full Employee Task List */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-300">
        <TasksPerEmployee />
      </div>

      {/* Recent Activity Feed */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-300">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-white">
          <Activity className="w-5 h-5 text-blue-400" />
          Recent Activity Feed
        </h3>
        <RecentActivity />
      </div>

    </div>
  );
}