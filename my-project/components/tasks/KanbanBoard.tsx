'use client';

import React, { useState, useEffect } from 'react';
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, User } from '@/lib/types';
import axios from '@/lib/axios';
import toast from 'react-hot-toast';
import { Calendar as CalendarIcon, Clock, User as UserIcon } from 'lucide-react';
import { formatDateTimeIST, formatDateIST } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface KanbanBoardProps {
    tasks: Task[];
    users: User[];
    onTaskUpdate: () => void;
}

const COLUMNS = [
    { id: 'pending', title: 'Pending' },
    { id: 'in-progress', title: 'In Progress' },
    { id: 'completed', title: 'Completed' },
];

export function KanbanBoard({ tasks, users, onTaskUpdate }: KanbanBoardProps) {
    const [items, setItems] = useState<{ [key: string]: Task[] }>({
        pending: [],
        'in-progress': [],
        completed: [],
    });
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        const newItems = {
            pending: tasks.filter((t) => t.status === 'pending'),
            'in-progress': tasks.filter((t) => t.status === 'in-progress'),
            completed: tasks.filter((t) => t.status === 'completed'),
        };
        setItems(newItems);
    }, [tasks]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const findContainer = (id: string) => {
        if (id in items) return id;
        return Object.keys(items).find((key) =>
            items[key].find((item) => item.id === id)
        );
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        const overId = over?.id;

        if (!overId || active.id === overId) return;

        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(overId as string);

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        setItems((prev) => {
            const activeItems = prev[activeContainer];
            const overItems = prev[overContainer];
            const activeIndex = activeItems.findIndex((item) => item.id === active.id);
            const overIndex = overItems.findIndex((item) => item.id === overId);

            let newIndex;
            if (overId in prev) {
                newIndex = overItems.length + 1;
            } else {
                const isBelowOverItem =
                    over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top > over.rect.top + over.rect.height;

                const modifier = isBelowOverItem ? 1 : 0;
                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
            }

            return {
                ...prev,
                [activeContainer]: [
                    ...prev[activeContainer].filter((item) => item.id !== active.id),
                ],
                [overContainer]: [
                    ...prev[overContainer].slice(0, newIndex),
                    activeItems[activeIndex],
                    ...prev[overContainer].slice(newIndex, prev[overContainer].length),
                ],
            };
        });
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(over?.id as string || '');

        console.log('DragEnd:', { activeId: active.id, overId: over?.id, activeContainer, overContainer });

        if (
            !activeContainer ||
            !overContainer ||
            (activeContainer === overContainer && active.id === over?.id)
        ) {
            console.log('DragEnd: Returning early');
            setActiveId(null);
            return;
        }

        // Optimistic update
        const task = tasks.find((t) => t.id === active.id);
        console.log('DragEnd: Task found:', task?.id, 'Status:', task?.status, 'OverContainer:', overContainer);

        if (task) {
            // Check if status changed
            if (task.status !== overContainer) {
                console.log('DragEnd: Status changed. Calling API...');
                // Moving to different column
                try {
                    await axios.patch(`/tasks/${active.id}/status`, { status: overContainer });
                    console.log('DragEnd: API success');
                    toast.success(`Task moved to ${COLUMNS.find(c => c.id === overContainer)?.title}`);
                    onTaskUpdate();
                } catch (error) {
                    console.error('DragEnd: API error', error);
                    toast.error('Failed to update task status');
                    onTaskUpdate(); // Revert
                }
            } else {
                console.log('DragEnd: Status same. Checking reorder...');
                // Reordering in same column
                const activeIndex = items[activeContainer].findIndex((t) => t.id === active.id);
                const overIndex = items[overContainer].findIndex((t) => t.id === over?.id);

                if (activeIndex !== overIndex) {
                    const newItems = arrayMove(items[activeContainer], activeIndex, overIndex);
                    setItems((prev) => ({
                        ...prev,
                        [activeContainer]: newItems,
                    }));

                    try {
                        const reorderedTasks = newItems.map((t, index) => ({
                            id: t.id,
                            order: index,
                        }));
                        await axios.patch('/tasks/reorder', { tasks: reorderedTasks });
                        // No toast for reordering to avoid spam
                    } catch (error) {
                        toast.error('Failed to reorder tasks');
                        onTaskUpdate(); // Revert
                    }
                }
            }
        }

        setActiveId(null);
    };

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
                },
            },
        }),
    };



    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 h-full overflow-x-auto pb-4 items-start">
                {COLUMNS.map((col) => (
                    <div key={col.id} className="flex-1 min-w-[300px] max-w-[350px] bg-muted/40 rounded-lg p-3 border border-border/60 flex flex-col max-h-full">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h3 className="font-semibold text-sm text-foreground tracking-tight flex items-center gap-2">
                                {col.title}
                                <span className="bg-background text-muted-foreground text-[10px] font-mono px-1.5 py-0.5 rounded border border-border">
                                    {items[col.id]?.length || 0}
                                </span>
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-2.5 min-h-0 custom-scrollbar">
                            <SortableContext
                                items={items[col.id]?.map((t) => t.id) || []}
                                strategy={verticalListSortingStrategy}
                            >
                                {items[col.id]?.map((task) => (
                                    <SortableItem key={task.id} task={task} users={users} />
                                ))}
                            </SortableContext>
                        </div>
                    </div>
                ))}
            </div>
            <DragOverlay dropAnimation={dropAnimation}>
                {activeId ? (
                    <TaskCard task={tasks.find((t) => t.id === activeId)!} users={users} isOverlay />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

function SortableItem({ task, users }: { task: Task; users: User[] }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <TaskCard task={task} users={users} />
        </div>
    );
}

function TaskCard({ task, users, isOverlay }: { task: Task; users: User[]; isOverlay?: boolean }) {
    const assignedUser = users.find(u => u.id === task.assignedTo);
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

    const priorityConfig = {
        LOW: { color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700' },
        MEDIUM: { color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
        HIGH: { color: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400', border: 'border-red-200 dark:border-red-800' }
    };

    const config = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.MEDIUM;

    return (
        <div
            className={`
                group bg-card p-3 rounded-md border shadow-sm transition-all 
                hover:shadow-md hover:border-primary/40
                ${isOverlay ? 'cursor-grabbing shadow-xl scale-105 ring-2 ring-primary/20 rotate-2' : 'cursor-grab'}
                ${config.border}
            `}
        >
            <div className="flex justify-between items-start gap-2 mb-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${config.color} border border-transparent`}>
                    {task.priority || 'MEDIUM'}
                </span>
                {task.points !== null && (
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {task.points} pts
                    </span>
                )}
            </div>

            <p className="text-sm font-medium text-foreground mb-3 line-clamp-3 leading-snug">
                {task.description}
            </p>

            <div className="flex justify-between items-center pt-2 border-t border-border/40 mt-auto">
                <div className="flex items-center gap-1.5 min-w-0">
                    {assignedUser ? (
                        <div className="flex items-center gap-1.5" title={`${assignedUser.firstName} ${assignedUser.lastName}`}>
                            <div className="h-5 w-5 rounded bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold ring-1 ring-background">
                                {assignedUser.firstName.charAt(0)}{assignedUser.lastName.charAt(0)}
                            </div>
                            <span className="text-xs text-muted-foreground truncate max-w-[60px]">
                                {assignedUser.firstName}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <UserIcon className="h-3.5 w-3.5" />
                            <span className="text-xs">Unassigned</span>
                        </div>
                    )}
                </div>

                {task.dueDate && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    className={`flex items-center gap-1 text-[10px] cursor-help w-fit ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}
                                >
                                    <CalendarIcon className="h-3 w-3" />
                                    <span>{formatDateIST(task.dueDate)}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{formatDateTimeIST(task.dueDate)}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </div>
    );
}
