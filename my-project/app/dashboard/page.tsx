"use client";
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { jwtDecode } from 'jwt-decode';
import { Users, Briefcase, ListChecks, CheckCircle, Download } from 'lucide-react';

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
    <div className="p-4 md:p-8 space-y-8 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {userName}!</h1>
          <p className="text-muted-foreground mt-1">Here is your organization's performance overview.</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2 mt-4 md:mt-0">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Employees" value={data?.totalEmployees ?? 0} icon={<Users className="h-5 w-5 text-primary" />} className="border-primary/20 bg-primary/5" />
        <SummaryCard title="Total Projects" value={data?.totalProjects ?? 0} icon={<Briefcase className="h-5 w-5 text-blue-500" />} className="border-blue-500/20 bg-blue-500/5" />
        <SummaryCard title="Tasks Pending" value={tasksTodo} icon={<ListChecks className="h-5 w-5 text-orange-500" />} className="border-orange-500/20 bg-orange-500/5" />
        <SummaryCard title="Total Points" value={data?.totalPoints ?? 0} icon={<CheckCircle className="h-5 w-5 text-green-500" />} className="border-green-500/20 bg-green-500/5" />
      </div>

      {/* Combined Analytics & Reports Sections */}

      {/* Key Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
          <EmployeeCountPerOrg />
        </div>
        <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
          <ActiveVsArchivedEmployees />
        </div>
        <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6 md:col-span-2">
          <ProjectsPerOrg />
        </div>
      </div>

      {/* Advanced Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProjectsAtRisk />
        <div className="space-y-6">
          <TaskInsights />
        </div>
      </div>

      {/* Employee Deep Dive */}
      <div className="grid grid-cols-1">
        <EmployeePerformance />
      </div>

      {/* Performance Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6 lg:col-span-2">
          <ProductivityTrend />
        </div>
        <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
          <TaskCompletionRate />
        </div>
      </div>

      {/* Task & Role Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
          <TasksByStatus />
        </div>
        <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
          <RoleDistribution />
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
          <PointsLeaderboard />
        </div>
        <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
          <TaskPoints />
        </div>
      </div>

      {/* Full Employee Task List */}
      <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
        <TasksPerEmployee />
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <RecentActivity />
      </div>

    </div>
  );
}