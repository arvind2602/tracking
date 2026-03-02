import { Note } from '@/lib/types';
import { Pin, Paperclip, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useDeleteNote, useUnpinNote } from '@/hooks/useNotes';
import { jwtDecode } from 'jwt-decode';
import { useEffect, useState } from 'react';

interface Props {
    note: Note;
    onEdit: (note: Note) => void;
    onPin: (noteId: string) => void;
}

export function NoteCard({ note, onEdit, onPin }: Props) {
    const deleteNote = useDeleteNote();
    const unpinNote = useUnpinNote();
    const [userId, setUserId] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                setUserId(decoded?.user?.uuid);
                setIsAdmin(decoded?.user?.role === 'ADMIN');
            } catch (e) { }
        }
    }, []);

    const isOwner = userId === note.authorId;
    const canModify = isOwner || isAdmin;

    return (
        <div className="bg-card/80 backdrop-blur-md border border-border/60 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-blue-500/30 transition-all duration-300 relative group overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="flex justify-between items-start mb-3">
                <h4 className="font-semibold text-base line-clamp-1 pr-8 group-hover:text-blue-500 transition-colors duration-300">{note.title}</h4>

                {canModify && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(note)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            {note.isPinned ? (
                                <DropdownMenuItem onClick={() => unpinNote.mutate(note.id)}>
                                    <Pin className="h-4 w-4 mr-2 opacity-50" />
                                    Unpin
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem onClick={() => onPin(note.id)}>
                                    <Pin className="h-4 w-4 mr-2" />
                                    Pin Note
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-red-500 focus:bg-red-50 focus:text-red-600" onClick={() => deleteNote.mutate(note.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            <p className="text-sm text-muted-foreground/90 line-clamp-3 mb-5 whitespace-pre-wrap leading-relaxed">
                {note.content}
            </p>

            {/* Meta info footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-auto pt-4 border-t border-border/50 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] text-white font-bold tracking-wider uppercase shrink-0">
                        {note.authorFirstName?.charAt(0)}{note.authorLastName?.charAt(0)}
                    </div>
                    <span className="font-medium text-foreground/80">{note.authorFirstName} {note.authorLastName}</span>
                    <span className="opacity-50">•</span>
                    <span className="opacity-70">{format(new Date(note.createdAt), 'MMM d, yyyy')}</span>
                </div>

                <div className="flex items-center gap-2">
                    {note.isPinned && (
                        <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/25 shadow-none border border-yellow-500/20">
                            <Pin className="h-3 w-3 mr-1 fill-yellow-500/30" />
                            Pinned
                        </Badge>
                    )}
                    {note.projectName && (
                        <Badge variant="outline" className="text-xs font-normal border-blue-500/20 text-blue-500 bg-blue-500/5">
                            {note.projectName}
                        </Badge>
                    )}
                    {note.attachments?.length > 0 && (
                        <div className="flex items-center text-muted-foreground" title={`${note.attachments.length} attachments`}>
                            <Paperclip className="h-3 w-3 mr-1" />
                            {note.attachments.length}
                        </div>
                    )}
                </div>
            </div>

            {/* Tags display */}
            {note.tags?.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/30 flex flex-wrap gap-1.5">
                    {note.tags.map(tag => (
                        <Badge key={tag.id} variant="secondary" className="text-[10px] py-0 h-5 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20">
                            @{tag.firstName}
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}
