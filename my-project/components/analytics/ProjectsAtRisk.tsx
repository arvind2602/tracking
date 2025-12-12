'use client';

import { useEffect, useState } from 'react';
import axios from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar } from "lucide-react";

interface ProjectRisk {
    id: string;
    name: string;
    endDate: string | null;
    completionRate: number;
    overdueTasks: number;
    riskFactor: 'High' | 'Medium';
}

export function ProjectsAtRisk() {
    const [projects, setProjects] = useState<ProjectRisk[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const response = await axios.get('/analytics/projects-risk');
                setProjects(response.data);
            } catch (error) {
                console.error('Failed to fetch projects at risk', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProjects();
    }, []);

    if (loading) return <div>Loading...</div>;

    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Projects at Risk
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project Name</TableHead>
                            <TableHead>Deadline</TableHead>
                            <TableHead>Completion</TableHead>
                            <TableHead>Overdue Tasks</TableHead>
                            <TableHead>Risk Level</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {projects.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                    No projects currently at risk.
                                </TableCell>
                            </TableRow>
                        ) : (
                            projects.map((project) => (
                                <TableRow key={project.id}>
                                    <TableCell className="font-medium">{project.name}</TableCell>
                                    <TableCell>
                                        {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}
                                    </TableCell>
                                    <TableCell>{project.completionRate}%</TableCell>
                                    <TableCell>{project.overdueTasks}</TableCell>
                                    <TableCell>
                                        <Badge variant={project.riskFactor === 'High' ? 'destructive' : 'secondary'}>
                                            {project.riskFactor}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
