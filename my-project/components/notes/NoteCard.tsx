import { Note } from '@/lib/types';
import { Pin, Paperclip, Trash2, Edit2, Clock, MoreHorizontal, Link as LinkIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useDeleteNote, useUnpinNote } from '@/hooks/useNotes';
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
};

export function NoteCard({ note, onEdit, onPin }: Props) {
    const deleteNote = useDeleteNote();
    const unpinNote = useUnpinNote();
    const [token, setToken] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    
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
        <div className={`group relative bg-card border ${colors.border} rounded-2xl p-5 hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300 ${colors.bg}`}>
            {/* Top Accent Strip */}
            <div className={`absolute top-0 left-6 right-6 h-0.5 ${colors.accent} opacity-20 group-hover:opacity-100 transition-opacity duration-300 rounded-full`} />

            <div className="flex flex-col gap-4">
                {/* Header Information */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                         <div className={`h-10 w-10 rounded-xl ${colors.accent} flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-black/5`}>
                            {note.authorFirstName?.charAt(0)}{note.authorLastName?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="font-bold text-[13px] text-foreground tracking-tight group-hover:text-primary transition-colors truncate">
                                    {note.title}
                                </h4>
                                {note.isPinned && <Pin className="h-3 w-3 text-amber-500 rotate-45" />}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">
                                <span>{note.authorFirstName} {note.authorLastName}</span>
                                <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{timeAgo}</span>
                            </div>
                        </div>
                    </div>

                    {canModify && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                <DropdownMenuItem onClick={() => onEdit(note)} className="cursor-pointer gap-2 py-2">
                                    <Edit2 className="h-3.5 w-3.5" /> Edit Workspace
                                </DropdownMenuItem>
                                {note.isPinned ? (
                                    <DropdownMenuItem onClick={() => unpinNote.mutate(note.id)} className="cursor-pointer gap-2 py-2">
                                        <Pin className="h-3.5 w-3.5" /> Unpin Note
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem onClick={() => onPin(note.id)} className="cursor-pointer gap-2 py-2">
                                        <Pin className="h-3.5 w-3.5" /> Pin to Top
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => deleteNote.mutate(note.id)} className="text-red-500 cursor-pointer gap-2 py-2">
                                    <Trash2 className="h-3.5 w-3.5" /> Move to Trash
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                {/* Content Points */}
                {note.content && note.content.length > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex flex-col gap-1.5">
                            {(isExpanded ? note.content : note.content.slice(0, 3)).map((point, index) => (
                                <div key={index} className="flex items-start gap-3 px-3 py-2 rounded-xl bg-background/50 border border-border/20 transition-all hover:bg-background">
                                    <div className={`flex items-center justify-center w-5 h-5 rounded-lg ${colors.bg} ${colors.icon} text-[10px] font-black shrink-0 mt-0.5`}>
                                        {index + 1}
                                    </div>
                                    <p className={`text-xs text-muted-foreground/90 leading-relaxed font-medium ${!isExpanded ? 'line-clamp-2' : ''}`}>
                                        {point}
                                    </p>
                                </div>
                            ))}
                        </div>
                        {note.content.length > 3 && (
                            <button 
                                onClick={() => setIsExpanded(!isExpanded)}
                                className={`text-[10px] ${colors.icon} hover:underline font-bold uppercase tracking-wider px-2 py-1 transition-all`}
                            >
                                {isExpanded ? 'Collapse Session' : `+ ${note.content.length - 3} More Points`}
                            </button>
                        )}
                    </div>
                )}

                {/* Tags & Categorization */}
                <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-[9px] font-black tracking-widest uppercase h-5 px-2 border-none ${colors.badge}`}>
                            {note.type}
                        </Badge>
                        {note.projectName && (
                            <Badge variant="outline" className="text-[9px] font-bold h-5 px-2 bg-muted/40 text-muted-foreground/80 border-none truncate max-w-[120px]">
                                {note.projectName}
                            </Badge>
                        )}
                        {note.tags && note.tags.length > 0 && note.tags.slice(0, 2).map(tag => (
                            <span key={tag.id} className="text-[10px] font-bold text-primary/70 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                                @{tag.firstName}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Resource Sub-Grid */}
                {((note.attachments && note.attachments.length > 0) || (note.links && note.links.length > 0)) && (
                    <div className="grid grid-cols-1 gap-2 pt-2">
                        {note.attachments?.map((att, index) => (
                            <a
                                key={`att-${index}`}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-2.5 rounded-xl bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 transition-all group/res"
                            >
                                <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                                    <Paperclip className="h-4 w-4 text-indigo-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold text-indigo-900 dark:text-indigo-400 truncate leading-none mb-1">{att.name}</p>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-500/60">{att.heading || 'Attachment'}</span>
                                </div>
                            </a>
                        ))}
                        {note.links?.map((link, index) => (
                            <a
                                key={`link-${index}`}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 transition-all group/res"
                            >
                                <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                                    <LinkIcon className="h-4 w-4 text-blue-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold text-blue-900 dark:text-blue-400 truncate leading-none mb-1">{link.name}</p>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-blue-500/60">{link.heading || 'Web Link'}</span>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
