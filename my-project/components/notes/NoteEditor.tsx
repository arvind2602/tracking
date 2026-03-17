import { Note, NoteAttachment, NoteType, Project, User } from '@/lib/types';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useCreateNote, useUpdateNote, usePinNote } from '@/hooks/useNotes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Paperclip, Loader2, X, Tag, ChevronDown, Check, Plus, Trash2, Link as LinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import axiosInstance from '@/lib/axios';
import axios from 'axios';
import { cn } from '@/lib/utils';
import { jwtDecode } from 'jwt-decode';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';

interface Props {
    noteToEdit?: Note | null;
    onClose: () => void;
    defaultType?: NoteType;
    defaultEmployeeId?: string;
    defaultTitle?: string;
    defaultPoints?: string[];
    defaultProjectId?: string;
}

interface UserPayload {
    user: {
        role: string;
    };
}

export function NoteEditor({ noteToEdit, onClose, defaultType = 'PERSONAL', defaultEmployeeId, defaultTitle, defaultPoints, defaultProjectId }: Props) {
    const createNote = useCreateNote();
    const updateNote = useUpdateNote();

    const [title, setTitle] = useState(noteToEdit?.title || defaultTitle || '');
    const [points, setPoints] = useState<string[]>(noteToEdit?.content || defaultPoints || []);
    const [type, setType] = useState<NoteType>(noteToEdit?.type || defaultType);
    const [projectId, setProjectId] = useState<string>(noteToEdit?.projectId || defaultProjectId || '');

    // Remote data
    const [projects, setProjects] = useState<Project[]>([]);
    const [employees, setEmployees] = useState<User[]>([]);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const filteredEmployees = employees.filter(emp =>
        (`${emp.firstName} ${emp.lastName} ${emp.email}`).toLowerCase().includes(employeeSearch.toLowerCase())
    );

    // Tagging
    const [tags, setTags] = useState<string[]>(
        noteToEdit?.tags?.map(t => t.employeeId) || (defaultEmployeeId ? [defaultEmployeeId] : [])
    );

    const [attachments, setAttachments] = useState<NoteAttachment[]>(noteToEdit?.attachments || []);
    const [links, setLinks] = useState<any[]>(noteToEdit?.links || []);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Link Popover State
    const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
    const [newLinkUrl, setNewLinkUrl] = useState('');
    const [newLinkName, setNewLinkName] = useState('');
    const [newLinkHeading, setNewLinkHeading] = useState('');

    // Pinning configuration (Creation only)
    const pinNote = usePinNote();
    const [isPinned, setIsPinned] = useState(false);
    const [pinDurationValue, setPinDurationValue] = useState('1');
    const [pinDurationUnit, setPinDurationUnit] = useState('forever');

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

    useEffect(() => {
        if (type === 'PROJECT' || type === 'TODO') {
            axiosInstance.get<Project[]>('/projects').then(res => setProjects(res.data));
        }
    }, [type]);

    useEffect(() => {
        axiosInstance.get<User[]>('/auth/organization').then(res => setEmployees(res.data));
    }, []);

    // Add a new point
    const addPoint = () => {
        setPoints([...points, '']);
    };

    // Update a specific point
    const updatePoint = (index: number, value: string) => {
        const newPoints = [...points];
        newPoints[index] = value;
        setPoints(newPoints);
    };

    // Remove a point
    const removePoint = (index: number) => {
        setPoints(points.filter((_, i) => i !== index));
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const formData = new FormData();

        try {
            const processFile = async (file: File) => {
                if (file.type.startsWith('image/') && file.size > 1024 * 1024) {
                    try {
                        const options = {
                            maxSizeMB: 1,
                            maxWidthOrHeight: 1920,
                            useWebWorker: true,
                        };
                        const compressedFile = await imageCompression(file, options);
                        return compressedFile;
                    } catch (err) {
                        console.error('Compression error, using original file', err);
                        return file;
                    }
                }

                if (!file.type.startsWith('image/') && file.size > 10 * 1024 * 1024) {
                    throw new Error(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Documents must be under 10MB.`);
                }

                return file;
            };

            const processedFiles = await Promise.all(
                Array.from(files).map(file => processFile(file))
            );

            processedFiles.forEach((file) => {
                formData.append('files', file);
            });

            const { data } = await axiosInstance.post('/notes/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Give newly uploaded attachments a default empty heading property
            const newAttachments = data.map((att: NoteAttachment) => ({ ...att, heading: '' }));
            setAttachments((prev) => [...prev, ...newAttachments]);
        } catch (error: unknown) {
            console.error('Failed to upload files', error);
            if (axios.isAxiosError(error) && error.response?.data?.message) {
                toast.error(`${error.response.data.message}`);
            } else if (error instanceof Error) {
                toast.error(error.message);
            } else {
                toast.error("Failed to upload file. It might be too large.");
            }
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const updateAttachmentHeading = (index: number, heading: string) => {
        setAttachments(prev => {
            const newAtts = [...prev];
            newAtts[index].heading = heading;
            return newAtts;
        });
    };

    const removeAttachment = (indexToRemove: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== indexToRemove));
    };

    const handleAddLink = () => {
        if (!newLinkUrl.trim() || !newLinkName.trim()) {
            toast.error('Please provide both URL and Name for the link.');
            return;
        }

        // Basic URL validation
        let finalUrl = newLinkUrl.trim();
        if (!/^https?:\/\//i.test(finalUrl)) {
            finalUrl = 'https://' + finalUrl;
        }

        setLinks(prev => [...prev, {
            name: newLinkName.trim(),
            url: finalUrl,
            heading: newLinkHeading.trim() || ''
        }]);
        setNewLinkUrl('');
        setNewLinkName('');
        setNewLinkHeading('');
        setIsLinkPopoverOpen(false);
    };

    const removeLink = (indexToRemove: number) => {
        setLinks((prev) => prev.filter((_, i) => i !== indexToRemove));
    };

    const updateLinkHeading = (index: number, heading: string) => {
        setLinks(prev => {
            const newLnk = [...prev];
            newLnk[index].heading = heading;
            return newLnk;
        });
    };

    const toggleTag = (employeeId: string) => {
        setTags(prev =>
            prev.includes(employeeId)
                ? prev.filter(id => id !== employeeId)
                : [...prev, employeeId]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        // Filter out empty points
        const filteredPoints = points.filter(p => p.trim() !== '');

        const payload = {
            title,
            content: filteredPoints,
            type,
            projectId: (type === 'PROJECT' || type === 'TODO') ? projectId : null,
            tags: tags,
            attachments: attachments.map(a => ({
                name: a.name,
                url: a.url,
                fileType: a.fileType,
                size: a.size,
                heading: a.heading || null
            })),
            links: links.map(l => ({
                name: l.name,
                url: l.url,
                heading: l.heading || null
            }))
        };

        if (noteToEdit) {
            updateNote.mutate({ id: noteToEdit.id, payload }, { onSuccess: onClose });
        } else {
            createNote.mutate(payload, {
                onSuccess: (data: Note) => {
                    if (isPinned && data?.id) {
                        pinNote.mutate(
                            { id: data.id, duration: { value: Number(pinDurationValue), unit: pinDurationUnit } },
                            { onSuccess: onClose, onError: onClose }
                        );
                    } else {
                        onClose();
                    }
                }
            });
        }
    };

    const isPending = createNote.isPending || updateNote.isPending || isUploading || pinNote.isPending;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4 border border-border/60 rounded-2xl bg-card/80 backdrop-blur-md shadow-lg max-h-[calc(100vh-200px)] overflow-y-auto">
            <div className="flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-lg text-foreground tracking-tight">
                    {noteToEdit ? 'Edit Note' : 'Create New Note'}
                </h3>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 rounded-full hover:bg-muted shrink-0"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="space-y-4">
                {/* Title */}
                <Input
                    placeholder="Note title..."
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    autoFocus
                    required
                    className="bg-background/50 border-border/50 focus-visible:ring-2 focus-visible:ring-purple-500/30 text-base font-medium h-11"
                />

                {/* Type & Project Selection */}
                <div className="flex gap-2">
                    <div className="flex-1">
                        <Select value={type} onValueChange={(val: NoteType) => setType(val)}>
                            <SelectTrigger className="bg-background/50 border-border/50 h-10">
                                <SelectValue placeholder="Note Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PERSONAL">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        Personal
                                    </div>
                                </SelectItem>
                                {(isAdmin || type === 'ORGANIZATIONAL') && (
                                    <SelectItem value="ORGANIZATIONAL">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                                            Organizational
                                        </div>
                                    </SelectItem>
                                )}
                                <SelectItem value="PROJECT">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                        Project
                                    </div>
                                </SelectItem>
                                <SelectItem value="TODO">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                                        Todo
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(type === 'PROJECT' || type === 'TODO') && (
                        <div className="flex-1 animate-in fade-in zoom-in-95 duration-200">
                            <Select value={projectId} onValueChange={setProjectId} required>
                                <SelectTrigger className="bg-background/50 border-border/50 h-10">
                                    <SelectValue placeholder="Select Project" />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {/* Pin Option (Creation only) */}
                {!noteToEdit && (
                    <div className="flex flex-col gap-2 p-3 bg-background/30 rounded-lg border border-border/40">
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isPinned}
                                onChange={(e) => setIsPinned(e.target.checked)}
                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                            />
                            <span className="text-purple-600 dark:text-purple-400">Pin this note</span>
                        </label>
                        {isPinned && (
                            <div className="flex gap-2 animate-in slide-in-from-top-2">
                                <Select value={pinDurationUnit} onValueChange={setPinDurationUnit}>
                                    <SelectTrigger className="w-[140px] h-9 text-xs bg-background">
                                        <SelectValue placeholder="Duration" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hours">Hours</SelectItem>
                                        <SelectItem value="weeks">Weeks</SelectItem>
                                        <SelectItem value="months">Months</SelectItem>
                                        <SelectItem value="forever">Forever</SelectItem>
                                    </SelectContent>
                                </Select>
                                {pinDurationUnit !== 'forever' && (
                                    <Input
                                        type="number"
                                        min="1"
                                        value={pinDurationValue}
                                        onChange={(e) => setPinDurationValue(e.target.value)}
                                        className="h-9 max-w-[80px] text-xs"
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Tag People */}
                <div className="flex flex-wrap gap-2 items-center">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" type="button" className="h-9 gap-2 border-dashed bg-background/30 hover:bg-background/60 transition-colors">
                                <Tag className="h-4 w-4 text-purple-500" />
                                <span>Tag People</span>
                                {tags.length > 0 && (
                                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-purple-500/10 text-purple-600">
                                        {tags.length}
                                    </Badge>
                                )}
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-2 z-[10001]" align="start">
                            <div className="flex flex-col gap-2 mb-2 px-1">
                                <div className="text-sm font-medium text-muted-foreground">Tag team members</div>
                                <Input
                                    placeholder="Search employees..."
                                    value={employeeSearch}
                                    onChange={(e) => setEmployeeSearch(e.target.value)}
                                    className="h-9 text-sm bg-background/50"
                                />
                            </div>
                            <div className="flex flex-col gap-1 max-h-56 overflow-y-auto custom-scrollbar">
                                {filteredEmployees.length === 0 ? (
                                    <div className="p-3 text-sm text-center text-muted-foreground">No employees found</div>
                                ) : (
                                    filteredEmployees.map(emp => {
                                        const isChecked = tags.includes(emp.id);
                                        return (
                                            <div
                                                key={emp.id}
                                                onClick={() => toggleTag(emp.id)}
                                                className={cn(
                                                    "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border",
                                                    isChecked
                                                        ? "bg-purple-500/10 border-purple-500/30"
                                                        : "hover:bg-muted/50 border-transparent"
                                                )}
                                            >
                                                <div className={cn(
                                                    "flex items-center justify-center w-5 h-5 rounded border transition-colors shrink-0",
                                                    isChecked
                                                        ? "bg-purple-500 border-purple-500 text-white"
                                                        : "border-muted-foreground/40"
                                                )}>
                                                    {isChecked && <Check className="h-3 w-3" />}
                                                </div>
                                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-medium shrink-0">
                                                    {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-medium truncate">{emp.firstName} {emp.lastName}</span>
                                                    <span className="text-xs text-muted-foreground truncate">{emp.email}</span>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {tags.map(id => {
                                const emp = employees.find((e: User) => e.id === id);
                                if (!emp) return null;
                                return (
                                    <Badge key={id} variant="secondary" className="text-xs h-7 px-2.5 bg-purple-500/10 text-purple-600 border border-purple-500/20 pr-1.5 flex items-center gap-1.5">
                                        @{emp.firstName}
                                        <button
                                            type="button"
                                            onClick={() => toggleTag(id)}
                                            className="hover:bg-purple-500/20 rounded-full p-0.5 transition-colors"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Points Content */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-muted-foreground">Points</label>
                        <span className="text-xs text-muted-foreground">{points.length} {points.length === 1 ? 'point' : 'points'}</span>
                    </div>

                    <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                        {points.map((point, index) => (
                            <div key={index} className="flex items-center gap-2 group">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/10 text-purple-600 text-xs font-medium shrink-0">
                                    {index + 1}
                                </div>
                                <Textarea
                                    value={point}
                                    onChange={(e) => updatePoint(index, e.target.value)}
                                    placeholder={`Point ${index + 1}...`}
                                    className="min-h-[60px] resize-none bg-background/50 border-border/50 text-sm"
                                    rows={2}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removePoint(index)}
                                    className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addPoint}
                        className="gap-2 self-start mt-1"
                    >
                        <Plus className="h-4 w-4" />
                        Add Point
                    </Button>
                </div>

                {/* Attachments */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        {/* File Upload Button */}
                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="h-9 gap-2 bg-background/30 hover:bg-background/50 transition-colors border-dashed"
                        >
                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4 text-indigo-500" />}
                            <span>Attach Files</span>
                        </Button>

                        {/* Add Link Button */}
                        <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    className="h-9 gap-2 bg-background/30 hover:bg-background/50 transition-colors border-dashed"
                                >
                                    <LinkIcon className="h-4 w-4 text-blue-500" />
                                    <span>Add Link</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4 z-[10001]" align="start">
                                <div className="space-y-4">
                                    <h4 className="font-medium text-sm">Add a Link</h4>
                                    <div className="space-y-2">
                                        <Input
                                            placeholder="URL (e.g. https://example.com)"
                                            value={newLinkUrl}
                                            onChange={(e) => setNewLinkUrl(e.target.value)}
                                            className="h-9 text-sm"
                                        />
                                        <Input
                                            placeholder="Display Name"
                                            value={newLinkName}
                                            onChange={(e) => setNewLinkName(e.target.value)}
                                            className="h-9 text-sm"
                                        />
                                        <Input
                                            placeholder="Heading (Optional group name)"
                                            value={newLinkHeading}
                                            onChange={(e) => setNewLinkHeading(e.target.value)}
                                            className="h-9 text-sm"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleAddLink}
                                            className="w-full mt-2"
                                            disabled={!newLinkUrl.trim() || !newLinkName.trim()}
                                        >
                                            Add Link
                                        </Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {(attachments.length > 0 || links.length > 0) && (
                        <div className="flex flex-col gap-2 mt-2">
                            {/* Render Attachments */}
                            {attachments.map((att, index) => (
                                <div key={`att-${index}`} className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30 border border-border/40 group">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                                                <Paperclip className="h-4 w-4 text-indigo-500" />
                                            </div>
                                            <span className="truncate font-medium max-w-[150px]">{att.name}</span>
                                            <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline-block">
                                                {((att.size ?? 0) / 1024).toFixed(1)} KB
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                placeholder="Heading (Optional)"
                                                value={att.heading || ''}
                                                onChange={(e) => updateAttachmentHeading(index, e.target.value)}
                                                className="h-8 w-32 sm:w-40 text-xs bg-background/50 transition-all border-transparent hover:border-border focus:border-purple-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeAttachment(index)}
                                                className="text-muted-foreground hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-500/10"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Render Links */}
                            {links.map((link, index) => (
                                <div key={`link-${index}`} className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30 border border-border/40 group">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                <LinkIcon className="h-4 w-4 text-blue-500" />
                                            </div>
                                            <div className="flex flex-col overflow-hidden max-w-[150px]">
                                                <span className="truncate font-medium">{link.name}</span>
                                                <span className="truncate text-xs text-muted-foreground">{link.url}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                placeholder="Heading (Optional)"
                                                value={link.heading || ''}
                                                onChange={(e) => updateLinkHeading(index, e.target.value)}
                                                className="h-8 w-32 sm:w-40 text-xs bg-background/50 transition-all border-transparent hover:border-border focus:border-blue-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeLink(index)}
                                                className="text-muted-foreground hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-500/10"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-border/40 shrink-0">
                <span className="text-xs text-muted-foreground">
                    {noteToEdit ? 'Last updated' : 'Creating new note'}
                </span>
                <div className="flex gap-2">
                    <Button variant="ghost" type="button" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isPending || !title.trim() || ((type === 'PROJECT' || type === 'TODO') && !projectId)}
                        className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] px-5"
                    >
                        {isPending ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                        ) : noteToEdit ? 'Update Note' : 'Save Note'}
                    </Button>
                </div>
            </div>
        </form>
    );
}
