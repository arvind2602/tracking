import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  CollisionDetection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  useDroppable,
  useDndContext,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Inbox, CheckCircle2, Plus, Circle, Clock, ClipboardCheck } from 'lucide-react';
import axios from '@/lib/axios';
import toast from 'react-hot-toast';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';

interface Task {
  id: string;
  description: string;
  status: string;
  points: number;
  assignedToName: string;
  createdAt: string;
  updatedAt: string;
}

const COLUMNS = {
  TODO: { id: 'todo', title: 'To Do', icon: Inbox, color: 'bg-slate-500' },
  PENDING: { id: 'pending', title: 'Pending', icon: Circle, color: 'bg-amber-500' },
  IN_PROGRESS: { id: 'in_progress', title: 'In Progress', icon: Clock, color: 'bg-blue-500' },
  IN_REVIEW: { id: 'in_review', title: 'In Review', icon: ClipboardCheck, color: 'bg-purple-500' },
  COMPLETED: { id: 'completed', title: 'Completed', icon: CheckCircle2, color: 'bg-emerald-500' }
};

type ColumnId = 'todo' | 'pending' | 'in_progress' | 'in_review' | 'completed';
const COLUMN_IDS: ColumnId[] = ['todo', 'pending', 'in_progress', 'in_review', 'completed'];

// Canonical status sent to the API per column
const STATUS_BY_COLUMN: Record<ColumnId, string> = {
  todo: 'todo',
  pending: 'pending',
  in_progress: 'in-progress',
  in_review: 'pending-review',
  completed: 'completed',
};

// Handles all status variants in the DB (TODO, in_progress, done, pending-review, ...)
function statusToColumn(status: string): ColumnId | null {
  const s = (status || '').toLowerCase();
  if (s === 'todo') return 'todo';
  if (s === 'pending') return 'pending';
  if (s === 'in-progress' || s === 'in_progress') return 'in_progress';
  if (s === 'pending-review' || s === 'pending_review') return 'in_review';
  if (s === 'completed' || s === 'done') return 'completed';
  return null;
}

type Items = Record<ColumnId, Task[]>;

function deriveItems(tasks: Task[]): Items {
  const items: Items = { todo: [], pending: [], in_progress: [], in_review: [], completed: [] };
  for (const t of tasks) {
    const col = statusToColumn(t.status);
    if (col) items[col].push(t);
  }
  return items;
}

function findContainerIn(items: Items, id: string): ColumnId | null {
  if ((COLUMN_IDS as string[]).includes(id)) return id as ColumnId;
  return COLUMN_IDS.find(c => items[c].some(t => t.id === id)) || null;
}

// closestCorners measures the dragged card's corners, which misresolves drops
// onto empty columns (nearest corner often belongs to a source-column card).
// pointerWithin tests the actual pointer instead; closestCorners stays as the
// keyboard-drag fallback (no pointer coordinates).
const kanbanCollision: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCorners(args);

export function KanbanBoard({ tasks, onTaskMove, onAddTask }: { tasks: Task[], onTaskMove: (taskId: string, newStatus: string) => void, onAddTask?: () => void }) {
  const [items, setItems] = useState<Items>(() => deriveItems(tasks));
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);

  useEffect(() => { setItems(deriveItems(tasks)); }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  // Live transfer between columns while dragging
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    setItems(prev => {
      const activeCol = findContainerIn(prev, activeId);
      const overCol = findContainerIn(prev, overId);
      if (!activeCol || !overCol || activeCol === overCol) return prev;

      const moving = prev[activeCol].find(t => t.id === activeId);
      if (!moving) return prev;

      const target = [...prev[overCol]];
      let index = target.length;
      if (overId !== overCol) {
        const overIndex = target.findIndex(t => t.id === overId);
        if (overIndex >= 0) {
          const isBelow = active.rect.current.translated &&
            active.rect.current.translated.top > over.rect.top + over.rect.height;
          index = overIndex + (isBelow ? 1 : 0);
        }
      }
      target.splice(index, 0, moving);

      return {
        ...prev,
        [activeCol]: prev[activeCol].filter(t => t.id !== activeId),
        [overCol]: target,
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    // Reset any live-transfer mutations from handleDragOver
    const fresh = deriveItems(tasks);
    setItems(fresh);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeTaskData = tasks.find(t => t.id === activeId);
    if (!activeTaskData) return;

    // Drop target resolved against live items (active task may have been transferred)
    const overCol = findContainerIn(items, overId);
    if (!overCol) return;

    const originalCol = statusToColumn(activeTaskData.status);

    if (originalCol && originalCol !== overCol) {
      // Cross-column: parent persists status + optimistic update
      onTaskMove(activeId, STATUS_BY_COLUMN[overCol]);
      return;
    }

    // Same-column reorder
    if (overId === activeId) return;
    const col = fresh[originalCol!];
    const from = col.findIndex(t => t.id === activeId);
    const to = col.findIndex(t => t.id === overId);
    if (from < 0 || to < 0) return;

    const reordered = arrayMove(col, from, to);
    setItems({ ...fresh, [originalCol!]: reordered });
    axios.patch('/tasks/reorder', {
      tasks: reordered.map((t, i) => ({ id: t.id, order: i })),
    }).catch(() => toast.error('Failed to reorder'));
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={kanbanCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-5 h-full min-h-[650px]">
          {Object.entries(COLUMNS).map(([, col]) => (
            <Column
              key={col.id}
              col={col}
              tasks={items[col.id as ColumnId] || []}
              onAddTask={onAddTask}
              onTaskClick={setPreviewTaskId}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      <TaskDetailDialog taskId={previewTaskId} onClose={() => setPreviewTaskId(null)} />
    </>
  );
}

function Column({ col, tasks, onAddTask, onTaskClick }: { col: any, tasks: Task[], onAddTask?: () => void, onTaskClick?: (taskId: string) => void }) {
  const Icon = col.icon;
  const { setNodeRef } = useDroppable({
    id: col.id,
    data: { type: 'Column', column: col }
  });
  // Highlight when over the column itself OR any card inside it
  const { over } = useDndContext();
  const isTargeted = !!over && (over.id === col.id || tasks.some(t => t.id === over.id));

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col bg-muted/20 rounded-xl overflow-hidden border transition-shadow ${isTargeted ? 'border-primary ring-2 ring-primary/50' : 'border-border/50'}`}
    >
      <div className={`flex items-center gap-2 px-4 py-3 ${col.color} text-white font-semibold text-sm shadow-sm`}>
        <Icon className="h-4 w-4" />
        {col.title}
        <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-xs">{tasks.length}</span>
      </div>

      <SortableContext
        id={col.id}
        items={tasks.map(t => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar min-h-[150px]">
          {tasks.map(task => (
            <SortableTask key={task.id} task={task} onTaskClick={onTaskClick} />
          ))}
          {col.id !== 'completed' && onAddTask && (
            <button
              type="button"
              onClick={onAddTask}
              aria-label={`Add task to ${col.title}`}
              title={`Add task to ${col.title}`}
              className="w-10 h-10 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-primary/50 mx-auto flex items-center justify-center mt-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTask({ task, onTaskClick }: { task: Task, onTaskClick?: (taskId: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'Task', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onTaskClick={onTaskClick} />
    </div>
  );
}

function TaskCard({ task, isOverlay, onTaskClick }: { task: Task, isOverlay?: boolean, onTaskClick?: (taskId: string) => void }) {
  return (
    <div
      draggable={false}
      onDragStart={e => e.preventDefault()}
      onClick={() => { if (!isOverlay) onTaskClick?.(task.id); }}
      className={`bg-card border border-border/60 shadow-sm rounded-xl p-4 flex flex-col gap-3 group ${isOverlay ? 'shadow-xl cursor-grabbing' : 'cursor-grab hover:shadow-md hover:border-primary/30 transition-all'}`}
    >
      <h4 className="font-bold text-sm text-card-foreground group-hover:text-primary transition-colors leading-snug">
        <button
          type="button"
          draggable={false}
          className="hover:underline text-left w-full"
          onClick={(e) => { e.stopPropagation(); onTaskClick?.(task.id); }}
        >
          {task.description}
        </button>
      </h4>

      <div className="flex items-center justify-between mt-1">
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-blue-500/10 text-blue-600">
            {task.points} PTS
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-muted text-muted-foreground">
            {task.status.replace(/_/g, ' ')}
          </span>
        </div>

        {task.assignedToName && (
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 ring-2 ring-background shadow-sm" title={task.assignedToName}>
            {task.assignedToName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}
