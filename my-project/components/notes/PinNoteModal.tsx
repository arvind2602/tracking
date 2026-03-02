import { useState } from 'react';
import { usePinNote } from '@/hooks/useNotes';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface Props {
    noteId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PinNoteModal({ noteId, open, onOpenChange }: Props) {
    const pinNote = usePinNote();
    const [durationValue, setDurationValue] = useState('1');
    const [durationUnit, setDurationUnit] = useState('forever');

    const handlePin = () => {
        if (!noteId) return;
        pinNote.mutate(
            { id: noteId, duration: { value: Number(durationValue), unit: durationUnit } },
            { onSuccess: () => onOpenChange(false) }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Pin Note</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                    <p className="text-sm text-muted-foreground">
                        How long should this note remain pinned?
                    </p>
                    <div className="flex gap-2">
                        <Select value={durationUnit} onValueChange={setDurationUnit}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Duration" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="hours">Hours</SelectItem>
                                <SelectItem value="weeks">Weeks</SelectItem>
                                <SelectItem value="months">Months</SelectItem>
                                <SelectItem value="forever">Forever</SelectItem>
                            </SelectContent>
                        </Select>
                        {durationUnit !== 'forever' && (
                            <Input
                                type="number"
                                min="1"
                                value={durationValue}
                                onChange={(e) => setDurationValue(e.target.value)}
                                className="flex-1"
                            />
                        )}
                    </div>
                    <Button onClick={handlePin} disabled={pinNote.isPending}>
                        Confirm Pin
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
