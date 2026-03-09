'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Plus,
    Clock,
    Trash2,
    Edit2,
    Save,
    X,
    Loader2,
    CalendarDays,
    UserPlus,
    CheckCircle2,
    Users
} from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

async function fetchShifts() {
    const res = await axios.get('/attendance/shifts');
    return res.data;
}

async function fetchEmployees() {
    const res = await axios.get('/auth/organization/employees');
    return res.data;
}

export function ShiftManager() {
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [assigningShiftId, setAssigningShiftId] = useState<string | null>(null);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

    const [form, setForm] = useState({
        name: '',
        startTime: '09:00',
        endTime: '18:00',
        gracePeriod: 15,
        officeHours: 9
    });

    const { data: shifts, isLoading } = useQuery({
        queryKey: ['shifts'],
        queryFn: fetchShifts
    });

    const { data: employees } = useQuery({
        queryKey: ['employees'],
        queryFn: fetchEmployees
    });

    const createMutation = useMutation({
        mutationFn: (data: typeof form) => axios.post('/attendance/shifts', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
            setIsAdding(false);
            resetForm();
            toast.success('Shift created');
        },
        onError: () => toast.error('Failed to create shift')
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: typeof form }) => axios.put(`/attendance/shifts/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
            setEditingId(null);
            setIsAdding(false);
            resetForm();
            toast.success('Shift updated');
        },
        onError: () => toast.error('Failed to update shift')
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => axios.delete(`/attendance/shifts/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
            toast.success('Shift deleted');
        }
    });

    const assignMutation = useMutation({
        mutationFn: ({ shiftId, employeeIds }: { shiftId: string; employeeIds: string[] }) =>
            axios.post('/attendance/shifts/assign', { shiftId, employeeIds }),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
            setAssigningShiftId(null);
            setSelectedEmployeeIds([]);
            toast.success(res.data.message || 'Shifts assigned successfully');
        },
        onError: () => toast.error('Failed to assign shifts')
    });

    const handleEdit = (shift: any) => {
        setEditingId(shift.id);
        setForm({
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            gracePeriod: shift.gracePeriod,
            officeHours: shift.officeHours
        });
        setIsAdding(true);
    };

    const resetForm = () => {
        setForm({
            name: '',
            startTime: '09:00',
            endTime: '18:00',
            gracePeriod: 15,
            officeHours: 9
        });
        setEditingId(null);
    };

    const handleSubmit = () => {
        if (editingId) {
            updateMutation.mutate({ id: editingId, data: form });
        } else {
            createMutation.mutate(form);
        }
    };

    const toggleEmployee = (id: string) => {
        setSelectedEmployeeIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedEmployeeIds.length === employees?.length) {
            setSelectedEmployeeIds([]);
        } else {
            setSelectedEmployeeIds(employees?.map((e: any) => e.id) || []);
        }
    };

    if (isLoading) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    Shift Configuration
                </h3>
                {!isAdding && (
                    <Button onClick={() => setIsAdding(true)} className="rounded-xl flex gap-2">
                        <Plus className="w-4 h-4" />
                        New Shift
                    </Button>
                )}
            </div>

            {isAdding && (
                <div className="p-6 bg-card border border-primary/20 rounded-3xl space-y-4 animate-in zoom-in-95 duration-200">
                    <h4 className="font-bold text-foreground flex items-center gap-2">
                        {editingId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {editingId ? 'Edit Shift' : 'Create New Shift'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Shift Name</label>
                            <Input
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Morning Shift"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase">Start Time</label>
                                <Input
                                    type="time"
                                    value={form.startTime}
                                    onChange={e => setForm({ ...form, startTime: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase">End Time</label>
                                <Input
                                    type="time"
                                    value={form.endTime}
                                    onChange={e => setForm({ ...form, endTime: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Grace Period (min)</label>
                            <Input
                                type="number"
                                value={form.gracePeriod}
                                onChange={e => setForm({ ...form, gracePeriod: parseInt(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Expected Work Hours</label>
                            <Input
                                type="number"
                                value={form.officeHours}
                                onChange={e => setForm({ ...form, officeHours: parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => { setIsAdding(false); resetForm(); }}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                            {createMutation.isPending || updateMutation.isPending ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {editingId ? 'Update Shift' : 'Create Shift'}
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shifts?.map((shift: any) => (
                    <div key={shift.id} className="p-5 bg-card border border-border rounded-2xl flex justify-between items-center group hover:border-primary/30 transition-all">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <p className="font-bold text-foreground">{shift.name}</p>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${shift.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {shift.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1 font-medium">
                                    <Clock className="w-3 h-3" />
                                    {shift.startTime} - {shift.endTime}
                                </span>
                                <span className="flex items-center gap-1 font-medium">
                                    <CalendarDays className="w-3 h-3" />
                                    {shift.officeHours}h Day
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-[10px] text-amber-500 font-bold">LATE after {shift.gracePeriod} min</p>
                                <span className="text-[10px] text-muted-foreground">•</span>
                                <p className="text-[10px] text-blue-500 font-bold flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {shift.employeeCount || 0} Assigned
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <Dialog open={assigningShiftId === shift.id} onOpenChange={(open) => {
                                if (open) setAssigningShiftId(shift.id);
                                else {
                                    setAssigningShiftId(null);
                                    setSelectedEmployeeIds([]);
                                }
                            }}>
                                <DialogTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10">
                                        <UserPlus className="w-4 h-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-3xl max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="flex justify-between items-center">
                                            <span>Assign Shift: {shift.name}</span>
                                            <Badge variant="secondary" className="rounded-lg">
                                                {selectedEmployeeIds.length} Selected
                                            </Badge>
                                        </DialogTitle>
                                    </DialogHeader>

                                    <div className="space-y-4 pt-4">
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-sm font-bold text-muted-foreground uppercase">Select Employees</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-[10px] h-6 font-bold uppercase tracking-wider"
                                                onClick={toggleAll}
                                            >
                                                {selectedEmployeeIds.length === employees?.length ? 'Deselect All' : 'Select All'}
                                            </Button>
                                        </div>

                                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                            {employees?.map((emp: any) => (
                                                <div
                                                    key={emp.id}
                                                    onClick={() => toggleEmployee(emp.id)}
                                                    className={`p-3 border rounded-2xl flex items-center justify-between cursor-pointer transition-all ${selectedEmployeeIds.includes(emp.id)
                                                        ? 'bg-primary/5 border-primary/30'
                                                        : 'hover:bg-accent border-transparent'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                            {emp.firstName[0]}{emp.lastName[0]}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold">{emp.firstName} {emp.lastName}</p>
                                                            <p className="text-[10px] text-muted-foreground">{emp.position}</p>
                                                        </div>
                                                    </div>
                                                    <Switch
                                                        checked={selectedEmployeeIds.includes(emp.id)}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <Button
                                            className="w-full rounded-2xl h-12 font-bold"
                                            disabled={selectedEmployeeIds.length === 0 || assignMutation.isPending}
                                            onClick={() => assignMutation.mutate({ shiftId: shift.id, employeeIds: selectedEmployeeIds })}
                                        >
                                            {assignMutation.isPending ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                            Assign to {selectedEmployeeIds.length} Employee(s)
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                                onClick={() => handleEdit(shift)}
                            >
                                <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                onClick={() => { if (confirm('Delete shift? This will unassign it from all employees.')) deleteMutation.mutate(shift.id); }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
