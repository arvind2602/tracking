'use client';

import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

import axios from '@/lib/axios';

async function getProjectsPerOrg() {
  const res = await axios.get('/reports/projects-per-org');
  return res.data;
}

export function ProjectsPerOrg() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['projectsPerOrg'],
    queryFn: getProjectsPerOrg,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div>
      <h3 className="text-lg font-medium">Projects per Organization</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Progress</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((org: any) =>
            {(org.projects || []).map((proj: any) => (
              <TableRow key={proj.id}>
                <TableCell>{org.name}</TableCell>
                <TableCell>{proj.name}</TableCell>
                <TableCell>
                  <Progress value={proj.progress} />
                </TableCell>
              </TableRow>
            ))}
          )}
        </TableBody>
      </Table>
    </div>
  );
}
