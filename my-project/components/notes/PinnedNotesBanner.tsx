'use client';

import { useGetPinnedNotes, useUnpinNote } from '@/hooks/useNotes';
import { Pin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

export function PinnedNotesBanner() {
    const { data: pinnedNotes, isLoading } = useGetPinnedNotes();
    const unpinNote = useUnpinNote();
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                setIsAdmin(decoded?.user?.role === 'ADMIN');
            } catch (e) { }
        }
    }, []);

    if (isLoading || !pinnedNotes || pinnedNotes.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 mb-6">
            {pinnedNotes.map((note) => (
                <div
                    key={note.id}
                    className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400 p-3 flex items-center justify-between rounded-xl shadow-sm relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-yellow-500/5 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />
                    <div className="flex items-center gap-3 relative z-10 w-full overflow-hidden">
                        <div className="bg-yellow-500/20 p-2 rounded-lg shrink-0">
                            <Pin className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">{note.title}</h4>
                            <p className="text-xs opacity-80 truncate">{note.content || 'Organizational note'}</p>
                        </div>
                    </div>
                    {isAdmin && (
                        <div className="relative z-10 shrink-0 ml-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20"
                                onClick={() => unpinNote.mutate(note.id)}
                                disabled={unpinNote.isPending}
                            >
                                <X className="h-4 w-4 mr-1" />
                                Remove Pin
                            </Button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
