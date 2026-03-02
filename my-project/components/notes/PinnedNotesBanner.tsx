'use client';

import { useGetPinnedNotes, useUnpinNote } from '@/hooks/useNotes';
import { Pin, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useMemo } from 'react';
import { jwtDecode } from 'jwt-decode';

interface UserPayload {
    user: {
        role: string;
    };
}

export function PinnedNotesBanner() {
    const { data: pinnedNotes, isLoading } = useGetPinnedNotes();
    const unpinNote = useUnpinNote();
    const [token, setToken] = useState<string | null>(null);
    useEffect(() => {
        setToken(localStorage.getItem('token'));
    }, []);

    const isAdmin = useMemo(() => {
        if (!token) return false;
        try {
            const decoded = jwtDecode<UserPayload>(token);
            return decoded.user?.role === 'ADMIN';
        } catch (e) {
            console.error("Failed to decode token", e);
            return false;
        }
    }, [token]);

    if (isLoading || !pinnedNotes || pinnedNotes.length === 0) return null;

    return (
        <div className="flex flex-col gap-3 mb-6">
            <div className="flex items-center gap-2 px-1">
                <Pin className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pinned</span>
            </div>
            {pinnedNotes.map((note) => (
                <div
                    key={note.id}
                    className="bg-gradient-to-r from-amber-50/80 via-yellow-50/80 to-orange-50/80 dark:from-amber-950/30 dark:via-yellow-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/30 text-amber-900 dark:text-amber-100 p-3.5 flex items-center justify-between rounded-xl shadow-sm relative overflow-hidden group"
                >
                    {/* Subtle animated background */}
                    <div className="absolute inset-0 bg-amber-500/5 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />

                    <div className="flex items-center gap-3 relative z-10 w-full min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-md">
                            <FileText className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">{note.title}</h4>
                            <p className="text-xs text-amber-700/70 dark:text-amber-300/70 truncate">
                                {note.content?.slice(0, 60) || 'Organizational note'}
                                {note.content?.length > 60 && '...'}
                            </p>
                        </div>
                    </div>

                    {isAdmin && (
                        <div className="relative z-10 shrink-0 ml-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 h-8 px-2.5 opacity-0 group-hover:opacity-100 transition-all"
                                onClick={() => unpinNote.mutate(note.id)}
                                disabled={unpinNote.isPending}
                            >
                                <X className="h-4 w-4 mr-1.5" />
                                <span className="text-xs">Remove</span>
                            </Button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
