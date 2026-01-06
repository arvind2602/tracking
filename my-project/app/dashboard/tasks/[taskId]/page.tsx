"use client";
import { Task, User, Project, Comment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import axios from "@/lib/axios";
import toast from "react-hot-toast";
import { useParams, useRouter } from 'next/navigation';
import Breadcrumbs from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  User as UserIcon,
  Briefcase,
  Target,
  Calendar,
  Clock,
  MessageSquare,
  AlignLeft,
  ChevronsRight,
  Send,
  Flag
} from "lucide-react";

export default function TaskDetailPage() {
  const { taskId } = useParams();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const taskResponse = await axios.get(`/tasks/${taskId}`);
        setTask(taskResponse.data);

        const usersResponse = await axios.get('/auth/organization');
        setUsers(usersResponse.data);
        const projectsResponse = await axios.get('/projects');
        setProjects(projectsResponse.data);

        const commentsResponse = await axios.get(`/tasks/comments/${taskId}`);
        setComments(commentsResponse.data);
      } catch (err) {
        console.error("Error fetching task details:", err);
        setError("Failed to load task details.");
        toast.error("Failed to load task details.");
      } finally {
        setLoading(false);
      }
    };

    if (taskId) {
      fetchData();
    }
  }, [taskId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setIsSubmittingComment(true);
    try {
      const response = await axios.post(`/tasks/comments/${taskId}`, { content: newComment });
      setComments((prev) => [...prev, response.data]);
      setNewComment("");
      toast.success("Comment added");
    } catch (err) {
      console.error("Error adding comment:", err);
      toast.error("Failed to add comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-destructive font-semibold">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (!task) {
    return <div className="p-8 text-center text-muted-foreground">Task not found.</div>;
  }

  const assignedUser = users.find((user) => user.id === task.assignedTo);
  const project = projects.find((p) => p.id === task.projectId);


  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Tasks', href: '/dashboard/tasks' },
    { label: task.title, href: `/dashboard/tasks/${taskId}` },
  ];

  const statusColors: any = {
    'TODO': 'bg-slate-500',
    'IN_PROGRESS': 'bg-blue-500',
    'DONE': 'bg-green-500',
    'BACKLOG': 'bg-orange-500'
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl font-sans space-y-8">
      <div>
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      {/* Header Section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight">{task.title}</h1>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Created {new Date(task.createdAt).toLocaleDateString()}</span>
              {task.parentId && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    Subtask of <a href={`/dashboard/tasks/${task.parentId}`} className="text-primary hover:underline font-medium">Parent Task</a>
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Badge variant="outline" className={`${statusColors[task.status] || 'bg-primary'} text-white border-0 px-4 py-1.5 text-sm whitespace-nowrap shadow-sm`}>
              {task.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        {/* Properties Info Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-card/50 backdrop-blur-sm border border-accent/20 rounded-xl shadow-sm">
          {/* Assigned To */}
          <div className="space-y-1.5 p-2 rounded-lg hover:bg-accent/5 transition-colors">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <UserIcon className="w-3.5 h-3.5" /> Assigned To
            </span>
            <div
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => assignedUser && router.push(`/dashboard/users/${assignedUser.id}/tasks`)}
            >
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold ring-2 ring-background">
                {assignedUser ? getInitials(assignedUser.firstName + ' ' + assignedUser.lastName) : '?'}
              </div>
              <span className="text-sm font-semibold truncate">
                {assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : "Unassigned"}
              </span>
            </div>
          </div>

          {/* Project */}
          <div className="space-y-1.5 p-2 rounded-lg hover:bg-accent/5 transition-colors">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Briefcase className="w-3.5 h-3.5" /> Project
            </span>
            <div className="font-semibold text-sm truncate" title={project?.name}>
              {project?.name || 'Unknown'}
            </div>
          </div>

          {/* Priority & Points */}
          <div className="space-y-1.5 p-2 rounded-lg hover:bg-accent/5 transition-colors">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Flag className="w-3.5 h-3.5" /> Priority & Pts
            </span>
            <div className="flex items-center gap-3 text-sm font-semibold">
              <span className="badge badge-outline text-xs">{task.priority || 'Normal'}</span>
              <span className="flex items-center gap-1 text-muted-foreground text-xs">|</span>
              <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5 text-primary" /> {task.points}</span>
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-1.5 p-2 rounded-lg hover:bg-accent/5 transition-colors">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5" /> Due Date
            </span>
            <div className="text-sm font-semibold">
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Due Date'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Description */}
          <Card className="bg-card/50 backdrop-blur-sm border-accent/20 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-lg flex items-center gap-2">
                Description
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="prose dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {task.description}
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card className="bg-card/50 backdrop-blur-sm border-accent/20 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-lg flex items-center gap-2">
                Comments
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-normal">{comments.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <ScrollArea className="h-[400px] pr-4">
                {comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm italic border-2 border-dashed rounded-lg bg-accent/5">
                    No comments yet. Be the first to share your thoughts.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-4 group">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0 ring-2 ring-background shadow-sm">
                          {getInitials(comment.userName || 'U')}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm">{comment.userName}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{new Date(comment.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                          <div className="text-sm bg-muted/30 p-3 rounded-2xl rounded-tl-none text-foreground/90 leading-relaxed border border-border/50 hover:bg-muted/40 transition-colors">
                            {comment.content}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="flex items-start gap-3 mt-6 pt-6 border-t border-border/50">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[100px] resize-none bg-background/50 focus:bg-background transition-colors"
                />
                <Button
                  onClick={handleAddComment}
                  disabled={isSubmittingComment || !newComment.trim()}
                  size="icon"
                  className="h-10 w-10 shrink-0 shadow-sm"
                >
                  {isSubmittingComment ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Subtasks */}
          {task.subtasks && task.subtasks.length > 0 && (
            <Card className="bg-card/50 backdrop-blur-sm border-accent/20 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  Subtasks ({task.subtasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {task.subtasks.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-2 rounded hover:bg-accent/5">
                    <Link href={`/dashboard/tasks/${sub.id}`} className="font-medium text-primary hover:underline">
                      {sub.title || (typeof sub.description === 'string' ? sub.description.slice(0, 30) : '')}
                    </Link>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="capitalize">{sub.status}</span>
                      <span className="text-muted-foreground">{sub.points} pts</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ScrollArea({ className, children }: { className?: string, children: React.ReactNode }) {
  return <div className={`overflow-y-auto ${className}`}>{children}</div>;
}
