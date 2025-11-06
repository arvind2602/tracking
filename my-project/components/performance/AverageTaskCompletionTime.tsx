'use client';

import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import axios from '@/lib/axios';

async function getAverageTaskCompletionTime() {
  const res = await axios.get('/performance/average-task-completion-time');
  return res.data;
}

interface AverageCompletionTime {
  id: string;
  name: string;
  averageCompletionTime: number;
}

export function AverageTaskCompletionTime() {
  const { data, isLoading, error } = useQuery<AverageCompletionTime[]>({
    queryKey: ['averageTaskCompletionTime'],
    queryFn: getAverageTaskCompletionTime,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div>
      <h3 className="text-lg font-medium">Average Task Completion Time</h3>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Average Completion Time (hours)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((emp: AverageCompletionTime) => (
            <TableRow key={emp.id}>
              <TableCell>{emp.name}</TableCell>
              <TableCell>{(emp.averageCompletionTime / (1000 * 60 * 60)).toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </div>
  );
}
