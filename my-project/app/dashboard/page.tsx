"use client";
import { useQuery } from '@tanstack/react-query';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Users, Briefcase, ListChecks, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  user: {
    firstName: string;
  };
}

async function getDashboardData() {
  return {
    totalEmployees: 42,
    totalProjects: 18,
    totalPoints: 1250,
    tasksByStatus: [
      { status: 'TODO', _count: { status: 7 } },
      { status: 'IN_PROGRESS', _count: { status: 5 } },
      { status: 'DONE', _count: { status: 12 } },
    ],
  };
}

let userName = 'John';
const token = typeof window !== 'undefined' ? localStorage.getItem('token') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImZpcnN0TmFtZSI6IkpvaG4ifX0.dummy' : null;
if (token) {
  try {
    const payload: DecodedToken = jwtDecode(token);
    userName = payload.user.firstName;
  } catch (error) {
    console.error('Invalid token', error);
  }
}

export default function DashboardPage() {

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: getDashboardData,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  const tasksTodo = data?.tasksByStatus.find((task: { status: string; _count: { status: number; }; }) => task.status === 'TODO')?._count.status || 0;

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Welcome, {userName}!</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Employees" value={data?.totalEmployees ?? 0} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
        <SummaryCard title="Total Projects" value={data?.totalProjects ?? 0} icon={<Briefcase className="h-4 w-4 text-muted-foreground" />} />
        <SummaryCard title="Tasks To Do" value={tasksTodo} icon={<ListChecks className="h-4 w-4 text-muted-foreground" />} />
        <SummaryCard title="Total Points" value={data?.totalPoints ?? 0} icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />} />
        <div className="md:col-span-3 lg:col-span-4 border rounded-lg p-4">
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}