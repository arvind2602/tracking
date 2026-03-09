'use client';

import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import axios from '@/lib/axios';
import Link from 'next/link';

async function getPointsLeaderboard() {
  const res = await axios.get('/performance/points-leaderboard');
  return res.data;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  totalPoints: number;
}

export function PointsLeaderboard() {
  const { data, isLoading, error } = useQuery<LeaderboardEntry[]>({
    queryKey: ['pointsLeaderboard'],
    queryFn: getPointsLeaderboard,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div>
      <h3 className="text-lg font-medium">Points Leaderboard</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Total Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((emp: LeaderboardEntry) => (
              <TableRow key={emp.id || emp.name}>
                <TableCell className="font-medium">
                  {emp.id ? (
                    <Link href={`/dashboard/users/${emp.id}`} className="hover:text-primary hover:underline transition-colors">
                      {emp.name}
                    </Link>
                  ) : (
                    emp.name
                  )}
                </TableCell>
                <TableCell>{emp.totalPoints}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
