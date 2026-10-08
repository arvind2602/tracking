"use client";
import { useParams } from 'next/navigation';
import { TaskDetail } from '@/components/tasks/TaskDetail';

/**
 * Standalone task detail route. Kept for deep links, bookmarks and the
 * "Open full page" link from TaskDetailDialog — interactive clicks on task
 * names open the popup instead of navigating here.
 */
export default function TaskDetailPage() {
  const { taskId } = useParams();
  const id = Array.isArray(taskId) ? taskId[0] : taskId;

  if (!id) {
    return <div className="p-8 text-center text-muted-foreground">Task not found.</div>;
  }

  return <TaskDetail taskId={id} variant="page" />;
}
