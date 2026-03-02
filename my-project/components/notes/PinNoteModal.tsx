import { useState } from 'react';
import { usePinNote } from '@/hooks/useNotes';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Pin, Clock, Calendar } from 'lucide-react';

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
                <DialogHeader className="pb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <Pin className="h-5 w-5 text-white" />
                        </div>
                        <DialogTitle>Pin Note</DialogTitle>
                    </div>
                </DialogHeader>
                <div className="flex flex-col gap-5 py-4">
                    <p className="text-sm text-muted-foreground">
                        Choose how long this note should stay pinned at the top.
                    </p>

                    <div className="flex flex-col gap-3">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            Duration
                        </label>
                        <div className="flex gap-2">
                            <Select value={durationUnit} onValueChange={setDurationUnit}>
                                <SelectTrigger className="w-[150px] h-11">
                                    <SelectValue placeholder="Duration" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="hours">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            Hours
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="weeks">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                            Weeks
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="months">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                                            Months
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="forever">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                            Forever
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            {durationUnit !== 'forever' && (
                                <Input
                                    type="number"
                                    min="1"
                                    max="365"
                                    value={durationValue}
                                    onChange={(e) => setDurationValue(e.target.value)}
                                    className="flex-1 h-11"
                                    placeholder="Amount"
                                />
                            )}
                        </div>
                    </div>

                    {durationUnit !== 'forever' && (
                        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                            Note will be pinned for {durationValue} {durationUnit}
                        </div>
                    )}

                    <Button
                        onClick={handlePin}
                        disabled={pinNote.isPending}
                        className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
                    >
                        {pinNote.isPending ? 'Pinning...' : 'Confirm Pin'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
