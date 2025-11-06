'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import axios from '@/lib/axios';

async function getEmployeeCountPerOrg() {
  const res = await axios.get('/reports/employee-count-per-org');
  return res.data;
}

interface EmployeeCount {
  name: string;
  employeeCount: number;
}

export function EmployeeCountPerOrg() {
  const { data, isLoading, error } = useQuery<EmployeeCount[]>({
    queryKey: ['employeeCountPerOrg'],
    queryFn: getEmployeeCountPerOrg,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h3 className="text-lg font-medium">Employee Count per Organization</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Employee Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((org: EmployeeCount) => (
              <TableRow key={org.name}>
                <TableCell>{org.name}</TableCell>
                <TableCell>{org.employeeCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <Bar dataKey="employeeCount" fill="#adfa1d" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
