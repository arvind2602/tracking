'use client';

import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import axios from '@/lib/axios';

async function getTasksPerEmployee() {
  const res = await axios.get('/reports/tasks-per-employee');
  return res.data;
}

export function TasksPerEmployee() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['tasksPerEmployee'],
    queryFn: getTasksPerEmployee,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div>
      <h3 className="text-lg font-medium">Tasks per Employee</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Task Count</TableHead>
            <TableHead>Total Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((emp: any) => (
            <TableRow key={emp.name + emp.taskCount}>
              <TableCell>{emp.name}</TableCell>
              <TableCell>{emp.taskCount}</TableCell>
              <TableCell>{emp.totalPoints}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
