'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import Breadcrumbs from '@/components/ui/breadcrumbs';
import axios from '@/lib/axios';
import toast from 'react-hot-toast';
import { Loader } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CalendarDays, CheckCircle2, Circle, Clock, Target, Download } from 'lucide-react';

interface Task {
  id: string;
  description: string;
  status: string;
  points: number;
  assignedToName: string;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;
  tasks: Task[];
}

const ProjectDetailsPage = () => {
  const params = useParams();
  const { projectId } = params;
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`/projects/${projectId}`);
        setProject(response.data);
      } catch (error) {
        toast.error('Failed to fetch project details');
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const handleExportTasks = async () => {
    const toastId = toast.loading('Exporting tasks...');
    try {
      const response = await axios.get(`/projects/${projectId}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${project?.name || 'project'}_tasks.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Tasks exported', { id: toastId });
    } catch {
      toast.error('Export failed', { id: toastId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin h-12 w-12 text-accent" />
      </div>
    );
  }

  if (!project) {
    return <div>Project not found</div>;
  }

  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Projects', href: '/dashboard/projects' },
    { label: project.name, href: `/dashboard/projects/${project.id}` },
  ];

  const stats = [
    { label: 'Total Tasks', value: project.tasks?.length || 0 },
    { label: 'Completed', value: project.tasks?.filter((t: Task) => t.status === 'DONE').length || 0 },
    { label: 'In Progress', value: project.tasks?.filter((t: Task) => t.status === 'IN_PROGRESS').length || 0 },
    { label: 'To Do', value: project.tasks?.filter((t: Task) => t.status === 'TODO').length || 0 },
  ];

  const totalPoints = project.tasks?.reduce((sum, task) => sum + (task.points || 0), 0) || 0;

  return (
    <div className="space-y-8 font-sans">
      <Breadcrumbs items={breadcrumbItems} />

      {/* Header Section */}
      <div className="flex flex-col gap-2 border-b pb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{project.name}</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-lg">{project.description}</p>
          </div>
          <Badge variant="outline" className="px-3 py-1 text-sm bg-muted/50 gap-2 font-mono">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {new Date(project.startDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total Tasks" value={project.tasks?.length || 0} icon={Circle} className="bg-primary/5 border-primary/20" />
        <StatCard title="Completed" value={project.tasks?.filter((t) => t.status === 'completed' || t.status === 'DONE').length || 0} icon={CheckCircle2} className="bg-green-500/5 border-green-500/20 text-green-700 dark:text-green-400" />
        <StatCard title="In Progress" value={project.tasks?.filter((t) => t.status === 'in-progress' || t.status === 'IN_PROGRESS').length || 0} icon={Clock} className="bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-400" />
        <StatCard title="Pending" value={project.tasks?.filter((t) => t.status === 'pending' || t.status === 'TODO').length || 0} icon={Circle} className="bg-orange-500/5 border-orange-500/20 text-orange-700 dark:text-orange-400" />
        <StatCard title="Total Points" value={totalPoints} icon={Target} className="bg-purple-500/5 border-purple-500/20 text-purple-700 dark:text-purple-400" />
      </div>

      {/* Tasks Table/List */}
      <Card className="border-accent/20 shadow-sm bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b bg-muted/40 px-6 py-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            Tasks
            <Badge variant="secondary" className="rounded-full px-2 text-xs">{project.tasks?.length || 0}</Badge>
          </CardTitle>
          <Button onClick={handleExportTasks} variant="outline" size="sm" className="gap-2 h-8">
            <Download className="h-3.5 w-3.5" />
            Export Tasks
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
            <div className="col-span-1">#</div>
            <div className="col-span-11 md:col-span-6">Description</div>
            <div className="hidden md:block col-span-2">Assigned To</div>
            <div className="hidden md:block col-span-2">Status</div>
            <div className="hidden md:block col-span-1 text-right">Points</div>
          </div>

          {/* List */}
          {project.tasks?.length > 0 ? (
            <div className="divide-y divide-border">
              {project.tasks.map((task, i) => (
                <div key={task.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-accent/5 transition-colors group">
                  <div className="col-span-1 text-muted-foreground font-mono text-xs">{i + 1}</div>
                  <div className="col-span-11 md:col-span-6 font-medium text-sm text-foreground pr-4">
                    <Link href={`/dashboard/tasks/${task.id}`} className="hover:underline decoration-primary/50 underline-offset-4 line-clamp-2">
                      {task.description}
                    </Link>
                    <div className="md:hidden mt-2 flex gap-2 items-center text-xs text-muted-foreground">
                      <span>{task.assignedToName}</span> • <StatusBadge status={task.status} />
                    </div>
                  </div>
                  <div className="hidden md:block col-span-2 text-sm text-muted-foreground">
                    {task.assignedToName || 'Unassigned'}
                  </div>
                  <div className="hidden md:block col-span-2">
                    <StatusBadge status={task.status} />
                  </div>
                  <div className="hidden md:block col-span-1 text-right text-sm font-mono text-muted-foreground bg-muted/30 py-0.5 rounded px-2 w-fit ml-auto">
                    {task.points}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <p>No tasks found in this project.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function StatCard({ title, value, icon: Icon, className }: any) {
  return (
    <Card className={`shadow-sm ${className}`}>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        {Icon && <Icon className="h-5 w-5 opacity-50" />}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();
  const styles = {
    'completed': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    'done': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    'in-progress': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    'todo': 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    'pending': 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  };
  const style = styles[normalizedStatus as keyof typeof styles] || styles['todo'];
  return (
    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${style}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default ProjectDetailsPage;