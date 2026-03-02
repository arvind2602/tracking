'use client';

import { useState, useEffect } from 'react';
import { X, Search, Plus } from 'lucide-react';
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

export function NotesPanel({ open, onClose }: Props) {
    const [activeTab, setActiveTab] = useState<NoteType | 'ALL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[100] transition-opacity" onClick={onClose} />
            <div className="fixed top-0 right-0 h-full w-full max-w-sm sm:max-w-md bg-background/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[101] flex flex-col transition-transform transform translate-x-0">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border/50 bg-gradient-to-r from-background to-muted/20">
                    <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">Notes</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted/50 transition-colors">
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-4">
                    {!isEditing ? (
                        <>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search notes..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-muted/50 border-none focus-visible:ring-1"
                                />
                            </div>

                            <div className="flex items-center justify-between mt-2">
                                <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
                                    <TabsList className="grid w-full grid-cols-4 bg-muted/40 p-1.5 rounded-xl">
                                        <TabsTrigger value="ALL" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300">All</TabsTrigger>
                                        <TabsTrigger value="PERSONAL" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300">Personal</TabsTrigger>
                                        <TabsTrigger value="ORGANIZATIONAL" className="text-xs truncate rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300" title="Organizational">Org</TabsTrigger>
                                        <TabsTrigger value="PROJECT" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300">Project</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                            <div className="mt-2 flex-1 relative rounded-xl">
                                <NotesList
                                    type={activeTab}
                                    searchTerm={debouncedSearch}
                                    onEdit={(note) => {
                                        setNoteToEdit(note);
                                        setIsEditing(true);
                                    }}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
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
                    <div className="p-5 border-t border-border/50 bg-gradient-to-b from-transparent to-background/50">
                        <Button
                            className="w-full shadow-lg gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl h-12 transition-all hover:scale-[1.02]"
                            size="lg"
                            onClick={() => setIsEditing(true)}
                        >
                            <Plus className="h-5 w-5" />
                            Create New Note
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
}
