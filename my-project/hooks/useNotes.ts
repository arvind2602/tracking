import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { toast } from 'sonner';
import { Note, NoteType } from '@/lib/types';

interface GetNotesParams {
    type?: NoteType | '' | 'ALL';
    projectId?: string;
    search?: string;
}

interface CreateNotePayload {
    title: string;
    content: string;
    type: NoteType;
    projectId?: string | null;
    tags?: string[];
    attachments?: {
        name: string;
        url: string;
        fileType: string;
        size?: number | null;
    }[];
}

interface UpdateNotePayload extends Partial<CreateNotePayload> { }

// Get Notes (List)
export const useGetNotes = (params?: GetNotesParams) => {
    return useQuery({
        queryKey: ['notes', params],
        queryFn: async () => {
            const { data } = await axios.get<Note[]>('/notes', {
                params: {
                    ...params,
                    type: params?.type === 'ALL' ? undefined : params?.type
                }
            });
            return data;
        },
    });
};

// Get Pinned Notes
export const useGetPinnedNotes = () => {
    return useQuery({
        queryKey: ['pinnedNotes'],
        queryFn: async () => {
            const { data } = await axios.get<Note[]>('/notes/pinned');
            return data;
        },
    });
};

// Get Single Note
export const useGetNoteById = (id: string, enabled = true) => {
    return useQuery({
        queryKey: ['note', id],
        queryFn: async () => {
            const { data } = await axios.get<Note>(`/notes/${id}`);
            return data;
        },
        enabled: !!id && enabled,
    });
};

// Create Note
export const useCreateNote = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreateNotePayload) => {
            const { data } = await axios.post<Note>('/notes', payload);
            return data;
        },
        onSuccess: () => {
            toast.success('Note created successfully');
            queryClient.invalidateQueries({ queryKey: ['notes'] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to create note');
        },
    });
};

// Update Note
export const useUpdateNote = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: UpdateNotePayload }) => {
            const { data } = await axios.put<Note>(`/notes/${id}`, payload);
            return data;
        },
        onSuccess: (data, variables) => {
            toast.success('Note updated successfully');
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            queryClient.invalidateQueries({ queryKey: ['note', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['pinnedNotes'] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to update note');
        },
    });
};

// Delete Note
export const useDeleteNote = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            await axios.delete(`/notes/${id}`);
        },
        onSuccess: () => {
            toast.success('Note deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            queryClient.invalidateQueries({ queryKey: ['pinnedNotes'] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to delete note');
        },
    });
};

// Pin Note
export const usePinNote = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, duration }: { id: string; duration: { value: number; unit: string } }) => {
            const { data } = await axios.put<Note>(`/notes/${id}/pin`, { duration });
            return data;
        },
        onSuccess: () => {
            toast.success('Note pinned successfully');
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            queryClient.invalidateQueries({ queryKey: ['pinnedNotes'] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to pin note');
        },
    });
};

// Unpin Note
export const useUnpinNote = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { data } = await axios.put<Note>(`/notes/${id}/unpin`);
            return data;
        },
        onSuccess: () => {
            toast.success('Note unpinned successfully');
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            queryClient.invalidateQueries({ queryKey: ['pinnedNotes'] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to unpin note');
        },
    });
};
