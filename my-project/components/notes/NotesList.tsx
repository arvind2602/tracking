import { Note, NoteType } from '@/lib/types';
import { useGetNotes } from '@/hooks/useNotes';
import { NoteCard } from './NoteCard';
import { PinNoteModal } from './PinNoteModal';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

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
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
        );
    }

    if (!notes || notes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center border-t border-border mt-4">
                <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl opacity-20">📝</span>
                </div>
                <h3 className="text-lg font-medium text-foreground">No notes found</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {searchTerm ? 'Try adjusting your search terms.' : `You don't have any ${type.toLowerCase()} notes yet.`}
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 gap-4">
                {notes.map(note => (
                    <NoteCard
                        key={note.id}
                        note={note}
                        onEdit={onEdit}
                        onPin={(id) => setPinNoteId(id)}
                    />
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
