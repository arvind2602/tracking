import { Note, NoteAttachment, NoteType } from '@/lib/types';
import { useState, useEffect, useRef } from 'react';
import { useCreateNote, useUpdateNote, usePinNote } from '@/hooks/useNotes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Paperclip, Loader2, X, Users, Tag, CheckSquare, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import axios from '@/lib/axios';
import { cn } from '@/lib/utils';
import { jwtDecode } from 'jwt-decode';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';

interface Props {
    noteToEdit?: Note | null;
    onClose: () => void;
    defaultType?: NoteType;
}

export function NoteEditor({ noteToEdit, onClose, defaultType = 'PERSONAL' }: Props) {
    const createNote = useCreateNote();
    const updateNote = useUpdateNote();

    const [title, setTitle] = useState(noteToEdit?.title || '');
    const [content, setContent] = useState(noteToEdit?.content || '');
    const [type, setType] = useState<NoteType>(noteToEdit?.type || defaultType);
    const [projectId, setProjectId] = useState<string>(noteToEdit?.projectId || '');

    // Remote data
    const [projects, setProjects] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const filteredEmployees = employees.filter(emp =>
        (emp.firstName + ' ' + emp.lastName + ' ' + emp.email).toLowerCase().includes(employeeSearch.toLowerCase())
    );

    // Tagging
    const [tags, setTags] = useState<string[]>(noteToEdit?.tags?.map(t => t.employeeId) || []);

    const [attachments, setAttachments] = useState<NoteAttachment[]>(noteToEdit?.attachments || []);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Pinning configuration (Creation only)
    const pinNote = usePinNote();
    const [isPinned, setIsPinned] = useState(false);
    const [pinDurationValue, setPinDurationValue] = useState('1');
    const [pinDurationUnit, setPinDurationUnit] = useState('forever');

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

    useEffect(() => {
        if (type === 'PROJECT') {
            axios.get('/projects').then(res => setProjects(res.data));
        }
    }, [type]);

    useEffect(() => {
        axios.get('/auth/organization').then(res => setEmployees(res.data));
    }, []);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const formData = new FormData();

        try {
            const processFile = async (file: File) => {
                // If it's an image and larger than 1MB, compress it
                if (file.type.startsWith('image/') && file.size > 1024 * 1024) {
                    try {
                        const options = {
                            maxSizeMB: 1,          // Target max size 1MB to be safe
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

                // If it's NOT an image, we cannot compress it in browser.
                // Check if it exceeds Cloudinary's 10MB free tier hard-limit.
                if (!file.type.startsWith('image/') && file.size > 10 * 1024 * 1024) {
                    throw new Error(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Documents must be under 10MB.`);
                }

                return file;
            };

            // Process all selected files sequentially/parallel
            const processedFiles = await Promise.all(
                Array.from(files).map(file => processFile(file))
            );

            // Append processed files
            processedFiles.forEach((file) => {
                formData.append('files', file);
            });

            const { data } = await axios.post('/notes/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // data should be an array of objects
            setAttachments((prev) => [...prev, ...data]);
        } catch (error: any) {
            console.error('Failed to upload files', error);
            if (error.response?.data?.message) {
                toast.error(error.response.data.message);
            } else if (error.message) {
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

    const removeAttachment = (indexToRemove: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== indexToRemove));
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

        const payload = {
            title,
            content,
            type,
            projectId: type === 'PROJECT' ? projectId : null,
            tags: tags,
            attachments: attachments.map(a => ({
                name: a.name,
                url: a.url,
                fileType: a.fileType,
                size: a.size
            }))
        };

        if (noteToEdit) {
            updateNote.mutate({ id: noteToEdit.id, payload }, { onSuccess: onClose });
        } else {
            createNote.mutate(payload as any, {
                onSuccess: (data: any) => {
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5 border border-border/60 rounded-2xl bg-card/80 backdrop-blur-md shadow-lg">
            <h3 className="font-semibold text-lg text-foreground tracking-tight">{noteToEdit ? 'Edit Note' : 'Create Note'}</h3>

            <div className="space-y-3">
                <Input
                    placeholder="Note Title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    autoFocus
                    required
                    className="bg-background/50 border-border/50 focus-visible:ring-1 text-base font-medium"
                />

                <div className="flex gap-2">
                    <div className="flex-1">
                        <Select value={type} onValueChange={(val: NoteType) => setType(val)}>
                            <SelectTrigger className="bg-background/50 border-border/50">
                                <SelectValue placeholder="Note Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PERSONAL">Personal</SelectItem>
                                {(isAdmin || type === 'ORGANIZATIONAL') && <SelectItem value="ORGANIZATIONAL">Organizational</SelectItem>}
                                <SelectItem value="PROJECT">Project</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {type === 'PROJECT' && (
                        <div className="flex-1 animate-in fade-in zoom-in-95 duration-200">
                            <Select value={projectId} onValueChange={setProjectId} required>
                                <SelectTrigger className="bg-background/50 border-border/50">
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

                {!noteToEdit && (
                    <div className="flex flex-col gap-2 p-3 bg-background/30 rounded-lg border border-border/40">
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isPinned}
                                onChange={(e) => setIsPinned(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            Pin Note?
                        </label>
                        {isPinned && (
                            <div className="flex gap-2 animate-in slide-in-from-top-2">
                                <Select value={pinDurationUnit} onValueChange={setPinDurationUnit}>
                                    <SelectTrigger className="w-[140px] h-8 text-xs bg-background">
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
                                        className="h-8 max-w-[80px] text-xs"
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap gap-2 items-center">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" type="button" className="h-8 gap-1.5 border-dashed bg-background/30 hover:bg-background/60">
                                <Tag className="h-3.5 w-3.5" />
                                <span>Tag People</span>
                                {tags.length > 0 && (
                                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-blue-500/10 text-blue-500">{tags.length}</Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2 z-[300]" align="start">
                            <div className="flex flex-col gap-2 mb-2 px-1">
                                <div className="text-sm font-medium text-muted-foreground">Select Employees</div>
                                <Input
                                    placeholder="Search employees..."
                                    value={employeeSearch}
                                    onChange={(e) => setEmployeeSearch(e.target.value)}
                                    className="h-8 text-xs bg-background/50"
                                />
                            </div>
                            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar">
                                {filteredEmployees.length === 0 ? (
                                    <div className="p-2 text-xs text-center text-muted-foreground">No users found</div>
                                ) : (
                                    filteredEmployees.map(emp => {
                                        const isChecked = tags.includes(emp.id);
                                        return (
                                            <div
                                                key={emp.id}
                                                onClick={() => toggleTag(emp.id)}
                                                className={cn(
                                                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border",
                                                    isChecked ? "bg-blue-500/10 border-blue-500/30" : "hover:bg-muted/50 border-transparent"
                                                )}
                                            >
                                                <div className={cn("flex items-center justify-center shrink-0 w-4 h-4 rounded border transition-colors", isChecked ? "bg-blue-500 border-blue-500 text-white" : "border-muted-foreground/50")}>
                                                    {isChecked && <svg width="10" height="10" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium leading-none">{emp.firstName} {emp.lastName}</span>
                                                    <span className="text-xs text-muted-foreground mt-0.5">{emp.email}</span>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {tags.map(id => {
                                const emp = employees.find((e: any) => e.id === id);
                                if (!emp) return null;
                                return (
                                    <Badge key={id} variant="secondary" className="text-[10px] h-6 px-2 bg-blue-500/10 text-blue-600 border border-blue-500/20 pr-1 flex items-center gap-1">
                                        @{emp.firstName}
                                        <button
                                            type="button"
                                            onClick={() => toggleTag(id)}
                                            className="hover:bg-blue-500/20 rounded-full p-0.5 transition-colors"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                );
                            })}
                        </div>
                    )}
                </div>

                <Textarea
                    placeholder="Write your note here..."
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="min-h-[160px] resize-y bg-background/50 border-border/50 text-sm leading-relaxed"
                />

                <div className="flex flex-col gap-2">
                    <div className="flex items-center">
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
                            className="h-8 gap-1.5 bg-background/30"
                        >
                            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                            <span>Attach Files</span>
                        </Button>
                    </div>

                    {attachments.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-2">
                            {attachments.map((att, index) => (
                                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/40 text-sm">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="truncate">{att.name}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(index)}
                                        className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 p-1"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
                <Button variant="ghost" type="button" onClick={onClose} disabled={isPending}>Cancel</Button>
                <Button
                    type="submit"
                    disabled={isPending || (!title.trim()) || (type === 'PROJECT' && !projectId)}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md transition-all px-6"
                >
                    {isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                    ) : 'Save Note'}
                </Button>
            </div>
        </form>
    );
}
