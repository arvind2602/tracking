'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

import axios from '@/lib/axios';

async function getTaskPoints() {
  const res = await axios.get('/reports/task-points');
  return res.data;
}

export function TaskPoints() {
  const { data, isLoading, error } = useQuery({
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
          <Legend />
          {data?.employees.map((emp: any, index: number) => (
            <Bar key={emp} dataKey={emp} fill={`#${Math.floor(Math.random() * 16777215).toString(16)}`} stackId="a" />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
