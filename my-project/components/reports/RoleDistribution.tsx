'use client';

import { useQuery } from '@tanstack/react-query';
import { Pie, PieChart, ResponsiveContainer, Cell, Legend } from 'recharts';

import axios from '@/lib/axios';

async function getRoleDistribution() {
  const res = await axios.get('/reports/role-distribution');
  return res.data;
}

const COLORS = ['#FFBB28', '#FF8042'];

export function RoleDistribution() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['roleDistribution'],
    queryFn: getRoleDistribution,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div>
      <h3 className="text-lg font-medium">Role Distribution</h3>
      <ResponsiveContainer width="100%" height={350}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
            {data?.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
