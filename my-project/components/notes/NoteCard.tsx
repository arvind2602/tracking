import { Note } from '@/lib/types';
import { Pin, Paperclip, Trash2, Edit2, Clock, MoreHorizontal, Link as LinkIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useDeleteNote, useUnpinNote } from '@/hooks/useNotes';
import { LayoutList, Plus, X } from 'lucide-react';
import { AddTaskForm } from '../tasks/AddTaskForm';
import { Project, User } from '@/lib/types';
import axios from '@/lib/axios';
import toast from 'react-hot-toast';
import { jwtDecode } from 'jwt-decode';
import { useEffect, useState, useMemo } from 'react';

interface Props {
    note: Note;
    onEdit: (note: Note) => void;
    onPin: (noteId: string) => void;
}

interface UserPayload {
    user: {
        uuid?: string;
        role: string;
    };
}

const typeColors = {
    PERSONAL: {
        bg: 'bg-emerald-500/5',
        border: 'border-emerald-500/10',
        accent: 'bg-emerald-500',
        badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        icon: 'text-emerald-500',
        muted: 'text-emerald-500/60'
    },
    ORGANIZATIONAL: {
        bg: 'bg-amber-500/5',
        border: 'border-amber-500/10',
        accent: 'bg-amber-500',
        badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        icon: 'text-amber-500',
        muted: 'text-amber-500/60'
    },
    PROJECT: {
        bg: 'bg-indigo-500/5',
        border: 'border-indigo-500/10',
        accent: 'bg-indigo-500',
        badge: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
        icon: 'text-indigo-500',
        muted: 'text-indigo-500/60'
    },
    TODO: {
        bg: 'bg-rose-500/5',
        border: 'border-rose-500/10',
        accent: 'bg-rose-500',
        badge: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
        icon: 'text-rose-500',
        muted: 'text-rose-500/60'
    },
};

export function NoteCard({ note, onEdit, onPin }: Props) {
    const deleteNote = useDeleteNote();
    const unpinNote = useUnpinNote();
    const [token, setToken] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);

    const handleConvertClick = async () => {
        setIsConvertModalOpen(true);
        if (users.length === 0 || projects.length === 0) {
            setIsLoadingData(true);
            try {
                const [usersRes, projectsRes] = await Promise.all([
                    axios.get('/auth/organization'),
                    axios.get('/projects')
                ]);
                setUsers(usersRes.data);
                setProjects(projectsRes.data);
            } catch (error) {
                console.error("Failed to fetch conversion data", error);
                toast.error("Failed to load users and projects");
            } finally {
                setIsLoadingData(false);
            }
        }
    };

    useEffect(() => {
        setToken(localStorage.getItem('token'));
    }, []);

    const { userId, isAdmin } = useMemo(() => {
        if (!token) return { userId: null, isAdmin: false };
        try {
            const decoded = jwtDecode<UserPayload>(token);
            return {
                userId: decoded.user?.uuid || null,
                isAdmin: decoded.user?.role === 'ADMIN'
            };
        } catch (e) {
            console.error("Failed to decode token", e);
            return { userId: null, isAdmin: false };
        }
    }, [token]);

    const isOwner = userId === note.authorId;
    const canModify = isOwner || isAdmin;
    const colors = typeColors[note.type] || typeColors.PERSONAL;
    const timeAgo = formatDistanceToNow(new Date(note.createdAt), { addSuffix: true });

    return (
        <div className={`group relative bg-card border ${colors.border} rounded-xl p-4 hover:shadow-lg transition-all duration-200 ${colors.bg}`}>
            <div className="flex flex-col gap-3">
                {/* Header: Title and Pin */}
                <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm text-foreground leading-tight line-clamp-2">
                        {note.title}
                    </h4>
                    <div className="flex items-center gap-1">
                        {note.isPinned && <Pin className="h-3 w-3 text-amber-500 fill-amber-500" />}
                        {canModify && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                    <DropdownMenuItem onClick={() => onEdit(note)} className="cursor-pointer gap-2 py-2">
                                        <Edit2 className="h-3.5 w-3.5" /> Edit
                                    </DropdownMenuItem>
                                    {note.isPinned ? (
                                        <DropdownMenuItem onClick={() => unpinNote.mutate(note.id)} className="cursor-pointer gap-2 py-2">
                                            <Pin className="h-3.5 w-3.5" /> Unpin
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem onClick={() => onPin(note.id)} className="cursor-pointer gap-2 py-2">
                                            <Pin className="h-3.5 w-3.5" /> Pin
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => deleteNote.mutate(note.id)} className="text-red-500 cursor-pointer gap-2 py-2">
                                        <Trash2 className="h-3.5 w-3.5" /> Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                {/* Content Points */}
                {note.content && note.content.length > 0 && (
                    <div className="space-y-1">
                        {(isExpanded ? note.content : note.content.slice(0, 4)).map((point, index) => (
                            <div key={index} className="flex items-start gap-2">
                                <div className={`w-1 h-1 rounded-full ${colors.accent} mt-2 shrink-0 opacity-40`} />
                                <p className="text-[13px] text-muted-foreground/90 leading-normal line-clamp-3">
                                    {point}
                                </p>
                            </div>
                        ))}
                        {note.content.length > 4 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsExpanded(!isExpanded);
                                }}
                                className="text-[11px] text-primary/70 hover:underline font-medium pt-1"
                            >
                                {isExpanded ? 'Show less' : `+ ${note.content.length - 4} more`}
                            </button>
                        )}
                    </div>
                )}

                {/* Tags & Metadata (Visible on Hover or if important) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border-none font-medium ${colors.badge}`}>
                        {note.type}
                    </Badge>
                    {note.projectName && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-muted/50 text-muted-foreground border-none truncate max-w-[100px]">
                            {note.projectName}
                        </Badge>
                    )}
                    <div className="flex-1" />
                    <span className="text-[10px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        {timeAgo}
                    </span>
                </div>

                {/* Resources Summary */}
                {((note.attachments && note.attachments.length > 0) || (note.links && note.links.length > 0)) && (
                    <div className="flex gap-2 pt-1 border-t border-border/20">
                        {note.attachments?.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Paperclip className="h-3 w-3" />
                                {note.attachments.length}
                            </div>
                        )}
                        {note.links?.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <LinkIcon className="h-3 w-3" />
                                {note.links.length}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Conversion Modal */}
            {isConvertModalOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                    <div
                        className="bg-card border border-border p-8 rounded-[2rem] shadow-2xl w-full max-w-lg animate-in zoom-in duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-3xl font-bold text-foreground tracking-tight">
                                Convert to Task
                            </h2>
                            <button
                                onClick={() => setIsConvertModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Plus className="h-8 w-8 rotate-45" />
                            </button>
                        </div>

                        {isLoadingData ? (
                            <div className="flex justify-center p-12">
                                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            </div>
                        ) : (
                            <AddTaskForm
                                users={users}
                                projects={projects}
                                onTaskAdded={() => {
                                    toast.success("Note successfully converted to task");
                                    setIsConvertModalOpen(false);
                                    // Optionally delete the note or mark it as converted
                                    // For now we just close the modal as per typical project flow
                                }}
                                onClose={() => setIsConvertModalOpen(false)}
                                currentUserId={userId}
                                initialData={{
                                    description: note.content && note.content.length > 0
                                        ? `${note.title}\n\nNotes:\n- ${note.content.join('\n- ')}`
                                        : note.title,
                                    projectId: note.projectId
                                }}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
