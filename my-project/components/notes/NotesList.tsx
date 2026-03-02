import { Note, NoteType } from '@/lib/types';
import { useGetNotes } from '@/hooks/useNotes';
import { NoteCard } from './NoteCard';
import { PinNoteModal } from './PinNoteModal';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';

interface Props {
    type: NoteType | 'ALL';
    searchTerm: string;
    onEdit: (note: Note) => void;
}

export function NotesList({ type, searchTerm, onEdit }: Props) {
    const { data: notes, isLoading } = useGetNotes({ type, search: searchTerm });
    const [pinNoteId, setPinNoteId] = useState<string | null>(null);

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
            </div>
        );
    }

    // Note count by type
    const getTypeLabel = () => {
        if (type === 'ALL') return 'notes';
        return type.toLowerCase() + ' notes';
    };

    if (!notes || notes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="relative mb-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 rounded-3xl flex items-center justify-center">
                        <FileText className="w-10 h-10 text-indigo-400" strokeWidth={1.5} />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-white text-xs font-bold">+</span>
                    </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                    {searchTerm ? 'No matches found' : 'No notes yet'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                    {searchTerm
                        ? `No notes match "${searchTerm}". Try a different search term.`
                        : `Start capturing your ${getTypeLabel()} by clicking the button below.`}
                </p>
            </div>
        );
    }

    return (
        <>
            {/* Notes count indicator */}
            <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-xs font-medium text-muted-foreground">
                    {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                </span>
                {searchTerm && (
                    <span className="text-xs text-purple-500 font-medium">
                        Searching: &quot;{searchTerm}&quot;
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {notes.map((note, index) => (
                    <div
                        key={note.id}
                        className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <NoteCard
                            note={note}
                            onEdit={onEdit}
                            onPin={(id) => setPinNoteId(id)}
                        />
                    </div>
                ))}
            </div>

            <PinNoteModal
                noteId={pinNoteId}
                open={!!pinNoteId}
                onOpenChange={(open) => !open && setPinNoteId(null)}
            />
        </>
    );
}
