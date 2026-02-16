'use client';

import { useQuery } from '@tanstack/react-query';
import { Pie, PieChart, ResponsiveContainer, Cell, Legend } from 'recharts';

import axios from '@/lib/axios';

async function getActiveVsArchivedEmployees() {
  const res = await axios.get('/reports/active-vs-archived-employees');
  return res.data;
}

interface EmployeeStatus {
  name: string;
  value: number;
  [key: string]: string | number;
}

const COLORS = ['#0088FE', '#00C49F'];

export function ActiveVsArchivedEmployees() {
  const { data, isLoading, error } = useQuery<EmployeeStatus[]>({
    queryKey: ['activeVsArchivedEmployees'],
    queryFn: getActiveVsArchivedEmployees,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div>
      <h3 className="text-lg font-medium">Active vs Archived Employees</h3>
      <ResponsiveContainer width="100%" height={350}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
            {data?.map((entry: EmployeeStatus, index: number) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
