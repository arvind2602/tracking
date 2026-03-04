'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import Breadcrumbs from '@/components/ui/breadcrumbs';
import axios from '@/lib/axios';
import toast from 'react-hot-toast';
import { Loader, FileText, Paperclip, User, Target, ArrowRight, Plus, Pause, Play, History } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CalendarDays, CheckCircle2 as CheckCircle2Icon, Circle as CircleIcon, Clock as ClockIcon, Target as TargetIcon, Download } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { jwtDecode } from 'jwt-decode';
import { formatFullDateTimeIST } from '@/lib/utils';
import { NotesList } from '@/components/notes/NotesList';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { Note } from '@/lib/types';

interface Task { id: string; description: string; status: string; points: number; assignedToName: string; createdAt: string; updatedAt: string; }
interface Pagination { totalTasks: number; currentPage: number; pageSize: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean; }
interface Project { id: string; name: string; description: string; startDate: string; tasks: Task[]; status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'; holdHistory?: { startDate: string; endDate: string | null; reason: string }[]; pagination?: Pagination; }
interface ProjectResource { sourceType: 'note' | 'comment'; sourceId: string; sourceName: string; authorName: string; attachments: { id: string; name: string; url: string; fileType: string; size: number; heading: string | null }[]; links: { id: string; name: string; url: string; heading: string | null }[]; }

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
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);
  const [resources, setResources] = useState<ProjectResource[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try { const payload = jwtDecode(token) as { user: { role: string } }; setUserRole(payload.user.role); } catch { console.error('Invalid token'); }
    }
  }, []);

  useEffect(() => {
    const fetchProject = async () => {
      setIsLoading(true);
      try {
        const [projectRes, resourcesRes] = await Promise.all([
          axios.get(`/projects/${projectId}`, { params: { page: currentPage, limit: pageSize } }),
          axios.get(`/projects/${projectId}/resources`)
        ]);
        setProject(projectRes.data); setResources(resourcesRes.data);
      } catch { toast.error('Failed to fetch project'); } finally { setIsLoading(false); }
    };
    if (projectId) fetchProject();
  }, [projectId, currentPage, pageSize]);

  const reloadProject = async () => {
    try {
      const [projectRes, resourcesRes] = await Promise.all([
        axios.get(`/projects/${projectId}`, { params: { page: currentPage, limit: pageSize } }),
        axios.get(`/projects/${projectId}/resources`)
      ]);
      setProject(projectRes.data); setResources(resourcesRes.data);
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
    setIsActionLoading(true);
    try { await axios.put(`/projects/${projectId}/hold`, { reason: holdReason }); toast.success('Project on hold'); setIsHoldModalOpen(false); setHoldReason(''); reloadProject(); }
    catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setIsActionLoading(false); }
  };

  const handleResumeProject = async () => {
    setIsActionLoading(true);
    try { await axios.put(`/projects/${projectId}/resume`); toast.success('Resumed'); reloadProject(); }
    catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setIsActionLoading(false); }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!project) return <div className="p-8 text-center text-muted-foreground">Project not found</div>;

  const breadcrumbItems = [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Projects', href: '/dashboard/projects' }, { label: project.name }];
  const totalPoints = project.tasks?.reduce((sum, t) => sum + (t.points || 0), 0) || 0;

  return (
    <div className="space-y-6 font-sans">
      <Breadcrumbs items={breadcrumbItems} />

      {/* Header */}
      <div className="pb-4 border-b border-border/60">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge status={project.status} />
              <span className="text-xs uppercase tracking-widest text-muted-foreground/60">Project</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold truncate">{project.name}</h1>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{new Date(project.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span className="flex items-center gap-2"><TargetIcon className="h-4 w-4 text-purple-500" />{totalPoints} pts</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {userRole === 'ADMIN' && (
              <>{project.status === 'ACTIVE' ? <Button onClick={() => setIsHoldModalOpen(true)} className="gap-2 bg-amber-500 hover:bg-amber-600"><Pause className="h-4 w-4" />Hold Project</Button> : project.status === 'ON_HOLD' ? <Button onClick={handleResumeProject} disabled={isActionLoading} className="gap-2 bg-emerald-500 hover:bg-emerald-600">{isActionLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Resume Project</Button> : null}</>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Tasks" value={project.tasks?.length || 0} icon={CircleIcon} iconBg="bg-slate-500" />
        <StatCard title="Completed" value={project.tasks?.filter(t => t.status === 'completed' || t.status === 'DONE').length || 0} icon={CheckCircle2Icon} iconBg="bg-emerald-500" />
        <StatCard title="In Progress" value={project.tasks?.filter(t => t.status === 'in-progress' || t.status === 'IN_PROGRESS').length || 0} icon={ClockIcon} iconBg="bg-blue-500" />
        <StatCard title="Pending" value={project.tasks?.filter(t => t.status === 'pending' || t.status === 'TODO').length || 0} icon={CircleIcon} iconBg="bg-amber-500" />
      </div>

      {/* Two Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold">Tasks</CardTitle>
                  <Badge variant="secondary" className="text-xs">{project.pagination?.totalTasks || project.tasks?.length || 0}</Badge>
                </div>
                <Button onClick={handleExportTasks} variant="outline" className="gap-2"><Download className="h-4 w-4" />Export Tasks</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase border-b">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Task</div>
                <div className="hidden md:block col-span-3">Assigned</div>
                <div className="col-span-3 md:col-span-2">Status</div>
                <div className="col-span-3 md:col-span-1 text-right">Pts</div>
              </div>
              {project.tasks?.length ? (
                <div className="divide-y divide-border/30">
                  {project.tasks.map((task, i) => (
                    <Link key={task.id} href={`/dashboard/tasks/${task.id}`} className="grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-muted/20 transition-colors">
                      <div className="col-span-1 text-muted-foreground/60 font-mono text-sm">{(currentPage - 1) * pageSize + i + 1}</div>
                      <div className="col-span-5 text-sm font-medium truncate">{task.description}</div>
                      <div className="hidden md:block col-span-3 text-sm text-muted-foreground truncate">{task.assignedToName || '-'}</div>
                      <div className="col-span-3 md:col-span-2"><StatusBadge status={task.status} /></div>
                      <div className="col-span-3 md:col-span-1 text-right"><span className="text-sm font-medium text-primary bg-primary/5 px-2 py-1 rounded">{task.points}</span></div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">No tasks</div>
              )}
              {project.pagination && project.pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, project.pagination.totalTasks)} of {project.pagination.totalTasks}</span>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={!project.pagination.hasPrevPage} variant="outline" size="sm" className="gap-1">Prev</Button>
                    <span className="text-sm font-medium px-3">{currentPage}/{project.pagination.totalPages}</span>
                    <Button onClick={() => setCurrentPage(p => p + 1)} disabled={!project.pagination.hasNextPage} variant="outline" size="sm" className="gap-1">Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {project.holdHistory?.length ? (
            <Card className="border-amber-500/30 shadow-sm">
              <CardHeader className="border-b px-6 py-4 bg-amber-500/10">
                <div className="flex items-center gap-2"><History className="h-5 w-5 text-amber-500" /><CardTitle className="text-base font-semibold text-amber-600">Hold History</CardTitle></div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-amber-500/20">
                  {project.holdHistory.map((e, i) => (
                    <div key={i} className="px-6 py-4">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="font-medium">{formatFullDateTimeIST(e.startDate)}</span>
                        <span>→</span>
                        <span className="font-medium">{e.endDate ? formatFullDateTimeIST(e.endDate) : 'On Hold'}</span>
                      </div>
                      {e.reason && <p className="text-sm text-muted-foreground/70 mt-2 italic">&quot;{e.reason}&quot;</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="border-b px-5 py-4">
              <div className="flex items-center gap-2"><Paperclip className="h-5 w-5 text-indigo-500" /><CardTitle className="text-base font-semibold">Resources</CardTitle><Badge variant="secondary" className="text-xs">{resources.reduce((a, c) => a + c.attachments.length + c.links.length, 0)}</Badge></div>
            </CardHeader>
            <CardContent className="p-5">
              {resources.length ? (
                <div className="space-y-4">
                  {resources.slice(0, 4).map((r, i) => (
                    <div key={i} className="text-sm">
                      <p className="font-medium truncate">{r.sourceName || 'Resource'}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {r.attachments.slice(0, 3).map(a => <a key={a.id} href={a.url} target="_blank" className="text-xs text-primary hover:underline truncate max-[100px]">{a.name}</a>)}
                        {r.links.slice(0, 3).map(l => <a key={l.id} href={l.url} target="_blank" className="text-xs text-primary hover:underline truncate max-[100px]">{l.name}</a>)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-4">No resources</p>}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="border-b px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-amber-500" /><CardTitle className="text-base font-semibold">Notes</CardTitle></div>
                <Button onClick={() => setIsAddingNote(true)} className="gap-2"><Plus className="h-4 w-4" />Add Note</Button>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {isAddingNote || noteToEdit ? <NoteEditor noteToEdit={noteToEdit} onClose={() => { setIsAddingNote(false); setNoteToEdit(null); }} defaultType="PROJECT" /> : <NotesList type="PROJECT" projectId={projectId as string} searchTerm="" onEdit={n => setNoteToEdit(n)} />}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal */}
      <Dialog open={isHoldModalOpen} onOpenChange={setIsHoldModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="text-lg font-bold">Put Project on Hold</DialogTitle></DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">Enter a reason for pausing this project.</p>
            <Textarea value={holdReason} onChange={e => setHoldReason(e.target.value)} placeholder="Reason for hold..." className="min-h-[100px]" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsHoldModalOpen(false)}>Cancel</Button>
            <Button disabled={isActionLoading || !holdReason.trim()} onClick={handleHoldProject} className="bg-amber-500 gap-2">{isActionLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface StatCardProps { title: string; value: string | number; icon?: React.ElementType; iconBg?: string; }
function StatCard({ title, value, icon: Icon, iconBg }: StatCardProps) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-4 flex items-center justify-between">
        <div><p className="text-xs font-medium text-muted-foreground uppercase">{title}</p><p className="text-2xl font-bold">{value}</p></div>
        {Icon && <div className={`h-10 w-10 rounded-lg ${iconBg || 'bg-primary/10'} flex items-center justify-center`}><Icon className="h-5 w-5 text-white" /></div>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const styles: Record<string, string> = { completed: 'bg-green-100 text-green-700', done: 'bg-green-100 text-green-700', 'in-progress': 'bg-blue-100 text-blue-700', in_progress: 'bg-blue-100 text-blue-700', todo: 'bg-slate-100 text-slate-600', pending: 'bg-slate-100 text-slate-600' };
  const style = styles[s] || styles.todo;
  const format = (str: string) => str.toLowerCase().split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${style}`}>{format(status)}</span>;
}

export default ProjectDetailsPage;
