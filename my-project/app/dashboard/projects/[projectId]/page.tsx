'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import Breadcrumbs from '@/components/ui/breadcrumbs';
import axios from '@/lib/axios';
import toast from 'react-hot-toast';
import { Loader, LayoutGrid, StickyNote, Paperclip, ArrowRight, Plus, Pause, Play, History, Link as LinkIcon, ExternalLink, TriangleAlert, RotateCcw, Eye, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { KanbanBoard } from '@/components/projects/KanbanBoard';
import { AddTaskForm } from '@/components/tasks/AddTaskForm';
import { User as UserType } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CalendarDays, CheckCircle2 as CheckCircle2Icon, Circle as CircleIcon, Clock as ClockIcon, Target as TargetIcon, ClipboardCheck as ClipboardCheckIcon, Download } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { jwtDecode } from 'jwt-decode';
import { formatFullDateTimeIST } from '@/lib/utils';
import { NotesList } from '@/components/notes/NotesList';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { AttachmentPreviewDialog, AttachmentThumbnail, formatBytes, PreviewAttachment } from '@/components/projects/AttachmentPreview';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { Note } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGetNotes } from '@/hooks/useNotes';
import TeamMembers, { TeamMember } from '@/components/projects/TeamMembers';

interface Task { id: string; description: string; status: string; points: number; assignedToName: string; createdAt: string; updatedAt: string; }
interface Pagination { totalTasks: number; currentPage: number; pageSize: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean; }
interface Project { id: string; name: string; description: string; startDate: string; tasks: Task[]; status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'; headIds?: string[]; memberIds?: string[]; holdHistory?: { startDate: string; endDate: string | null; reason: string }[]; pagination?: Pagination; }
interface ProjectResource { sourceType: 'note' | 'comment'; sourceId: string; sourceName: string; authorId?: string | null; authorName: string; attachments: { id: string; name: string; url: string; fileType: string; size: number; heading: string | null }[]; links: { id: string; name: string; url: string; heading: string | null }[]; }
interface ResourceDeleteTarget { kind: 'attachment' | 'link'; id: string; name: string; }

// The board + stats need the whole task list; the API paginates at 10 by default.
const TASK_FETCH_LIMIT = 500;

interface FetchError { title: string; message: string; }

const ProjectDetailsPage = () => {
  const params = useParams();
  const { projectId } = params;
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [isHoldLoading, setIsHoldLoading] = useState(false);
  const [isResumeLoading, setIsResumeLoading] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);
  const [resources, setResources] = useState<ProjectResource[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<PreviewAttachment | null>(null);
  const [resourceToDelete, setResourceToDelete] = useState<ResourceDeleteTarget | null>(null);
  const [isDeletingResource, setIsDeletingResource] = useState(false);
  const [isAddingResource, setIsAddingResource] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [taskFormUsers, setTaskFormUsers] = useState<UserType[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try { const payload = jwtDecode(token) as { user: { role: string; uuid?: string; id?: string } }; setUserRole(payload.user.role); setCurrentUserId(payload.user.uuid || payload.user.id || null); } catch { console.error('Invalid token'); }
    }
  }, []);

  const fetchProject = async () => {
    setIsLoading(true);
    try {
      const [projectRes, resourcesRes, teamRes, employeesRes] = await Promise.all([
        axios.get(`/projects/${projectId}`, { params: { page: 1, limit: TASK_FETCH_LIMIT } }),
        axios.get(`/projects/${projectId}/resources`),
        axios.get(`/projects/${projectId}/members`),
        axios.get('/auth/organization')
      ]);
      setProject(projectRes.data); setResources(resourcesRes.data);
      setTeamMembers(teamRes.data); setEmployees(employeesRes.data); setError(null);
    } catch (e: any) {
      const notFound = e?.response?.status === 404;
      setError(notFound
        ? { title: 'Project not found', message: 'It may have been deleted, or you may not have access to it.' }
        : { title: 'Couldn’t load this project', message: 'Something went wrong while loading. Check your connection and try again.' });
    } finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (projectId) fetchProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Silent refresh after an action — keeps the current view and data on failure
  const reloadProject = async () => {
    try {
      const [projectRes, resourcesRes, teamRes, employeesRes] = await Promise.all([
        axios.get(`/projects/${projectId}`, { params: { page: 1, limit: TASK_FETCH_LIMIT } }),
        axios.get(`/projects/${projectId}/resources`),
        axios.get(`/projects/${projectId}/members`),
        axios.get('/auth/organization')
      ]);
      setProject(projectRes.data); setResources(resourcesRes.data);
      setTeamMembers(teamRes.data); setEmployees(employeesRes.data); setError(null);
    } catch { toast.error('Failed to refresh'); }
  };

  const handleExportTasks = async () => {
    const id = toast.loading('Exporting...');
    try {
      const res = await axios.get(`/projects/${projectId}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `${project?.name || 'project'}_tasks.csv`);
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('Exported', { id });
    } catch { toast.error('Export failed', { id }); }
  };

  const handleHoldProject = async () => {
    if (!holdReason.trim()) { toast.error('Reason required'); return; }
    setIsHoldLoading(true);
    try { await axios.put(`/projects/${projectId}/hold`, { reason: holdReason }); toast.success('Project on hold'); setIsHoldModalOpen(false); setHoldReason(''); reloadProject(); }
    catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setIsHoldLoading(false); }
  };

  const handleResumeProject = async () => {
    setIsResumeLoading(true);
    try { await axios.put(`/projects/${projectId}/resume`); toast.success('Project resumed'); reloadProject(); }
    catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setIsResumeLoading(false); }
  };

  // Deleting removes the row from its source note/comment — allowed for the
  // author or an ADMIN (the API enforces the same rule).
  const canDeleteResource = (r: ProjectResource) =>
    userRole === 'ADMIN' || (!!currentUserId && r.authorId === currentUserId);

  const handleDeleteResource = async () => {
    const target = resourceToDelete;
    if (!target) return;
    setIsDeletingResource(true);
    try {
      const segment = target.kind === 'attachment' ? 'attachments' : 'links';
      await axios.delete(`/projects/${projectId}/resources/${segment}/${target.id}`);
      toast.success(target.kind === 'attachment' ? 'Document deleted' : 'Link deleted');
      setResourceToDelete(null);
      setPreviewAttachment(null);
      reloadProject();
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.response?.data?.error || 'Failed to delete resource');
    } finally { setIsDeletingResource(false); }
  };

  // Same params as NotesList so the tab badge and the list share one cache entry
  const { data: projectNotes } = useGetNotes({ type: 'PROJECT', projectId: projectId as string, search: '' });

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Loading project…</p>
    </div>
  );

  if (!project) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-4">
      <div className="h-14 w-14 rounded-full bg-amber-500/10 flex items-center justify-center">
        <TriangleAlert className="h-7 w-7 text-amber-500" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold">{error?.title || 'Project not found'}</h2>
        <p className="text-sm text-muted-foreground max-w-md">{error?.message || 'This project could not be loaded.'}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={fetchProject} className="gap-2 font-bold">
          <RotateCcw className="h-4 w-4" /> Try Again
        </Button>
        <Button variant="outline" asChild className="font-bold">
          <Link href="/dashboard/projects">Back to Projects</Link>
        </Button>
      </div>
    </div>
  );

  const breadcrumbItems = [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Projects', href: '/dashboard/projects' }, { label: project.name }];
  const totalPoints = project.tasks?.reduce((sum, t) => sum + (t.points || 0), 0) || 0;
  const tasks = project.tasks || [];
  const statusCount = (statuses: string[]) => tasks.filter(t => statuses.includes((t.status || '').toLowerCase())).length;

  const handleTaskMove = async (taskId: string, newStatus: string) => {
    // Optimistic UI Update
    setProject(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
      };
    });

    try {
      const { data } = await axios.put(`/tasks/${taskId}/status`, { status: newStatus });
      toast.success('Task moved successfully');
      // Server may override the requested status (e.g. sequential task handoff) — resync when it did
      if (data?.status && data.status.toLowerCase() !== newStatus.toLowerCase()) {
        reloadProject();
      }
    } catch {
      toast.error('Failed to move task');
      reloadProject(); // Revert on failure
    }
  };

  const openAddTask = async () => {
    setIsAddTaskOpen(true);
    if (taskFormUsers.length > 0) return;
    setIsLoadingUsers(true);
    try {
      const res = await axios.get('/auth/organization');
      setTaskFormUsers(res.data);
    } catch { toast.error('Failed to load users'); }
    finally { setIsLoadingUsers(false); }
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto px-4 md:px-5 pt-0 pb-4 md:pb-5">
      <Breadcrumbs items={breadcrumbItems} />

      {/* Header */}
      <div className="pb-4 border-b border-border/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1">
              <StatusBadge status={project.status} />
              <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">Resource Management</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">{project.name}</h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed font-medium">{project.description}</p>
            <div className="flex items-center gap-3 mt-2 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-full"><CalendarDays className="h-3.5 w-3.5" />{new Date(project.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span className="flex items-center gap-2 bg-purple-500/10 text-purple-600 px-3 py-1.5 rounded-full"><TargetIcon className="h-3.5 w-3.5" />{totalPoints} pts total</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userRole === 'ADMIN' && (
              <>{project.status === 'ACTIVE' ? <Button onClick={() => setIsHoldModalOpen(true)} className="gap-2 bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 font-bold"><Pause className="h-4 w-4" />Hold Project</Button> : project.status === 'ON_HOLD' ? <Button onClick={handleResumeProject} disabled={isResumeLoading} className="gap-2 bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 font-bold">{isResumeLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Resume Project</Button> : null}</>
            )}
            <Button onClick={handleExportTasks} variant="outline" className="gap-2 font-bold"><Download className="h-4 w-4" />Export</Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard title="Total Tasks" value={tasks.length} icon={CircleIcon} iconBg="bg-slate-500" />
        <StatCard title="Completed" value={statusCount(['completed', 'done'])} icon={CheckCircle2Icon} iconBg="bg-emerald-500" />
        <StatCard title="In Progress" value={statusCount(['in-progress', 'in_progress'])} icon={ClockIcon} iconBg="bg-blue-500" />
        <StatCard title="In Review" value={statusCount(['pending-review', 'pending_review'])} icon={ClipboardCheckIcon} iconBg="bg-purple-500" />
        <StatCard title="Pending" value={statusCount(['pending', 'todo'])} icon={CircleIcon} iconBg="bg-amber-500" />
      </div>

      {/* Tabs Layout */}
      <Tabs defaultValue="board" className="w-full space-y-3">
        <TabsList className="bg-muted/30 p-1.5 w-full flex flex-col md:flex-row gap-2 h-auto rounded-xl">
          <TabsTrigger value="board" className="flex-1 py-2 gap-2 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all">
            <LayoutGrid className="h-4 w-4" /> Task Board
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1 py-2 gap-2 font-bold data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all">
            <StickyNote className="h-4 w-4" /> Notes
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-white/20 text-current border-none">
              {projectNotes?.length || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex-1 py-2 gap-2 font-bold data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all">
            <Paperclip className="h-4 w-4" /> Resources
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-white/20 text-current border-none">
              {resources.reduce((a, c) => a + c.attachments.length + c.links.length, 0)}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="team" className="flex-1 py-2 gap-2 font-bold data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all">
            <Users className="h-4 w-4" /> Team
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-white/20 text-current border-none">
              {teamMembers.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="m-0 border border-border/60 rounded-2xl shadow-lg bg-card overflow-hidden focus-visible:outline-none">
          <div className="p-3 border-b bg-muted/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <LayoutGrid className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-bold">Task Board</h3>
              <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-mono">
                {project.pagination?.totalTasks || tasks.length}
              </Badge>
            </div>
            <Button size="sm" onClick={openAddTask} className="gap-2 font-bold px-4">
              <Plus className="h-4 w-4" /> Add Task
            </Button>
          </div>
          {project.pagination && project.pagination.totalTasks > tasks.length ? (
            <div className="px-5 py-2 border-b border-amber-500/20 bg-amber-500/10 text-xs font-semibold text-amber-700 dark:text-amber-400">
              Showing {tasks.length} of {project.pagination.totalTasks} tasks on this board.
            </div>
          ) : null}
          <div className="p-5 overflow-x-auto custom-scrollbar">
            <KanbanBoard tasks={tasks} onTaskMove={handleTaskMove} onAddTask={openAddTask} />
          </div>
        </TabsContent>

        <TabsContent value="notes" className="m-0 border border-border/60 rounded-2xl shadow-lg bg-card overflow-hidden focus-visible:outline-none min-h-[600px] flex flex-col">
          <div className="p-5 border-b bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <StickyNote className="h-4 w-4 text-amber-500" />
              </div>
              <h3 className="font-bold text-amber-600 dark:text-amber-500">Notes</h3>
            </div>
            <Button onClick={() => setIsAddingNote(true)} size="sm" className="gap-2 bg-amber-500 hover:bg-amber-600 font-bold border-none shadow-sm px-4">
              <Plus className="h-4 w-4" /> New Note
            </Button>
          </div>
          <div className="p-6 flex-1 bg-card/30">
            <NotesList type="PROJECT" projectId={projectId as string} searchTerm="" onEdit={n => setNoteToEdit(n)} />
          </div>
        </TabsContent>

        <TabsContent value="resources" className="m-0 border border-border/60 rounded-2xl shadow-lg bg-card overflow-hidden focus-visible:outline-none min-h-[600px] flex flex-col">
          <div className="p-5 border-b bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Paperclip className="h-4 w-4 text-indigo-500" />
              </div>
              <h3 className="font-bold text-indigo-600 dark:text-indigo-500">Resources</h3>
            </div>
            <Button onClick={() => setIsAddingResource(true)} size="sm" variant="outline" className="gap-2 font-bold border-dashed px-4 border-indigo-200 hover:bg-indigo-500/10 text-indigo-600">
              <Plus className="h-4 w-4" /> Add Resource
            </Button>
          </div>
          <div className="p-6 flex-1 bg-card/30">
            {resources.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {resources.map((r, i) => (
                  <div key={i} className="group p-4 rounded-xl border border-border/40 bg-background hover:border-indigo-500/30 shadow-sm hover:shadow-md transition-all">
                    <p className="font-bold text-sm mb-4 text-muted-foreground flex items-center gap-2">
                      {r.authorName} <span className="h-1.5 w-1.5 rounded-full bg-indigo-500/50" /> {r.sourceName || 'Shared Resource'}
                    </p>
                    <div className="flex flex-col gap-2">
                      {r.attachments.map(a => (
                        <div key={a.id} className="flex items-center gap-1 p-3 rounded-lg bg-indigo-500/5 text-sm text-indigo-700 hover:bg-indigo-500/10 transition-colors border border-transparent hover:border-indigo-500/20">
                          <button
                            type="button"
                            onClick={() => setPreviewAttachment(a)}
                            aria-label={`Preview ${a.name}`}
                            title={`Preview ${a.name}`}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                          >
                            <AttachmentThumbnail attachment={a} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{a.name}</span>
                              <span className="block truncate text-[11px] text-indigo-500/80">
                                {[a.heading, formatBytes(a.size)].filter(Boolean).join(' · ') || 'Document'}
                              </span>
                            </span>
                            <Eye className="h-4 w-4 shrink-0 text-indigo-500/70" aria-hidden="true" />
                          </button>
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${a.name} in a new tab`}
                            title="Open in new tab"
                            className="p-1.5 rounded-md text-indigo-500/70 hover:text-indigo-700 hover:bg-indigo-500/10 transition-colors shrink-0"
                          >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          </a>
                          {canDeleteResource(r) && (
                            <button
                              type="button"
                              onClick={() => setResourceToDelete({ kind: 'attachment', id: a.id, name: a.name })}
                              aria-label={`Delete ${a.name}`}
                              title="Delete"
                              className="p-1.5 rounded-md text-indigo-500/70 hover:text-red-600 hover:bg-red-500/10 transition-colors shrink-0"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}
                      {r.links.map(l => (
                        <div key={l.id} className="flex items-center gap-1 p-3 rounded-lg bg-blue-500/5 text-sm text-blue-700 hover:bg-blue-500/10 transition-colors border border-transparent hover:border-blue-500/20">
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open ${l.name} in a new tab`}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                          >
                            <div className="h-8 w-8 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                              <LinkIcon className="h-4 w-4" />
                            </div>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{l.name}</span>
                              <span className="block truncate text-[11px] text-blue-500/80">{l.heading || 'Web link'}</span>
                            </span>
                            <ExternalLink className="h-4 w-4 shrink-0 text-blue-500/70" aria-hidden="true" />
                          </a>
                          {canDeleteResource(r) && (
                            <button
                              type="button"
                              onClick={() => setResourceToDelete({ kind: 'link', id: l.id, name: l.name })}
                              aria-label={`Delete ${l.name}`}
                              title="Delete"
                              className="p-1.5 rounded-md text-blue-500/70 hover:text-red-600 hover:bg-red-500/10 transition-colors shrink-0"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-32 text-center flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Paperclip className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <h4 className="text-lg font-bold text-muted-foreground mb-1">No resources yet</h4>
                <p className="text-sm text-muted-foreground max-w-sm">Upload files or add links related to this project to keep everything organized in one place.</p>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="team" className="m-0 border border-border/60 rounded-2xl shadow-lg bg-card overflow-hidden focus-visible:outline-none min-h-[600px]">
          <TeamMembers
            projectId={projectId as string}
            members={teamMembers}
            employees={employees}
            canManage={userRole === 'ADMIN' || (!!currentUserId && (project.headIds || []).includes(currentUserId))}
            onChanged={fetchProject}
          />
        </TabsContent>
      </Tabs>

      {/* Hold History Section */}
      {project.holdHistory?.length ? (
        <Card className="border-amber-500/20 shadow-sm rounded-2xl overflow-hidden mt-8 max-w-4xl">
          <CardHeader className="border-b px-6 py-4 bg-amber-500/5">
            <div className="flex items-center gap-2"><History className="h-4 w-4 text-amber-500" /><CardTitle className="text-sm font-bold text-amber-700">Hold History</CardTitle></div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-amber-500/10">
              {project.holdHistory.map((e, i) => (
                <div key={i} className="px-6 py-4 flex flex-col gap-1">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground/80">{formatFullDateTimeIST(e.startDate)}</span>
                    <ArrowRight className="h-4 w-4" />
                    <span className="font-semibold text-foreground/80">{e.endDate ? formatFullDateTimeIST(e.endDate) : <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 h-5 px-2 text-[10px]">Currently Active</Badge>}</span>
                  </div>
                  {e.reason && <p className="text-sm text-muted-foreground/80 italic mt-1 border-l-2 border-amber-500/30 pl-3 py-1">&quot;{e.reason}&quot;</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Persistence Modals */}
      <Dialog open={isAddingNote || !!noteToEdit} onOpenChange={(open) => { if (!open) { setIsAddingNote(false); setNoteToEdit(null); } }}>
        <DialogContent className="sm:max-w-2xl bg-card border-border p-0 overflow-hidden shadow-2xl">
          <NoteEditor 
            noteToEdit={noteToEdit} 
            onClose={() => { setIsAddingNote(false); setNoteToEdit(null); reloadProject(); }} 
            defaultType="PROJECT" 
            defaultProjectId={projectId as string} 
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isHoldModalOpen} onOpenChange={setIsHoldModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl rounded-2xl">
          <DialogHeader><DialogTitle className="text-xl font-extrabold tracking-tight">Hold Project</DialogTitle></DialogHeader>
          <div className="py-6 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">Provide context for why this project is being put on hold. This reason will be visible in the hold history.</p>
            <Textarea 
                value={holdReason} 
                onChange={e => setHoldReason(e.target.value)} 
                placeholder="Operational delay, resource crunch, client request..." 
                className="min-h-[120px] bg-muted/20 border-border/50 focus:border-amber-500/50 transition-colors resize-none rounded-xl" 
            />
          </div>
          <DialogFooter className="gap-3">
            <Button variant="ghost" onClick={() => setIsHoldModalOpen(false)} className="font-bold">Cancel</Button>
            <Button disabled={isHoldLoading || !holdReason.trim()} onClick={handleHoldProject} className="bg-amber-500 hover:bg-amber-600 gap-2 font-bold px-6 shadow-lg shadow-amber-500/20">
                {isHoldLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />} Hold Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddingResource} onOpenChange={setIsAddingResource}>
        <DialogContent className="sm:max-w-xl bg-card border-border p-0 overflow-hidden shadow-2xl">
          <NoteEditor
            onClose={() => { setIsAddingResource(false); reloadProject(); }}
            defaultType="PROJECT"
            defaultTitle="Added Project Resource"
            defaultProjectId={projectId as string}
          />
        </DialogContent>
      </Dialog>

      <AttachmentPreviewDialog
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        isDeleting={isDeletingResource}
        onDelete={previewAttachment?.id
          ? () => setResourceToDelete({ kind: 'attachment', id: previewAttachment.id as string, name: previewAttachment.name })
          : undefined}
      />

      <ConfirmationModal
        isOpen={!!resourceToDelete}
        onClose={() => setResourceToDelete(null)}
        onConfirm={handleDeleteResource}
        title="Delete resource?"
        description={
          <span>
            <span className="font-semibold text-foreground">“{resourceToDelete?.name}”</span> will be permanently
            removed from its source note or comment. This can&apos;t be undone.
          </span>
        }
        confirmText="Delete"
        cancelText="Cancel"
      />

      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border p-8 shadow-2xl">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-2xl font-bold text-foreground tracking-tight">Add New Task</DialogTitle>
            <DialogDescription>Create a task and add it to {project.name}.</DialogDescription>
          </DialogHeader>

          {isLoadingUsers ? (
            <div className="flex flex-col items-center justify-center gap-3 p-12">
              <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading team members…</p>
            </div>
          ) : (
            <AddTaskForm
              users={taskFormUsers}
              projects={[{ id: projectId as string, name: project.name, organizationId: '' }]}
              onTaskAdded={() => { setIsAddTaskOpen(false); reloadProject(); }}
              onClose={() => setIsAddTaskOpen(false)}
              currentUserId={currentUserId}
              initialData={{ projectId: projectId as string }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface StatCardProps { title: string; value: string | number; icon?: React.ElementType; iconBg?: string; }
function StatCard({ title, value, icon: Icon, iconBg }: StatCardProps) {
  return (
    <Card className="border-border/60 shadow-md shadow-slate-200/50 dark:shadow-none rounded-2xl bg-card/80 backdrop-blur-sm">
      <CardContent className="p-3 flex items-center justify-between">
        <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-xl font-bold tracking-tight">{value}</p>
        </div>
        {Icon && <div className={`h-9 w-9 rounded-xl ${iconBg || 'bg-primary/10'} flex items-center justify-center shadow-inner`}><Icon className="h-5 w-5 text-white" aria-hidden="true" /></div>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const styles: Record<string, string> = { 
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400', 
    done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400', 
    'in-progress': 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', 
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', 
    todo: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400', 
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    'pending-review': 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    on_hold: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
  };
  const style = styles[s] || styles.todo;
  const format = (str: string) => str.toLowerCase().split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md ${style}`}>{format(status)}</span>;
}

export default ProjectDetailsPage;
