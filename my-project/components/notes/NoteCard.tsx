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
    PERSONAL: { gradient: 'from-emerald-400 to-teal-500', badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: 'text-emerald-500' },
    ORGANIZATIONAL: { gradient: 'from-amber-400 to-orange-500', badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: 'text-amber-500' },
    PROJECT: { gradient: 'from-indigo-400 to-purple-500', badge: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20', icon: 'text-indigo-500' },
};

export function NoteCard({ note, onEdit, onPin }: Props) {
    const deleteNote = useDeleteNote();
    const unpinNote = useUnpinNote();
    const [token, setToken] = useState<string | null>(null);
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
    const colors = typeColors[note.type];
    const timeAgo = formatDistanceToNow(new Date(note.createdAt), { addSuffix: true });

    return (
        <div className="group relative bg-card border border-border rounded-xl p-4 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-200">
            {/* Left accent bar */}
            <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full bg-gradient-to-b ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />

            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-medium shrink-0 ring-2 ring-background -mt-0.5">
                    {note.authorFirstName?.charAt(0)}{note.authorLastName?.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                        <h4 className="font-semibold text-sm truncate text-foreground/90 group-hover:text-foreground">
                            {note.title}
                        </h4>
                        {canModify && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36">
                                    <DropdownMenuItem onClick={() => onEdit(note)} className="cursor-pointer">
                                        <Edit2 className="h-4 w-4 mr-2" />
                                        Edit
                                    </DropdownMenuItem>
                                    {note.isPinned ? (
                                        <DropdownMenuItem onClick={() => unpinNote.mutate(note.id)} className="cursor-pointer">
                                            <Pin className="h-4 w-4 mr-2" />
                                            Unpin
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem onClick={() => onPin(note.id)} className="cursor-pointer">
                                            <Pin className="h-4 w-4 mr-2" />
                                            Pin
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => deleteNote.mutate(note.id)} className="text-red-500 cursor-pointer">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>

                    {/* Content preview - Points list */}
                    {note.content && note.content.length > 0 && (
                        <div className="mb-3">
                            <div className="flex flex-col gap-1">
                                {note.content.slice(0, 3).map((point, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-purple-500/10 text-purple-600 text-[9px] font-medium shrink-0 mt-0.5">
                                            {index + 1}
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                                            {point}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            {note.content.length > 3 && (
                                <span className="text-[10px] text-purple-500 ml-6">
                                    +{note.content.length - 3} more points
                                </span>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] h-5 ${colors.badge}`}>
                                {note.type === 'ORGANIZATIONAL' ? 'Org' : note.type}
                            </Badge>
                            {note.isPinned && (
                                <Badge variant="outline" className="text-[10px] h-5 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                                    <Pin className="h-2.5 w-2.5 mr-1" />
                                    Pinned
                                </Badge>
                            )}
                            {note.projectName && (
                                <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                                    {note.projectName}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                            {note.attachments && note.attachments.length > 0 && (
                                <div className="flex items-center gap-1">
                                    <Paperclip className="h-3 w-3" />
                                    {note.attachments.length}
                                </div>
                            )}
                            {note.links && note.links.length > 0 && (
                                <div className="flex items-center gap-1">
                                    <LinkIcon className="h-3 w-3" />
                                    {note.links.length}
                                </div>
                            )}
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {timeAgo}
                            </span>
                        </div>
                    </div>

                    {/* Tags */}
                    {note.tags && note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5 pt-2.5 border-t border-border/50">
                            {note.tags.slice(0, 3).map(tag => (
                                <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600">
                                    @{tag.firstName}
                                </span>
                            ))}
                            {note.tags.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{note.tags.length - 3}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
