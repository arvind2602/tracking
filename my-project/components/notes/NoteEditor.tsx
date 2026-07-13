import { Note, NoteAttachment, NoteType, Project, User } from '@/lib/types';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useCreateNote, useUpdateNote, usePinNote } from '@/hooks/useNotes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Paperclip, Loader2, X, Tag, ChevronDown, Check, Plus, Trash2, Link as LinkIcon, Briefcase } from 'lucide-react';
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
        <div className="flex flex-col bg-card rounded-xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 space-y-4">
                {/* Title and Close */}
                <div className="flex items-start justify-between gap-4">
                    <Input
                        placeholder="Title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        autoFocus
                        className="border-none shadow-none focus-visible:ring-0 text-lg font-semibold bg-transparent p-0 h-auto"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 rounded-full shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Content Points */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {points.map((point, index) => (
                        <div key={index} className="flex items-start gap-2 group">
                            <div className="mt-2.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                            <Textarea
                                value={point}
                                onChange={(e) => updatePoint(index, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.shiftKey) {
                                        e.preventDefault();
                                        addPoint();
                                    }
                                }}
                                placeholder="Note content..."
                                className="border-none shadow-none focus-visible:ring-0 text-sm bg-transparent p-0 min-h-[24px] resize-none leading-relaxed"
                                rows={1}
                                autoFocus={index === points.length - 1 && index > 0}
                                onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = `${target.scrollHeight}px`;
                                }}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removePoint(index)}
                                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={addPoint}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors pl-3.5 py-1"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add point
                    </button>
                </div>

                {/* Metadata & Actions Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                    {/* Note Type */}
                    <Select value={type} onValueChange={(val: NoteType) => setType(val)}>
                        <SelectTrigger className="h-8 w-auto gap-2 border-none bg-muted/50 hover:bg-muted text-xs rounded-full px-3">
                            <div className={cn("w-2 h-2 rounded-full",
                                type === 'PERSONAL' ? 'bg-emerald-500' :
                                    type === 'ORGANIZATIONAL' ? 'bg-amber-500' :
                                        type === 'PROJECT' ? 'bg-indigo-500' : 'bg-rose-500'
                            )} />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="PERSONAL">Personal</SelectItem>
                            {(isAdmin || type === 'ORGANIZATIONAL') && <SelectItem value="ORGANIZATIONAL">Org</SelectItem>}
                            <SelectItem value="PROJECT">Project</SelectItem>
                            <SelectItem value="TODO">Todo</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Project Selector */}
                    {(type === 'PROJECT' || type === 'TODO') && (
                        <Select value={projectId} onValueChange={setProjectId}>
                            <SelectTrigger className="h-8 w-auto gap-2 border-none bg-muted/50 hover:bg-muted text-xs rounded-full px-3">
                                <Briefcase className="h-3.5 w-3.5 opacity-60" />
                                <SelectValue placeholder="Select Project" />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}

                    {/* Tag People Popover */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0">
                                <Tag className="h-3.5 w-3.5 opacity-60" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2 z-[120]" align="start">
                            <Input
                                placeholder="Search people..."
                                value={employeeSearch}
                                onChange={(e) => setEmployeeSearch(e.target.value)}
                                className="h-8 text-xs mb-2"
                            />
                            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                                {filteredEmployees.map(emp => (
                                    <div
                                        key={emp.id}
                                        onClick={() => toggleTag(emp.id)}
                                        className={cn("flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-xs",
                                            tags.includes(emp.id) ? "bg-primary/10 text-primary" : "hover:bg-muted")}
                                    >
                                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                            {emp.firstName?.charAt(0)}
                                        </div>
                                        <span className="truncate">{emp.firstName} {emp.lastName}</span>
                                        {tags.includes(emp.id) && <Check className="h-3 w-3 ml-auto" />}
                                    </div>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Attachments & Links */}
                    <div className="flex items-center gap-1">
                        <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 w-8 rounded-full p-0">
                            <Paperclip className="h-3.5 w-3.5 opacity-60" />
                        </Button>
                        <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0">
                                    <LinkIcon className="h-3.5 w-3.5 opacity-60" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-3 z-[120]" align="start">
                                <div className="space-y-3">
                                    <Input placeholder="URL" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} className="h-8 text-xs" />
                                    <Input placeholder="Name" value={newLinkName} onChange={(e) => setNewLinkName(e.target.value)} className="h-8 text-xs" />
                                    <Button size="sm" onClick={handleAddLink} className="w-full h-8 text-xs">Add Link</Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="flex-1" />

                    <Button
                        onClick={handleSubmit}
                        disabled={isPending || !title.trim()}
                        className="h-9 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all"
                    >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Done'}
                    </Button>
                </div>

                {/* Tags, Attachments, Links List */}
                {(tags.length > 0 || attachments.length > 0 || links.length > 0) && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/20">
                        {tags.map(id => {
                            const emp = employees.find(e => e.id === id);
                            return emp && (
                                <Badge key={id} variant="secondary" className="bg-primary/5 text-primary border-none gap-1 py-1">
                                    @{emp.firstName}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => toggleTag(id)} />
                                </Badge>
                            );
                        })}
                        {attachments.map((att, i) => (
                            <Badge key={i} variant="outline" className="gap-1 py-1">
                                <Paperclip className="h-3 w-3 opacity-60" />
                                {att.name}
                                <X className="h-3 w-3 cursor-pointer" onClick={() => removeAttachment(i)} />
                            </Badge>
                        ))}
                        {links.map((link, i) => (
                            <Badge key={i} variant="outline" className="gap-1 py-1">
                                <LinkIcon className="h-3 w-3 opacity-60" />
                                {link.name}
                                <X className="h-3 w-3 cursor-pointer" onClick={() => removeLink(i)} />
                            </Badge>
                        ))}
                    </div>
                )}
            </div>
        </div>

    );
}
