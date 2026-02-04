import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Task, User, Project } from "@/lib/types";
import axios from "@/lib/axios";
import toast from "react-hot-toast";
import { useState, useEffect, useMemo } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { formatDateTimeIST, formatDateIST, formatDateLongIST, formatDateOnlyIST, cn } from "@/lib/utils";
import { Loader, Calendar as CalendarIcon, Copy, Check, User as UserIcon, Trash2, Download, ChevronRight, ChevronDown, Plus, CornerDownRight, Clock, CalendarClock, Play, X, Pencil } from "lucide-react";

import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import React from 'react';
import ReactDOM from 'react-dom';
import { AddTaskForm } from "./AddTaskForm";

import { jwtDecode } from 'jwt-decode';
import { useRouter } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AllTasksProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  itemsPerPage?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  onSort?: (column: string) => void;
}

export default function AllTasks({ tasks, users, projects, setTasks, currentPage, totalPages, onPageChange, itemsPerPage, sortBy, sortOrder, onSort }: AllTasksProps) {
  const router = useRouter();
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [copiedDate, setCopiedDate] = useState<string | null>(null);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());
  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
  const [parentTaskForSubtask, setParentTaskForSubtask] = useState<Task | null>(null);
  const [loadingAddSubtaskId, setLoadingAddSubtaskId] = useState<string | null>(null);
  const [groupingType, setGroupingType] = useState<'assignedDate' | 'dueDate'>('assignedDate');


  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<string | null>(null);
  const [completionComment, setCompletionComment] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const [actionType, setActionType] = useState<'complete' | 'submit-review' | 'approve'>('complete');
  const [editedPoints, setEditedPoints] = useState<number>(0);

  // In Progress Modal State
  const [inProgressModalOpen, setInProgressModalOpen] = useState(false);
  const [taskToInProgress, setTaskToInProgress] = useState<string | null>(null);
  const [inProgressComment, setInProgressComment] = useState("");
  const [isInProgressSetting, setIsInProgressSetting] = useState(false);

  const toggleExpand = (taskId: string) => {
    const newCollapsed = new Set(collapsedTasks);
    if (newCollapsed.has(taskId)) {
      newCollapsed.delete(taskId);
    } else {
      newCollapsed.add(taskId);
    }
    setCollapsedTasks(newCollapsed);
  };

  const handleAddSubtask = (parentTask: Task) => {
    setLoadingAddSubtaskId(parentTask.id);
    setParentTaskForSubtask(parentTask);
    setSubtaskModalOpen(true);
    // Don't clear loader yet, wait for modal close
  };

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload: any = jwtDecode(token);
        setUserRole(payload.user.role);
        // Correct field name is uuid based on jwtGenerator.js
        setCurrentUserId(payload.user.uuid || payload.user.id);
      } catch (error) {
        console.error('Invalid token', error);
      }
    }
  }, []);

  const initiateDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId);
    setDeleteModalOpen(true);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;

    const toastId = toast.loading("Deleting...");
    try {
      await axios.delete(`/tasks/${taskToDelete}`);
      setTasks((prev) => prev.map(t => ({
        ...t,
        subtasks: t.subtasks ? t.subtasks.filter(st => st.id !== taskToDelete) : []
      })).filter((t) => t.id !== taskToDelete));
      toast.success("Task deleted", { id: toastId });
    } catch {
      toast.error("Failed to delete", { id: toastId });
    } finally {
      toast.dismiss(toastId);
      setTaskToDelete(null);
    }
  };

  const handleAssignClick = async (task: Task) => {
    setLoadingTaskId(task.id);
    setSelectedTask(task);
    setIsAssignModalOpen(true);
    setLoadingTaskId(null);
  };

  const handleAssignUser = async (userId: string | undefined) => {
    if (!selectedTask) return;
    setIsAssigning(true);
    const toastId = toast.loading("Assigning task...");
    try {
      const response = await axios.put(`/tasks/assign/${selectedTask.id}`, { assignedTo: userId });
      setTasks((prev) =>
        prev.map((task) => (task.id === selectedTask.id ? response.data : task))
      );

      setIsAssignModalOpen(false);
      setSelectedTask(null);
    } catch {
      toast.error("Failed to assign task", { id: toastId });
    } finally {
      setIsAssigning(false);
      toast.dismiss(toastId);
    }
  };

  const handleExportTasks = async () => {
    const toastId = toast.loading("Exporting tasks...");
    try {
      const response = await axios.get('/tasks/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'tasks.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Tasks exported successfully", { id: toastId });

    } catch (error) {
      toast.error("Failed to export tasks", { id: toastId });
    }
  };

  const handleMarkAsCompleted = (task: Task) => {
    setTaskToComplete(task.id);
    setCompletionComment("");

    // Determine Action Type based on Status
    if (task.status === 'pending-review') {
      setActionType('approve');
      setEditedPoints(task.points || 0);
    } else if (task.status === 'in-progress' || task.status === 'pending') {
      // If user is the assignee, they submit for review. 
      // Note: logic assumes user can only act on their tasks. 
      // We can refine this if needed, but for now 'complete' button triggers review if flow dictates.
      // The user request implies checking is mandatory.
      setActionType('submit-review');
    } else {
      setActionType('complete'); // Fallback
    }

    setCompletionModalOpen(true);
  };

  const confirmCompletion = async () => {
    if (!taskToComplete) return;
    if (!completionComment.trim()) {
      toast.error("Please add a comment.");
      return;
    }

    setIsCompleting(true);
    setLoadingTaskId(taskToComplete);
    try {
      // 1. Add Comment
      await axios.post(`/tasks/comments/${taskToComplete}`, { content: completionComment });

      // 2. Perform Action
      let status = 'completed';
      if (actionType === 'submit-review') status = 'pending-review';

      const response = await axios.put(`/tasks/${taskToComplete}/status`, { status });

      // 3. Update Points if Approved and Changed
      let updatedTaskData = response.data;
      if (actionType === 'approve' && editedPoints !== undefined) {
        // Find original task points to compare (optional optimization)
        const currentTask = tasks.find(t => t.id === taskToComplete);
        if (currentTask && currentTask.points !== editedPoints) {
          const uRes = await axios.put(`/tasks/${taskToComplete}`, { points: editedPoints });
          updatedTaskData = uRes.data;
        }
      }

      setTasks(prev => prev.map(t => {
        if (t.id === taskToComplete) {
          return { ...t, ...updatedTaskData };
        }
        if (t.subtasks) {
          const updatedSubtasks = t.subtasks.map(s => s.id === taskToComplete ? { ...s, ...updatedTaskData } : s);
          return { ...t, subtasks: updatedSubtasks };
        }
        return t;
      }));

      const message = actionType === 'submit-review' ? "Submitted for review!" : "Task approved and completed!";
      toast.success(message);
      setCompletionModalOpen(false);
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task.");
    } finally {
      setIsCompleting(false);
      setLoadingTaskId(null);
      setTaskToComplete(null);
    }
  };

  const handleMarkAsInProgress = (taskId: string) => {
    setTaskToInProgress(taskId);
    setInProgressComment("");
    setInProgressModalOpen(true);
  };

  const confirmInProgress = async () => {
    if (!taskToInProgress) return;
    if (!inProgressComment.trim()) {
      toast.error("Please add a comment to mark the task as in-progress.");
      return;
    }

    setIsInProgressSetting(true);
    setLoadingTaskId(taskToInProgress);
    try {
      // 1. Add Comment
      await axios.post(`/tasks/comments/${taskToInProgress}`, { content: inProgressComment });

      // 2. Mark as In Progress
      const response = await axios.put(`/tasks/${taskToInProgress}/status`, { status: "in-progress" });

      setTasks(prev => prev.map(t => {
        if (t.id === taskToInProgress) {
          return { ...t, ...response.data };
        }
        if (t.subtasks) {
          const updatedSubtasks = t.subtasks.map(s => s.id === taskToInProgress ? { ...s, ...response.data } : s);
          return { ...t, subtasks: updatedSubtasks };
        }
        return t;
      }));
      toast.success("Task marked as in-progress!");
      setInProgressModalOpen(false);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setIsInProgressSetting(false);
      setLoadingTaskId(null);
      setTaskToInProgress(null);
    }
  };

  // Function to open the task detail page
  const handleOpenTaskDetail = (task: Task) => {
    router.push(`/dashboard/tasks/${task.id}`);
  };


  /* 
  Removed Intl in favor of date-fns helper:
  const dateFormatter = useMemo(...) 
  */

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    if (!Array.isArray(tasks)) return groups;

    const safeTasks = tasks.filter(t => t && typeof t === 'object');

    safeTasks.forEach((task) => {
      let dateKey = groupingType === 'assignedDate' ? "Unassigned Date" : "No Due Date";

      // Group by assigned date or due date based on groupingType
      const dateStr = groupingType === 'assignedDate'
        ? (task.assigned_at || (task as any).startDate || task.createdAt)
        : task.dueDate;

      if (dateStr) {
        dateKey = formatDateLongIST(dateStr);
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(task);
    });

    // Apply client-side sorting only when user hasn't actively sorted by clicking column headers
    // Skip if sortBy is set to user-selected columns (description, status, priority, dueDate, points)
    const userActivelySorting = sortBy && !['createdAt', 'order'].includes(sortBy);

    if (!userActivelySorting) {
      Object.keys(groups).forEach((key) => {
        groups[key].sort((a, b) => {
          // First, sort by project priority_order (lower number = higher priority)
          const projectA = projects.find(p => p.id === a.projectId);
          const projectB = projects.find(p => p.id === b.projectId);

          const projectPriorityA = projectA?.priority_order ?? 999;
          const projectPriorityB = projectB?.priority_order ?? 999;

          if (projectPriorityA !== projectPriorityB) {
            return projectPriorityA - projectPriorityB; // Lower priority_order comes first
          }


          // 2. Sort by task priority (HIGH > MEDIUM > LOW)
          const taskPriorityMap: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };
          const taskPriorityA = taskPriorityMap[a.priority || 'LOW'] || 3;
          const taskPriorityB = taskPriorityMap[b.priority || 'LOW'] || 3;

          if (taskPriorityA !== taskPriorityB) {
            return taskPriorityA - taskPriorityB;
          }

          // 3. Sort by due date (earlier dates first, null dates last)
          const dueDateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dueDateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;

          if (dueDateA !== dueDateB) {
            return dueDateA - dueDateB;
          }

          // 4. Sort by createdAt (newest first)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      });
    }

    return groups;
  }, [tasks, projects, sortBy, groupingType]);

  const sortedDateKeys = useMemo(() => {
    const unassignedKey = groupingType === 'assignedDate' ? "Unassigned Date" : "No Due Date";
    return Object.keys(groupedTasks).sort((a, b) => {
      if (a === unassignedKey) return 1;
      if (b === unassignedKey) return -1;
      return new Date(b).getTime() - new Date(a).getTime();
    });
  }, [groupedTasks, groupingType]);

  const copyTaskSummary = (dateKey: string) => {
    const tasksForDate = groupedTasks[dateKey];
    const totalPoints = tasksForDate.reduce((sum, task) => sum + (task.points || 0), 0);
    const completedTasks = tasksForDate.filter(t => t.status === 'completed').length;
    const pendingTasks = tasksForDate.filter(t => t.status !== 'completed').length;
    const inProgressTasks = tasksForDate.filter(t => t.status === 'in-progress').length;

    let summary = `DAILY TASK UPDATE - ${dateKey}\n`;
    summary += `${'='.repeat(50)}\n\n`;
    summary += `SUMMARY:\n`;
    summary += `- Total Tasks: ${tasksForDate.length}\n`;
    summary += `- Completed: ${completedTasks}\n`;
    summary += `- In Progress: ${inProgressTasks}\n`;
    summary += `- Pending: ${pendingTasks}\n`;
    summary += `- Total Points: ${totalPoints}\n`;
    summary += `\n${'-'.repeat(50)}\n`;
    summary += `TASK DETAILS:\n${'-'.repeat(50)}\n\n`;

    tasksForDate.forEach((task, index) => {
      const assignedUser = users.find((u) => u.id === task.assignedTo);
      const project = projects.find((p) => p.id === task.projectId);

      summary += `${index + 1}. ${task.description}\n`;
      summary += `   Status: ${task.status?.replace('-', ' ').toUpperCase()}\n`;
      if (task.priority) summary += `   Priority: ${task.priority}\n`;
      summary += `   Assigned To: ${assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : 'Unassigned'}\n`;
      if (task.points) summary += `   Points: ${task.points}\n`;
      if (project) summary += `   Project: ${project.name}\n`;
      if (task.dueDate) summary += `   Due Date: ${formatDateTimeIST(task.dueDate)}\n`;
      summary += `\n`;
    });

    summary += `${'-'.repeat(50)}\n`;
    summary += `End of Report\n`;

    navigator.clipboard.writeText(summary).then(() => {
      setCopiedDate(dateKey);
      toast.success('Task summary copied to clipboard!');
      setTimeout(() => setCopiedDate(null), 2000);
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  const modalContent = isAssignModalOpen && selectedTask && (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999]">
      <div className="bg-card/80 backdrop-blur-lg p-8 rounded-2xl shadow-xl w-full max-w-md border border-accent/20 z-[10000] relative">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Assign Task: {selectedTask.description}
        </h2>
        <Command className="border border-accent/20 rounded-lg">
          <CommandInput placeholder="Search users..." disabled={isAssigning} />
          <CommandList className="max-h-60">
            {isAssigning ? (
              <div className="flex justify-center items-center h-full">
                <Loader className="animate-spin h-8 w-8 text-accent" />
              </div>
            ) : (
              <>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {users.map((user) => (
                    <CommandItem
                      key={user.id}
                      onSelect={() => handleAssignUser(user.id)}
                      className="cursor-pointer"
                      disabled={isAssigning}
                    >
                      {user.firstName} {user.lastName} ({user.email})
                    </CommandItem>
                  ))}
                  <CommandItem onSelect={() => handleAssignUser(undefined)} className="cursor-pointer" disabled={isAssigning}>
                    Unassign Task
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={() => setIsAssignModalOpen(false)} disabled={isAssigning}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  const subtaskModalContent = subtaskModalOpen && parentTaskForSubtask && (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999]">
      <div className="bg-card border border-border p-8 rounded-[2rem] shadow-2xl w-full max-w-lg animate-in zoom-in duration-300 relative z-[10000]">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-foreground tracking-tight">
            Add Subtask
          </h2>
          <button
            onClick={() => setSubtaskModalOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-8 w-8 rotate-45" />
          </button>
        </div>
        <AddTaskForm
          users={users}
          projects={projects}
          onTaskAdded={() => {
            // We need to trigger a refresh. Since AllTasks doesn't own the fetch function directly 
            // but setTasks updates local state, we might need a full refresh from parent. 
            // Ideally AllTasks should accept an `onRefresh` prop.
            // For now, let's assume the parent will refresh or we can try to hack it.
            // Wait, AllTasks receives `setTasks`. But adding a subtask requires re-fetching to get the structure.
            // We will reload the page for now or better, ask user to pass a refresh callback.
            // *Self-correction*: The implementation plan didn't enforce a refresh callback prop.
            // I'll assume we can reload or the parent context updates.
            window.location.reload();
          }}
          onClose={() => {
            setSubtaskModalOpen(false);
            setLoadingAddSubtaskId(null);
          }}
          parentId={parentTaskForSubtask.id}
          parentTask={parentTaskForSubtask}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );

  const completionModalContent = completionModalOpen && taskToComplete && (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999]">
      <div className="bg-card border border-border p-8 rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in duration-300 relative z-[10000]">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {actionType === 'submit-review' ? 'Submit for Review' :
            actionType === 'approve' ? 'Approve & Complete' : 'Complete Task'}
        </h2>
        <div className="flex flex-col gap-4">
          {actionType === 'approve' && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-400">Points</label>
              <div className="relative">
                <Pencil className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="number"
                  value={editedPoints}
                  onChange={(e) => setEditedPoints(Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none text-foreground"
                />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-400">
              {actionType === 'approve' ? 'Approval Note (Optional)' : 'Comment'}
            </label>
            <Textarea
              value={completionComment}
              onChange={(e) => setCompletionComment(e.target.value)}
              placeholder={actionType === 'submit-review' ? "What did you complete?" : "Add a note..."}
              className="bg-secondary border-border focus:ring-accent"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setCompletionModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={confirmCompletion}
            disabled={isCompleting}
            className={cn(
              actionType === 'approve' ? "bg-emerald-500 hover:bg-emerald-600 text-white" :
                actionType === 'submit-review' ? "bg-purple-500 hover:bg-purple-600 text-white" :
                  "bg-primary text-primary-foreground"
            )}
          >
            {isCompleting ? <Loader className="animate-spin h-4 w-4" /> : (
              actionType === 'submit-review' ? 'Submit' :
                actionType === 'approve' ? 'Approve' : 'Complete'
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  const inProgressModalContent = inProgressModalOpen && taskToInProgress && (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999]">
      <div className="bg-card border border-border p-8 rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in duration-300 relative z-[10000]">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {tasks.find(t => t.id === taskToInProgress)?.status === 'pending-review' ? 'Reject Task' : 'Mark as In Progress'}
        </h2>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-400">
            {tasks.find(t => t.id === taskToInProgress)?.status === 'pending-review' ? 'Reason for Rejection *' : 'Comment *'}
          </label>
          <Textarea
            value={inProgressComment}
            onChange={(e) => setInProgressComment(e.target.value)}
            placeholder="Add your comment..."
            className="bg-secondary border-border focus:ring-accent min-h-[100px]"
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setInProgressModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={confirmInProgress}
            disabled={isInProgressSetting}
            className={cn(
              tasks.find(t => t.id === taskToInProgress)?.status === 'pending-review' ? "bg-rose-500 hover:bg-rose-600 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"
            )}
          >
            {isInProgressSetting ? <Loader className="animate-spin h-4 w-4" /> : (
              tasks.find(t => t.id === taskToInProgress)?.status === 'pending-review' ? 'Reject' : 'Start Task'
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg transition-all duration-300">
      {/* Grouping Toggle */}
      <div className="px-4 py-3 bg-secondary/30 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Group By:</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant={groupingType === 'assignedDate' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGroupingType('assignedDate')}
            className="text-xs"
          >
            Assigned Date
          </Button>
          <Button
            variant={groupingType === 'dueDate' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGroupingType('dueDate')}
            className="text-xs"
          >
            Due Date
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse border border-slate-700/50">
          <thead>
            <tr className="bg-secondary text-foreground">
              <th className="px-1 py-1 md:px-2 md:py-1.5 font-semibold border border-border text-xs w-[120px]">Actions</th>
              <th className="px-1 py-1 md:px-2 md:py-1.5 font-semibold border border-border text-xs w-[50px] text-center">#</th>
              <th
                className="px-1 py-1 md:px-2 md:py-1.5 font-semibold border border-border text-xs cursor-pointer hover:bg-secondary/80 transition-colors select-none"
                onClick={() => onSort?.('description')}
              >
                <div className="flex items-center gap-1 text-center">
                  Desc
                  {sortBy === 'description' && (
                    <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th
                className="px-1 py-1 md:px-2 md:py-1.5 font-semibold border border-border text-xs w-[80px] md:w-[100px] cursor-pointer hover:bg-secondary/80 transition-colors select-none"
                onClick={() => onSort?.('status')}
              >
                <div className="flex items-center gap-1">
                  Status
                  {sortBy === 'status' && (
                    <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th
                className="px-1 py-1 md:px-2 md:py-1.5 font-semibold border border-border text-xs w-[60px] md:w-[80px] cursor-pointer hover:bg-secondary/80 transition-colors select-none"
                onClick={() => onSort?.('priority')}
              >
                <div className="flex items-center gap-1">
                  Pri
                  {sortBy === 'priority' && (
                    <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th className="px-1 py-1 md:px-2 md:py-1.5 font-semibold border border-border text-xs w-[100px] md:w-[120px]">Assigned</th>
              <th className="px-1 py-1 md:px-2 md:py-1.5 font-semibold border border-border text-xs w-[100px] md:w-[120px] hidden md:table-cell">By</th>
              <th className="px-1 py-1 md:px-2 md:py-1.5 font-semibold border border-border text-xs w-[100px] md:w-[120px] hidden md:table-cell">Date</th>
              <th
                className="px-1 py-1 md:px-2 md:py-1.5 font-semibold border border-border text-xs w-[80px] md:w-[120px] cursor-pointer hover:bg-secondary/80 transition-colors select-none"
                onClick={() => onSort?.('dueDate')}
              >
                <div className="flex items-center gap-1">
                  Due
                  {sortBy === 'dueDate' && (
                    <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th
                className="px-1 py-1 md:px-2 md:py-1.5 font-semibold border border-border text-xs w-[40px] md:w-[50px] text-center cursor-pointer hover:bg-secondary/80 transition-colors select-none"
                onClick={() => onSort?.('points')}
              >
                <div className="flex items-center justify-center gap-1">
                  Pts
                  {sortBy === 'points' && (
                    <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedDateKeys.map((dateKey) => (
              <React.Fragment key={dateKey}>
                <tr className="bg-secondary/50">
                  <td colSpan={10} className="px-2 py-1.5 font-bold bg-secondary text-xs border border-border">
                    <div className="flex items-center justify-between text-blue-300">
                      <span>{dateKey} ({groupedTasks[dateKey].length})</span>
                      <button
                        onClick={() => copyTaskSummary(dateKey)}
                        className="text-[10px] hover:text-white transition-colors uppercase font-bold"
                      >
                        {copiedDate === dateKey ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </td>
                </tr>
                {groupedTasks[dateKey].map((task, index) => {
                  const assignedUser = users.find((u) => u.id === task.assignedTo);
                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "completed";

                  return (
                    <React.Fragment key={task.id}>
                      <tr
                        className={cn(
                          "group hover:bg-secondary transition-colors",
                          isOverdue && "bg-rose-500/5"
                        )}
                      >
                        <td className="px-1 py-1 md:px-2 md:py-1 border border-border w-[100px] md:w-[120px] bg-secondary">
                          <div className="flex items-center justify-start gap-0.5 md:gap-1 scale-90 md:scale-100 origin-left">
                            <Button
                              onClick={() => handleAddSubtask(task)}
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 md:h-7 md:w-7 text-slate-400 hover:text-white"
                              title="Add Subtask"
                              disabled={loadingAddSubtaskId === task.id}
                            >
                              {loadingAddSubtaskId === task.id ? <Loader className="animate-spin h-3.5 w-3.5 md:h-4 md:w-4" /> : <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                            </Button>

                            {task.status === "pending" && (
                              <Button
                                onClick={() => handleMarkAsInProgress(task.id)}
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 md:h-7 md:w-7 text-slate-400 hover:text-blue-400"
                                disabled={loadingTaskId === task.id}
                                title="Mark as In Progress"
                              >
                                {loadingTaskId === task.id ? <Loader className="animate-spin h-3.5 w-3.5 md:h-4 md:w-4" /> : <Play className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                              </Button>
                            )}

                            {task.status !== "completed" && (
                              task.type === 'SEQUENTIAL' && task.assignedTo !== currentUserId ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="inline-block">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 md:h-7 md:w-7 text-slate-600 cursor-not-allowed opacity-50"
                                          disabled
                                        >
                                          <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                        </Button>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 border-slate-700">
                                      <p className="text-[10px] md:text-xs text-slate-300">
                                        Waiting for {users.find(u => u.id === task.assignedTo)?.firstName}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                task.status === 'pending-review' ? (
                                  // PENDING REVIEW STATE
                                  (userRole === 'ADMIN' || currentUserId === task.createdBy) ? (
                                    <>
                                      <Button
                                        onClick={() => handleMarkAsCompleted(task)}
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 md:h-7 md:w-7 text-slate-400 hover:text-emerald-400"
                                        disabled={loadingTaskId === task.id}
                                        title="Approve Task"
                                      >
                                        {loadingTaskId === task.id ? <Loader className="animate-spin h-3.5 w-3.5 md:h-4 md:w-4" /> : <Check className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                                      </Button>
                                      <Button
                                        onClick={() => handleMarkAsInProgress(task.id)}
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 md:h-7 md:w-7 text-slate-400 hover:text-rose-400"
                                        disabled={loadingTaskId === task.id}
                                        title="Reject Task"
                                      >
                                        {loadingTaskId === task.id ? <Loader className="animate-spin h-3.5 w-3.5 md:h-4 md:w-4" /> : <X className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                                      </Button>
                                    </>
                                  ) : (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7 text-purple-400 cursor-wait">
                                            <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Waiting for review</p></TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )
                                ) : (
                                  task.status !== 'pending' && (
                                    <Button
                                      onClick={() => handleMarkAsCompleted(task)}
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 md:h-7 md:w-7 text-slate-400 hover:text-emerald-400"
                                      disabled={loadingTaskId === task.id}
                                      title="Submit for Review"
                                    >
                                      {loadingTaskId === task.id ? <Loader className="animate-spin h-3.5 w-3.5 md:h-4 md:w-4" /> : <Check className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                                    </Button>
                                  )
                                )
                              )
                            )}
                            {userRole === "ADMIN" && (
                              <Button
                                onClick={() => handleAssignClick(task)}
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 md:h-7 md:w-7 text-slate-400 hover:text-blue-400"
                                title="Assign User"
                                disabled={loadingTaskId === task.id}
                              >
                                {loadingTaskId === task.id ? <Loader className="animate-spin h-3.5 w-3.5 md:h-4 md:w-4" /> : <UserIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                              </Button>
                            )}
                            {userRole === "ADMIN" && (
                              <Button
                                onClick={() => initiateDeleteTask(task.id)}
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 md:h-7 md:w-7 text-slate-400 hover:text-rose-400"
                                disabled={loadingTaskId === task.id}
                              >
                                {loadingTaskId === task.id ? <Loader className="animate-spin h-3.5 w-3.5 md:h-4 md:w-4" /> : <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="px-1 py-1 md:px-2 md:py-1 text-center text-muted-foreground font-mono text-xs border border-border bg-background">
                          {String(index + 1)}
                        </td>

                        <td className="px-1 py-1 md:px-2 md:py-1 border border-border bg-background max-w-[200px] md:max-w-[300px]">
                          <div className="flex items-center gap-1 md:gap-2">
                            {task.subtasks && task.subtasks.length > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
                                className="p-0.5 rounded hover:bg-white/10 text-muted-foreground transition-colors"
                              >
                                {!collapsedTasks.has(task.id) ? <ChevronDown className="h-3 w-3 md:h-4 md:w-4" /> : <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />}
                              </button>
                            )}
                            <div
                              className="font-medium text-foreground cursor-pointer hover:underline truncate text-xs md:text-sm"
                              onClick={() => handleOpenTaskDetail(task)}
                            >
                              {task.description}
                            </div>
                          </div>
                        </td>

                        <td className="px-1 py-1 md:px-2 md:py-1 border border-border bg-background">
                          <div className={cn(
                            "px-1 py-0.5 md:px-2 md:py-1 text-[11px] md:text-xs text-center border rounded-md w-full font-bold uppercase",
                            task.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/50"
                              : task.status === "in-progress"
                                ? "bg-blue-500/10 text-blue-700 border-blue-500/50 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/50"
                                : task.status === "pending-review"
                                  ? "bg-purple-500/10 text-purple-700 border-purple-500/50 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/50"
                                  : "bg-slate-500/10 text-slate-700 border-slate-500/50 dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/50"
                          )}>
                            {task.status === 'pending-review' ? 'In Review' : task.status}
                          </div>
                        </td>

                        <td className="px-1 py-1 md:px-2 md:py-1 border border-border bg-background font-medium text-xs text-center">
                          <span className={cn(
                            "text-[11px] md:text-xs font-bold",
                            task.priority === "HIGH" ? "text-rose-400" :
                              task.priority === "MEDIUM" ? "text-amber-400" : "text-slate-500"
                          )}>
                            {task.priority || 'MED'}
                          </span>
                        </td>

                        <td className="px-1 py-1 md:px-2 md:py-1 border border-border bg-background text-xs">
                          {task.assignees && task.assignees.length > 1 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex flex-col gap-0.5 md:gap-1 cursor-help">
                                    <div className="flex items-center gap-1 ">
                                      <span className={cn(
                                        "text-[10px] md:text-xs uppercase font-bold px-1 py-0.5 rounded border leading-none",
                                        task.type === 'SHARED' ? "border-blue-500/50 text-blue-400 bg-blue-500/10" : "border-purple-500/50 text-purple-400 bg-purple-500/10"
                                      )}>
                                        {task.type === 'SHARED' ? 'Shr' : 'Seq'}
                                      </span>
                                      <span className="text-slate-300 text-[9px] md:text-xs">
                                        {task.assignees.length}
                                      </span>
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 border-slate-700">
                                  <div className="flex flex-col gap-1">
                                    <span className="font-bold text-xs text-white mb-1 border-b border-white/10 pb-1">
                                      {task.type === 'SHARED' ? 'Shared with:' : 'Sequential Order:'}
                                    </span>
                                    {task.assignees.map((a: any, i) => (
                                      <div key={a.id} className="text-xs flex justify-between gap-4">
                                        <span className={cn(
                                          task.type === 'SEQUENTIAL' && task.assignedTo === a.id ? "text-emerald-400 font-bold" : "text-slate-300"
                                        )}>
                                          {i + 1}. {a.firstName} {a.lastName}
                                        </span>
                                        {a.isCompleted && <Check className="h-3 w-3 text-emerald-500" />}
                                      </div>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : assignedUser ? (
                            <span className="text-foreground">{assignedUser.firstName} {assignedUser.lastName[0]}.</span>
                          ) : (
                            <span className="text-slate-600 italic">None</span>
                          )}
                        </td>

                        <td className="px-1 py-1 md:px-2 md:py-1 border border-border bg-background text-[10px] md:text-xs text-muted-foreground hidden md:table-cell">
                          {task.creatorFirstName ? `${task.creatorFirstName} ${task.creatorLastName || ''}` : '-'}
                        </td>

                        <td className="px-1 py-1 md:px-2 md:py-1 border border-border bg-background text-[10px] md:text-xs text-muted-foreground hidden md:table-cell">
                          {task.assigned_at ? formatDateOnlyIST(task.assigned_at) : '-'}
                        </td>

                        <td className="px-1 py-1 md:px-2 md:py-1 border border-border bg-background text-xs text-muted-foreground">
                          {task.dueDate ? formatDateOnlyIST(task.dueDate) : '-'}
                        </td>

                        <td className="px-1 py-1 md:px-2 md:py-1 border border-border bg-background text-center font-mono text-slate-300 font-medium text-xs">
                          {task.points || "0"}
                        </td>


                      </tr>
                      {
                        !collapsedTasks.has(task.id) && task.subtasks && task.subtasks.map((subtask, stIndex) => {
                          const stAssignedUser = users.find((u) => u.id === subtask.assignedTo);
                          return (
                            <tr key={subtask.id} className="bg-secondary/50 relative">
                              <td className="px-2 py-1 border border-slate-700/50 bg-secondary">
                                <div className="flex items-center justify-start gap-1 scale-90 origin-left">
                                  {subtask.status === "pending" && (
                                    <Button
                                      onClick={() => handleMarkAsInProgress(subtask.id)}
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-slate-500 hover:text-blue-400"
                                      disabled={loadingTaskId === subtask.id}
                                      title="Mark as In Progress"
                                    >
                                      {loadingTaskId === subtask.id ? <Loader className="animate-spin h-3 w-3" /> : <Play className="h-3 w-3" />}
                                    </Button>
                                  )}

                                  {/* Subtask Action Logic */
                                    subtask.status !== "completed" && (
                                      subtask.status === 'pending-review' ? (
                                        // PENDING REVIEW STATE - Check Parent task creator
                                        (userRole === 'ADMIN' || currentUserId === task.createdBy) ? (
                                          <>
                                            <Button
                                              onClick={() => handleMarkAsCompleted(subtask)}
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 text-slate-400 hover:text-emerald-400"
                                              disabled={loadingTaskId === subtask.id}
                                              title="Approve Task"
                                            >
                                              {loadingTaskId === subtask.id ? <Loader className="animate-spin h-3 w-3" /> : <Check className="h-3 w-3" />}
                                            </Button>
                                            <Button
                                              onClick={() => handleMarkAsInProgress(subtask.id)}
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 text-slate-400 hover:text-rose-400"
                                              disabled={loadingTaskId === subtask.id}
                                              title="Reject Task"
                                            >
                                              {loadingTaskId === subtask.id ? <Loader className="animate-spin h-3 w-3" /> : <X className="h-3 w-3" />}
                                            </Button>
                                          </>
                                        ) : (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-purple-400 cursor-wait">
                                                  <Clock className="h-3 w-3" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent><p>Waiting for review</p></TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )
                                      ) : (
                                        subtask.status !== 'pending' && (
                                          <Button
                                            onClick={() => handleMarkAsCompleted(subtask)}
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-slate-500 hover:text-emerald-400"
                                            disabled={loadingTaskId === subtask.id}
                                            title="Submit for Review"
                                          >
                                            {loadingTaskId === subtask.id ? <Loader className="animate-spin h-3 w-3" /> : <Check className="h-3 w-3" />}
                                          </Button>
                                        )
                                      )
                                    )}
                                  {userRole === "ADMIN" && (
                                    <Button
                                      onClick={() => handleAssignClick(subtask)}
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-slate-500 hover:text-blue-400"
                                      title="Assign User"
                                    >
                                      <UserIcon className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {userRole === "ADMIN" && (
                                    <Button
                                      onClick={() => initiateDeleteTask(subtask.id)}
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-slate-500 hover:text-rose-400"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 py-1 border border-slate-700/50 bg-secondary"></td> {/* Spacer for S.No */}
                              <td className="px-2 py-1 border border-slate-700/50 bg-secondary relative">
                                <div className="flex items-center gap-2 pl-4">
                                  <CornerDownRight className="h-3 w-3 text-slate-500" />
                                  <span
                                    className="text-sm text-muted-foreground hover:underline cursor-pointer truncate"
                                    onClick={() => handleOpenTaskDetail(subtask)}
                                  >
                                    {subtask.description}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-1 border border-slate-700/50 bg-secondary">
                                <div className={cn(
                                  "px-2 py-0.5 text-[10px] text-center border rounded-md w-full font-bold uppercase",
                                  subtask.status === "completed" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/50" :
                                    "px-2 py-0.5 text-[10px] text-center border rounded-md w-full font-bold uppercase",
                                  subtask.status === "completed" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/50" :
                                    subtask.status === "in-progress" ? "bg-blue-500/10 text-blue-700 border-blue-500/50 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/50" :
                                      subtask.status === "pending-review" ? "bg-purple-500/10 text-purple-700 border-purple-500/50 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/50" :
                                        "bg-slate-500/10 text-slate-700 border-slate-500/50 dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/50"
                                )}>
                                  {subtask.status === 'pending-review' ? 'In Review' : subtask.status}
                                </div>
                              </td>
                              <td className="px-2 py-1 border border-slate-700/50 bg-secondary font-medium text-xs text-center">
                                <span className={cn(
                                  "text-[10px]",
                                  subtask.priority === "HIGH" ? "text-rose-400" :
                                    subtask.priority === "MEDIUM" ? "text-amber-400" : "text-slate-500"
                                )}>
                                  {subtask.priority}
                                </span>
                              </td>
                              <td className="px-2 py-1 border border-slate-700/50 bg-secondary">
                                {stAssignedUser ? (
                                  <span className="text-muted-foreground text-xs">{stAssignedUser.firstName} {stAssignedUser.lastName[0]}.</span>
                                ) : (
                                  <span className="text-slate-700 text-[10px] italic">Unassigned</span>
                                )}
                              </td>

                              <td className="px-2 py-1 border border-slate-700/50 bg-secondary text-[10px] text-muted-foreground">
                                {subtask.creatorFirstName ? `${subtask.creatorFirstName} ${subtask.creatorLastName || ''}` : '-'}
                              </td>

                              <td className="px-2 py-1 border border-slate-700/50 bg-secondary text-[10px] text-muted-foreground">
                                {subtask.assigned_at ? formatDateOnlyIST(subtask.assigned_at) : '-'}
                              </td>

                              <td className="px-2 py-1 border border-slate-700/50 bg-secondary text-[10px] text-muted-foreground">
                                {subtask.dueDate ? formatDateOnlyIST(subtask.dueDate) : '-'}
                              </td>
                              <td className="px-2 py-1 border border-slate-700/50 bg-secondary text-center text-muted-foreground text-xs font-mono">
                                {subtask.points || "0"}
                              </td>

                            </tr>
                          )
                        })
                      }
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {
        currentPage && totalPages && totalPages > 1 && onPageChange && (
          <div className="flex items-center justify-between p-6 bg-white/5 border-t border-white/10">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Page <span className="text-foreground">{currentPage}</span> of {totalPages}
            </p>
            <div className="flex gap-4">
              <Button
                className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl px-6"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl px-6"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )
      }

      {typeof document !== 'undefined' && ReactDOM.createPortal(modalContent, document.getElementById('modal-root') as HTMLElement)}
      {typeof document !== 'undefined' && ReactDOM.createPortal(completionModalContent, document.getElementById('modal-root') as HTMLElement)}
      {typeof document !== 'undefined' && ReactDOM.createPortal(inProgressModalContent, document.getElementById('modal-root') as HTMLElement)}
      {typeof document !== 'undefined' && ReactDOM.createPortal(subtaskModalContent, document.getElementById('modal-root') as HTMLElement)}

      {typeof document !== 'undefined' && ReactDOM.createPortal(
        <ConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={confirmDeleteTask}
          title="Delete Task"
          description="Are you sure you want to delete this task? This action cannot be undone."
          confirmText="Delete Task"
          variant="destructive"
        />,
        document.getElementById('modal-root') as HTMLElement
      )}

    </div >
  );
}


