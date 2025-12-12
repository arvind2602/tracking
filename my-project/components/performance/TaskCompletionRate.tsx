'use client';

import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import axios from '@/lib/axios';

async function getTaskCompletionRate() {
  const res = await axios.get('/performance/task-completion-rate');
  return res.data;
}

interface TaskCompletion {
  id: string;
  name: string;
  completionRate: number | string;
}

export function TaskCompletionRate() {
  const { data, isLoading, error } = useQuery<TaskCompletion[]>({
    queryKey: ['taskCompletionRate'],
    queryFn: getTaskCompletionRate,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div>
      <h3 className="text-lg font-medium">Task Completion Rate per Employee</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Completion Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((emp: TaskCompletion) => (
              <TableRow key={emp.id}>
                <TableCell>{emp.name}</TableCell>
                <TableCell>{!isNaN(Number(emp.completionRate)) ? Number(emp.completionRate).toFixed(2) : '0.00'}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
