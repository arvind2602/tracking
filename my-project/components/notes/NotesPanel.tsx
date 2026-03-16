'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Search, Plus, Keyboard, FileText, Briefcase, User, FolderKanban } from 'lucide-react';
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
                    {!isEditing ? (
                        <div className="flex flex-col h-full">
                            {/* Quick Create Buttons */}
                            <div className="p-4 pb-2">
                                <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Quick Create</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['PERSONAL', 'ORGANIZATIONAL', 'PROJECT'] as NoteType[]).map((type) => {
                                        const config = noteTypeIcons[type];
                                        const Icon = config.icon;
                                        return (
                                            <button
                                                key={type}
                                                onClick={() => {
                                                    setActiveTab(type);
                                                    setNoteToEdit(null);
                                                    setIsEditing(true);
                                                }}
                                                className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-purple-500/50 hover:bg-purple-500/5 transition-all duration-200 group"
                                            >
                                                <div className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                                    <Icon className={`w-4 h-4 ${config.color}`} />
                                                </div>
                                                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                                                    {type === 'ORGANIZATIONAL' ? 'Org' : type}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Search */}
                            <div className="px-4 pb-2">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 group-focus-within:text-purple-500 transition-colors" />
                                    <Input
                                        placeholder="Search notes..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-9 bg-muted/50 border-transparent focus:border-purple-500/30 focus:bg-muted transition-all"
                                    />
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="px-4 pb-3">
                                <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as NoteType | 'ALL')}>
                                    <TabsList className="w-full bg-muted/60 p-1 rounded-lg h-auto">
                                        <TabsTrigger value="ALL" className="flex-1 text-xs py-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">All</TabsTrigger>
                                        <TabsTrigger value="PERSONAL" className="flex-1 text-xs py-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Personal</TabsTrigger>
                                        <TabsTrigger value="ORGANIZATIONAL" className="flex-1 text-xs py-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm truncate">Org</TabsTrigger>
                                        <TabsTrigger value="PROJECT" className="flex-1 text-xs py-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Project</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                            {/* Notes List */}
                            <div className="flex-1 px-4 pb-4 overflow-y-auto">
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
                    ) : (
                        <div className="p-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <NoteEditor
                                noteToEdit={noteToEdit}
                                onClose={() => {
                                    setIsEditing(false);
                                    setNoteToEdit(null);
                                }}
                                defaultType={activeTab !== 'ALL' ? activeTab : 'PERSONAL'}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!isEditing && (
                    <div className="p-4 border-t border-border bg-gradient-to-b from-transparent to-muted/20">
                        <Button
                            className="w-full gap-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white rounded-xl h-11 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/20"
                            onClick={() => setIsEditing(true)}
                        >
                            <Plus className="h-5 w-5" />
                            Create Note
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
}
