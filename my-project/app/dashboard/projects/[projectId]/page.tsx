'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import Breadcrumbs from '@/components/ui/breadcrumbs';
import axios from '@/lib/axios';
import toast from 'react-hot-toast';
import { Loader, FileText, Paperclip, User, Target, ArrowRight, Plus, Pause, Play, History, Link as LinkIcon } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGetNotes } from '@/hooks/useNotes';

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
  const [isAddingResource, setIsAddingResource] = useState(false);

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

  const { data: projectNotes } = useGetNotes({ type: 'PROJECT', projectId: projectId as string });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!project) return <div className="p-8 text-center text-muted-foreground">Project not found</div>;

  const breadcrumbItems = [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Projects', href: '/dashboard/projects' }, { label: project.name }];
  const totalPoints = project.tasks?.reduce((sum, t) => sum + (t.points || 0), 0) || 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6">
      <Breadcrumbs items={breadcrumbItems} />

      {/* Header */}
      <div className="pb-6 border-b border-border/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge status={project.status} />
              <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground/40">Resource Management</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">{project.name}</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl line-clamp-2 leading-relaxed font-medium">{project.description}</p>
            <div className="flex items-center gap-5 mt-4 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-full"><CalendarDays className="h-3.5 w-3.5" />{new Date(project.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span className="flex items-center gap-2 bg-purple-500/10 text-purple-600 px-3 py-1.5 rounded-full"><TargetIcon className="h-3.5 w-3.5" />{totalPoints} pts total</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userRole === 'ADMIN' && (
              <>{project.status === 'ACTIVE' ? <Button onClick={() => setIsHoldModalOpen(true)} className="gap-2 bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 font-bold"><Pause className="h-4 w-4" />Hold Project</Button> : project.status === 'ON_HOLD' ? <Button onClick={handleResumeProject} disabled={isActionLoading} className="gap-2 bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 font-bold">{isActionLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Resume Project</Button> : null}</>
            )}
            <Button onClick={handleExportTasks} variant="outline" className="gap-2 font-bold"><Download className="h-4 w-4" />Export</Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Tasks" value={project.tasks?.length || 0} icon={CircleIcon} iconBg="bg-slate-500" />
        <StatCard title="Completed" value={project.tasks?.filter(t => t.status === 'completed' || t.status === 'DONE').length || 0} icon={CheckCircle2Icon} iconBg="bg-emerald-500" />
        <StatCard title="In Progress" value={project.tasks?.filter(t => t.status === 'in-progress' || t.status === 'IN_PROGRESS').length || 0} icon={ClockIcon} iconBg="bg-blue-500" />
        <StatCard title="Pending" value={project.tasks?.filter(t => t.status === 'pending' || t.status === 'TODO').length || 0} icon={CircleIcon} iconBg="bg-amber-500" />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Content Area (8 Columns) */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-border/60 shadow-lg shadow-slate-200/50 dark:shadow-none overflow-hidden rounded-2xl">
            <CardHeader className="border-b px-6 py-5 bg-muted/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-base font-bold">Project Tasks</CardTitle>
                  <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-mono">{project.pagination?.totalTasks || project.tasks?.length || 0}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b">
                <div className="col-span-1">No.</div>
                <div className="col-span-11 md:col-span-5">Task Description</div>
                <div className="hidden md:block col-span-3">Assignee</div>
                <div className="col-span-1 border-l pl-2 md:col-span-2 md:border-none">Status</div>
                <div className="hidden md:block col-span-1 text-right">Pts</div>
              </div>
              {project.tasks?.length ? (
                <div className="divide-y divide-border/30">
                  {project.tasks.map((task, i) => (
                    <Link key={task.id} href={`/dashboard/tasks/${task.id}`} className="grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-primary/5 transition-all group">
                      <div className="col-span-1 text-muted-foreground/40 font-mono text-xs">{((currentPage - 1) * pageSize) + i + 1}</div>
                      <div className="col-span-11 md:col-span-5 text-sm font-semibold group-hover:text-primary transition-colors truncate">{task.description}</div>
                      <div className="hidden md:block col-span-3 text-sm text-muted-foreground truncate">{task.assignedToName || 'Unassigned'}</div>
                      <div className="col-span-1 md:col-span-2"><StatusBadge status={task.status} /></div>
                      <div className="hidden md:block col-span-1 text-right"><span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">{task.points}</span></div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-16 text-center text-sm text-muted-foreground">No tasks in this project</div>
              )}
            </CardContent>
          </Card>

          {project.holdHistory?.length ? (
            <Card className="border-amber-500/20 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b px-6 py-4 bg-amber-500/5">
                <div className="flex items-center gap-2"><History className="h-4 w-4 text-amber-500" /><CardTitle className="text-sm font-bold text-amber-700">Hold History</CardTitle></div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-amber-500/10">
                  {project.holdHistory.map((e, i) => (
                    <div key={i} className="px-6 py-4 flex flex-col gap-1">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground/80">{formatFullDateTimeIST(e.startDate)}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="font-semibold text-foreground/80">{e.endDate ? formatFullDateTimeIST(e.endDate) : <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 h-4 px-1 text-[9px]">Currently Active</Badge>}</span>
                      </div>
                      {e.reason && <p className="text-xs text-muted-foreground/70 italic">&quot;{e.reason}&quot;</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Sidebar Space (4 Columns) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-border/60 shadow-xl overflow-hidden flex flex-col max-h-[calc(100vh-140px)] sticky top-6 rounded-2xl">
            <Tabs defaultValue="notes" className="flex flex-col h-full">
              <CardHeader className="p-0 border-b">
                <TabsList className="w-full h-14 bg-muted/10 gap-0 p-0 rounded-none border-none">
                  <TabsTrigger 
                    value="notes" 
                    className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-background transition-all gap-2 font-bold text-xs"
                  >
                    <FileText className="h-4 w-4" />
                    Notes
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-amber-500/10 text-amber-600 border-none">
                      {projectNotes?.length || 0}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="resources" 
                    className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-background transition-all gap-2 font-bold text-xs"
                  >
                    <Paperclip className="h-4 w-4" />
                    Resources
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-indigo-500/10 text-indigo-600 border-none">
                      {resources.reduce((a, c) => a + c.attachments.length + c.links.length, 0)}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <div className="flex-1 overflow-y-auto custom-scrollbar bg-card/30">
                <TabsContent value="notes" className="m-0 p-0 outline-none">
                  <div className="p-4 border-b bg-muted/20 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Project Journal</h3>
                    <Button onClick={() => setIsAddingNote(true)} size="sm" className="h-7 gap-1 px-2 text-[10px] bg-amber-500 hover:bg-amber-600 font-bold border-none shadow-sm">
                      <Plus className="h-3 w-3" /> New Note
                    </Button>
                  </div>
                  <div className="p-4">
                    <NotesList 
                      type="PROJECT" 
                      projectId={projectId as string} 
                      searchTerm="" 
                      onEdit={n => setNoteToEdit(n)} 
                    />
                  </div>
                </TabsContent>

                <TabsContent value="resources" className="m-0 p-0 outline-none">
                  <div className="p-4 border-b bg-muted/20 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Assets & Links</h3>
                    <Button onClick={() => setIsAddingResource(true)} size="sm" variant="outline" className="h-7 gap-1 px-2 text-[10px] font-bold border-dashed">
                      <Plus className="h-3 w-3" /> Add Link
                    </Button>
                  </div>
                  <div className="p-4">
                    {resources.length ? (
                      <div className="space-y-4">
                        {resources.map((r, i) => (
                          <div key={i} className="group p-3 rounded-xl border border-border/40 bg-background/50 hover:border-indigo-500/30 transition-all">
                            <p className="font-bold text-xs mb-3 text-muted-foreground flex items-center gap-2">
                              {r.authorName} <span className="h-1 w-1 rounded-full bg-muted-foreground/30" /> {r.sourceName || 'Shared Resource'}
                            </p>
                            <div className="flex flex-col gap-2">
                              {r.attachments.map(a => (
                                <a key={a.id} href={a.url} target="_blank" className="flex items-center gap-3 p-2 rounded-lg bg-indigo-500/5 text-xs text-indigo-700 hover:bg-indigo-500/10 transition-colors border border-transparent hover:border-indigo-500/20">
                                  <div className="h-6 w-6 rounded bg-indigo-500/10 flex items-center justify-center shrink-0">
                                    <Paperclip className="h-3 w-3" />
                                  </div>
                                  <span className="truncate font-medium">{a.name}</span>
                                </a>
                              ))}
                              {r.links.map(l => (
                                <a key={l.id} href={l.url} target="_blank" className="flex items-center gap-3 p-2 rounded-lg bg-blue-500/5 text-xs text-blue-700 hover:bg-blue-500/10 transition-colors border border-transparent hover:border-blue-500/20">
                                  <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
                                    <LinkIcon className="h-3 w-3" />
                                  </div>
                                  <span className="truncate font-medium">{l.name}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-20 text-center">
                        <Paperclip className="h-12 w-12 text-muted-foreground/10 mx-auto mb-4" />
                        <p className="text-sm font-medium text-muted-foreground/40">No collections found</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </Card>
        </div>
      </div>

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
          <DialogHeader><DialogTitle className="text-xl font-extrabold tracking-tight">Pause Project</DialogTitle></DialogHeader>
          <div className="py-6 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">Provide context for why this project is being put on hold. This will be visible in the history.</p>
            <Textarea 
                value={holdReason} 
                onChange={e => setHoldReason(e.target.value)} 
                placeholder="Operational delay, resource crunch, client request..." 
                className="min-h-[120px] bg-muted/20 border-border/50 focus:border-amber-500/50 transition-colors resize-none rounded-xl" 
            />
          </div>
          <DialogFooter className="gap-3">
            <Button variant="ghost" onClick={() => setIsHoldModalOpen(false)} className="font-bold">Discard</Button>
            <Button disabled={isActionLoading || !holdReason.trim()} onClick={handleHoldProject} className="bg-amber-500 hover:bg-amber-600 gap-2 font-bold px-6 shadow-lg shadow-amber-500/20">
                {isActionLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />} Confirm Pause
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
    </div>
  );
};

interface StatCardProps { title: string; value: string | number; icon?: React.ElementType; iconBg?: string; }
function StatCard({ title, value, icon: Icon, iconBg }: StatCardProps) {
  return (
    <Card className="border-border/60 shadow-md shadow-slate-200/50 dark:shadow-none rounded-2xl transition-all hover:scale-[1.02] cursor-default bg-card/80 backdrop-blur-sm">
      <CardContent className="p-5 flex items-center justify-between">
        <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
        </div>
        {Icon && <div className={`h-12 w-12 rounded-2xl ${iconBg || 'bg-primary/10'} flex items-center justify-center shadow-inner`}><Icon className="h-6 w-6 text-white" /></div>}
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
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' 
  };
  const style = styles[s] || styles.todo;
  const format = (str: string) => str.toLowerCase().split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md ${style}`}>{format(status)}</span>;
}

export default ProjectDetailsPage;
