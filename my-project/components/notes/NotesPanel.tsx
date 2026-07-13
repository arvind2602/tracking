'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Search, Plus, Keyboard, FileText, Briefcase, User, FolderKanban, LayoutList as Playout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotesList } from './NotesList';
import { NoteEditor } from './NoteEditor';
import { NoteType, Note } from '@/lib/types';

interface Props {
    open: boolean;
    onClose: () => void;
}

const noteTypeIcons = {
    PERSONAL: { icon: User, label: 'Personal', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    ORGANIZATIONAL: { icon: Briefcase, label: 'Organizational', color: 'text-amber-500', bg: 'bg-amber-500/10' },
    PROJECT: { icon: FolderKanban, label: 'Project', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    TODO: { icon: Playout, label: 'Todo', color: 'text-rose-500', bg: 'bg-rose-500/10' },
};

export function NotesPanel({ open, onClose }: Props) {
    const [activeTab, setActiveTab] = useState<NoteType | 'ALL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && open && !isEditing) {
            onClose();
        }
    }, [open, isEditing, onClose]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Simplified onClose to reset state when called from the UI
    const handleClose = () => {
        setIsEditing(false);
        setNoteToEdit(null);
        setSearchTerm('');
        onClose();
    };

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] transition-all duration-300 animate-in fade-in"
                onClick={handleClose}
            />

            {/* Panel */}
            <div className="fixed top-0 right-0 h-full w-full max-w-4xl bg-background/98 dark:bg-background/98 backdrop-blur-xl border-l border-border shadow-2xl z-[101] flex flex-col animate-in slide-in-from-right duration-300 ease-out">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-background to-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold tracking-tight">My Notes</h2>
                            <p className="text-xs text-muted-foreground">Quick thoughts & reminders</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground bg-muted/60 rounded-md border border-border/40">
                            <Keyboard className="w-3 h-3" />
                            ESC
                        </kbd>
                        <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-full hover:bg-muted/60 transition-colors h-9 w-9">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">
                    <div className="flex flex-col h-full">
                        {/* Search & Filter Bar */}
                        <div className="p-4 flex gap-2 items-center sticky top-0 bg-background/98 backdrop-blur-sm z-10 border-b border-border/40">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 group-focus-within:text-purple-500 transition-colors" />
                                <Input
                                    placeholder="Search notes..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-muted/30 border-transparent focus:border-purple-500/30 focus:bg-muted/50 transition-all rounded-full h-10"
                                />
                            </div>
                            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as NoteType | 'ALL')} className="w-auto">
                                <TabsList className="bg-muted/40 p-0.5 rounded-full h-10">
                                    <TabsTrigger value="ALL" className="px-4 text-xs rounded-full data-[state=active]:bg-background">All</TabsTrigger>
                                    <TabsTrigger value="PERSONAL" className="px-4 text-xs rounded-full data-[state=active]:bg-background">Personal</TabsTrigger>
                                    <TabsTrigger value="ORGANIZATIONAL" className="px-4 text-xs rounded-full data-[state=active]:bg-background">Org</TabsTrigger>
                                    <TabsTrigger value="PROJECT" className="px-4 text-xs rounded-full data-[state=active]:bg-background">Project</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        {/* Note Creator (Google Keep Style) */}
                        <div className="p-4 flex flex-col items-center">
                            {!isEditing || noteToEdit ? (
                                <div 
                                    onClick={() => {
                                        setNoteToEdit(null);
                                        setIsEditing(true);
                                    }}
                                    className="w-full max-w-2xl bg-card border border-border/60 rounded-xl p-3 shadow-sm hover:shadow-md cursor-text transition-all flex items-center justify-between group"
                                >
                                    <span className="text-muted-foreground font-medium pl-2">Take a note...</span>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-40 group-hover:opacity-100">
                                            <Playout className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-40 group-hover:opacity-100">
                                            <FileText className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full max-w-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                                    <NoteEditor
                                        noteToEdit={null}
                                        onClose={() => setIsEditing(false)}
                                        defaultType={activeTab !== 'ALL' ? activeTab : 'PERSONAL'}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Notes List */}
                        <div className="flex-1 px-4 pb-10">
                            <NotesList
                                type={activeTab}
                                searchTerm={debouncedSearch}
                                onEdit={(note) => {
                                    setNoteToEdit(note);
                                    setIsEditing(true);
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Edit Modal Overlay (for when editing an existing note) */}
                {isEditing && noteToEdit && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/20 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                            <NoteEditor
                                noteToEdit={noteToEdit}
                                onClose={() => {
                                    setIsEditing(false);
                                    setNoteToEdit(null);
                                }}
                            />
                        </div>
                    </div>
                )}

            </div>
        </>
    );
}
