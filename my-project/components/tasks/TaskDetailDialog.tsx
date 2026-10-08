'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskDetail } from '@/components/tasks/TaskDetail';

interface TaskDetailDialogProps {
  /** Task to show; `null` closes the dialog. */
  taskId: string | null;
  onClose: () => void;
}

/**
 * Popup version of the task detail page. Parent Task / Subtask links swap the
 * task shown inside this dialog (via internal state) instead of navigating —
 * the owning component only ever sets/clears `taskId`.
 */
export function TaskDetailDialog({ taskId, onClose }: TaskDetailDialogProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(taskId);

  // Sync only when a task is opened so the content stays mounted during the
  // close animation (clearing it here would blank the dialog mid-fade).
  useEffect(() => {
    if (taskId) setActiveTaskId(taskId);
  }, [taskId]);

  return (
    <Dialog open={!!taskId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 shrink-0 border-b border-border/50 px-6 pt-5 pb-4 pr-14">
          <DialogTitle className="text-base sm:text-lg font-semibold truncate">Task details</DialogTitle>
          {activeTaskId && (
            <a
              href={`/dashboard/tasks/${activeTaskId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open full page"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Open full page
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </DialogHeader>

        <div className="overflow-y-auto px-5 sm:px-6 py-5 flex-1 min-h-0">
          {activeTaskId && (
            <TaskDetail
              taskId={activeTaskId}
              variant="dialog"
              onOpenTask={setActiveTaskId}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
