'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

import axios from '@/lib/axios';

async function getTaskPoints() {
  const res = await axios.get('/reports/task-points');
  return res.data;
}

interface TaskPointsData {
    data: any[];
    employees: string[];
}

const COLORS = ['#FFBB28', '#FF8042', '#0088FE', '#00C49F', '#82ca9d'];

export function TaskPoints() {
  const { data, isLoading, error } = useQuery<TaskPointsData>({
    queryKey: ['taskPoints'],
    queryFn: getTaskPoints,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div>
      <h3 className="text-lg font-medium">Task Points per Project and Employee</h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data?.data} stackOffset="sign">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          {data?.employees.map((emp: string, index: number) => (
            <Bar key={emp} dataKey={emp} fill={COLORS[index % COLORS.length]} stackId="a" />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
