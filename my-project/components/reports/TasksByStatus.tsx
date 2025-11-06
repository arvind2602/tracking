'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import axios from '@/lib/axios';

async function getTasksByStatus() {
  const res = await axios.get('/reports/tasks-by-status');
  return res.data;
}

export function TasksByStatus() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['tasksByStatus'],
    queryFn: getTasksByStatus,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div>
      <h3 className="text-lg font-medium">Tasks by Status</h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data}>
          <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <Bar dataKey="count" fill="#82ca9d" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
