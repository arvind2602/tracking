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
import { CalendarDays, CheckCircle2, Circle, Clock, Target, Download, Pause, Play, History } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { jwtDecode } from 'jwt-decode';
import { formatFullDateTimeIST, cn } from '@/lib/utils';

interface Task {
  id: string;
  description: string;
  status: string;
  points: number;
  assignedToName: string;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  totalTasks: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;
  tasks: Task[];
  status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
  holdHistory?: { startDate: string; endDate: string | null; reason: string }[];
  pagination?: Pagination;
}

const ProjectDetailsPage = () => {
  const params = useParams();
  const { projectId } = params;
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload: any = jwtDecode(token);
        setUserRole(payload.user.role);
      } catch (error) {
        console.error('Invalid token', error);
      }
    }
  }, []);

  useEffect(() => {
    const fetchProject = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`/projects/${projectId}`, {
          params: { page: currentPage, limit: pageSize }
        });
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
  }, [projectId, currentPage, pageSize]);

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

  const reloadProject = async () => {
    try {
      const response = await axios.get(`/projects/${projectId}`, {
        params: { page: currentPage, limit: pageSize }
      });
      setProject(response.data);
    } catch (error) {
      toast.error('Failed to refresh project details');
    }
  };

  const handleHoldProject = async () => {
    if (!holdReason.trim()) {
      toast.error('Reason for hold is required');
      return;
    }
    setIsActionLoading(true);
    try {
      await axios.put(`/projects/${projectId}/hold`, { reason: holdReason });
      toast.success('Project put on hold');
      setIsHoldModalOpen(false);
      setHoldReason('');
      reloadProject();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to put project on hold');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResumeProject = async () => {
    setIsActionLoading(true);
    try {
      await axios.put(`/projects/${projectId}/resume`);
      toast.success('Project resumed');
      reloadProject();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to resume project');
    } finally {
      setIsActionLoading(false);
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
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{project.name}</h1>
              <Badge
                className={cn(
                  "font-bold px-3 py-1",
                  project.status === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                    project.status === 'ON_HOLD' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                      "bg-blue-500/10 text-blue-500 border-blue-500/20"
                )}
                variant="outline"
              >
                {project.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2 max-w-2xl text-lg">{project.description}</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <Badge variant="outline" className="px-3 py-1 text-sm bg-muted/50 gap-2 font-mono">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              {new Date(project.startDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </Badge>
            {userRole === 'ADMIN' && (
              <div className="flex gap-2">
                {project.status === 'ACTIVE' ? (
                  <Button
                    onClick={() => setIsHoldModalOpen(true)}
                    variant="outline"
                    className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 gap-2"
                  >
                    <Pause className="h-4 w-4" />
                    Put on Hold
                  </Button>
                ) : project.status === 'ON_HOLD' ? (
                  <Button
                    onClick={handleResumeProject}
                    disabled={isActionLoading}
                    variant="outline"
                    className="border-emerald-500/50 text-emerald-500 hover:bg-emerald-600/10 gap-2"
                  >
                    {isActionLoading ? <Loader className="animate-spin h-4 w-4" /> : <Play className="h-4 w-4" />}
                    Resume Project
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
        <StatCard title="Total" value={project.tasks?.length || 0} icon={Circle} className="bg-primary/5 border-primary/20" />
        <StatCard title="Done" value={project.tasks?.filter((t) => t.status === 'completed' || t.status === 'DONE').length || 0} icon={CheckCircle2} className="bg-green-500/5 border-green-500/20 text-green-700 dark:text-green-400" />
        <StatCard title="Active" value={project.tasks?.filter((t) => t.status === 'in-progress' || t.status === 'IN_PROGRESS').length || 0} icon={Clock} className="bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-400" />
        <StatCard title="Pending" value={project.tasks?.filter((t) => t.status === 'pending' || t.status === 'TODO').length || 0} icon={Circle} className="bg-orange-500/5 border-orange-500/20 text-orange-700 dark:text-orange-400" />
        <StatCard title="Points" value={totalPoints} icon={Target} className="bg-purple-500/5 border-purple-500/20 text-purple-700 dark:text-purple-400" />
      </div>

      {/* Tasks Table/List */}
      <Card className="border-accent/20 shadow-sm bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b bg-muted/40 px-6 py-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            Tasks
            <Badge variant="secondary" className="rounded-full px-2 text-xs">{project.pagination?.totalTasks || project.tasks?.length || 0}</Badge>
          </CardTitle>
          <Button onClick={handleExportTasks} variant="outline" size="sm" className="gap-2 h-8">
            <Download className="h-3.5 w-3.5" />
            Export Tasks
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 md:gap-4 px-3 py-2 md:px-6 md:py-3 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
            <div className="col-span-1">#</div>
            <div className="col-span-11 md:col-span-6">Desc</div>
            <div className="hidden md:block col-span-2">Assigned To</div>
            <div className="hidden md:block col-span-2">Status</div>
            <div className="hidden md:block col-span-1 text-right">Pts</div>
          </div>

          {/* List */}
          {project.tasks?.length > 0 ? (
            <div className="divide-y divide-border">
              {project.tasks.map((task, i) => (
                <div key={task.id} className="grid grid-cols-12 gap-2 md:gap-4 px-3 py-2 md:px-6 md:py-4 items-center hover:bg-accent/5 transition-colors group">
                  <div className="col-span-1 text-muted-foreground font-mono text-xs">{(currentPage - 1) * pageSize + i + 1}</div>
                  <div className="col-span-11 md:col-span-6 font-medium text-xs md:text-sm text-foreground pr-4">
                    <Link href={`/dashboard/tasks/${task.id}`} className="hover:underline decoration-primary/50 underline-offset-4 line-clamp-1 md:line-clamp-2">
                      {task.description}
                    </Link>
                    <div className="md:hidden mt-1 flex gap-2 items-center text-[11px] text-muted-foreground">
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

          {/* Pagination Controls */}
          {project.pagination && project.pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, project.pagination.totalTasks)} of {project.pagination.totalTasks} tasks
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={!project.pagination.hasPrevPage}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  Previous
                </Button>
                <span className="text-sm font-medium px-3">
                  Page {currentPage} of {project.pagination.totalPages}
                </span>
                <Button
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={!project.pagination.hasNextPage}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hold History Section */}
      {project.holdHistory && project.holdHistory.length > 0 && (
        <Card className="border-amber-500/20 shadow-sm bg-amber-500/[0.02] backdrop-blur-sm">
          <CardHeader className="border-b border-amber-500/10 bg-amber-500/5 px-6 py-4 flex flex-row items-center gap-2">
            <History className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg font-medium text-amber-500">Hold History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-amber-500/10">
              {project.holdHistory.map((entry, idx) => (
                <div key={idx} className="p-4 md:p-6 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-amber-600/70 tracking-tight">Pause Started</span>
                        <span className="text-sm font-semibold text-foreground/80">{formatFullDateTimeIST(entry.startDate)}</span>
                      </div>
                      <div className="h-8 w-px bg-amber-500/20" />
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-amber-600/70 tracking-tight">Pause Ended</span>
                        <span className="text-sm font-semibold text-foreground/80">
                          {entry.endDate ? formatFullDateTimeIST(entry.endDate) : <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-400">Still on Hold</Badge>}
                        </span>
                      </div>
                    </div>
                  </div>
                  {entry.reason && (
                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                      <span className="text-[10px] uppercase font-bold text-amber-600/70 tracking-tight block mb-1">Reason for Hold</span>
                      <p className="text-sm text-foreground/70 italic italic leading-relaxed">"{entry.reason}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hold Project Modal */}
      <Dialog open={isHoldModalOpen} onOpenChange={setIsHoldModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Put Project on Hold</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-muted-foreground text-sm">
              Putting a project on hold will track the duration and reason. Only admins can resume the project later.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Reason for Hold *</label>
              <Textarea
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder="Explain why this project is being paused..."
                className="bg-secondary border-border focus:ring-accent min-h-[120px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHoldModalOpen(false)}>Cancel</Button>
            <Button
              disabled={isActionLoading || !holdReason.trim()}
              onClick={handleHoldProject}
              className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
            >
              {isActionLoading ? <Loader className="animate-spin h-4 w-4" /> : <Pause className="h-4 w-4" />}
              Confirm Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function StatCard({ title, value, icon: Icon, className }: any) {
  return (
    <Card className={`shadow-sm ${className}`}>
      <CardContent className="p-2 md:p-4 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">{title}</p>
          <p className="text-base md:text-2xl font-bold mt-0.5 md:mt-1">{value}</p>
        </div>
        {Icon && <Icon className="h-4 w-4 md:h-5 md:w-5 opacity-50 shrink-0" />}
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
    'in_progress': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    'todo': 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    'pending': 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  };
  const style = styles[normalizedStatus as keyof typeof styles] || styles['todo'];

  // Format text to Title Case (e.g. IN_PROGRESS -> In Progress)
  const formatStatus = (str: string) => {
    return str
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${style} whitespace-nowrap`}>
      {formatStatus(status)}
    </span>
  );
}

export default ProjectDetailsPage;