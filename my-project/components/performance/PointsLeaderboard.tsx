'use client';

import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import axios from '@/lib/axios';

async function getPointsLeaderboard() {
  const res = await axios.get('/performance/points-leaderboard');
  return res.data;
}

export function PointsLeaderboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pointsLeaderboard'],
    queryFn: getPointsLeaderboard,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div>
      <h3 className="text-lg font-medium">Points Leaderboard</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Total Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((emp: any) => (
            <TableRow key={emp.name}>
              <TableCell>{emp.name}</TableCell>
              <TableCell>{emp.totalPoints}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
