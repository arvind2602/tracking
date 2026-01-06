import { Button } from "@/components/ui/button";
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
import { formatDateTimeIST, formatDateIST, cn } from "@/lib/utils";
import { Loader, Calendar as CalendarIcon, Copy, Check, User as UserIcon, Trash2, Download, ChevronRight, ChevronDown, Plus, CornerDownRight } from "lucide-react";

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
}

export default function AllTasks({ tasks, users, projects, setTasks, currentPage, totalPages, onPageChange, itemsPerPage }: AllTasksProps) {
  const router = useRouter();
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [copiedDate, setCopiedDate] = useState<string | null>(null);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
  const [parentTaskForSubtask, setParentTaskForSubtask] = useState<Task | null>(null);
  const [loadingAddSubtaskId, setLoadingAddSubtaskId] = useState<string | null>(null);

  const toggleExpand = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const handleAddSubtask = (parentTask: Task) => {
    setLoadingAddSubtaskId(parentTask.id);
    setParentTaskForSubtask(parentTask);
    setSubtaskModalOpen(true);
    setLoadingAddSubtaskId(null);
  };

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload: any = jwtDecode(token);
        setUserRole(payload.user.role);
        setCurrentUserId(payload.user.id);
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
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete));
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

  const handleMarkAsCompleted = async (taskId: string) => {
    setLoadingTaskId(taskId);
    const toastId = toast.loading("Marking as completed...");
    try {
      const response = await axios.put(`/tasks/${taskId}/status`, { status: 'completed' });
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? response.data : task))
      );
      toast.success("Task marked as completed", { id: toastId });
    } catch {
      toast.error("Failed to mark task as completed", { id: toastId });
    } finally {
      setLoadingTaskId(null);
    }
  };

  // Function to open the task detail page
  const handleOpenTaskDetail = (task: Task) => {
    router.push(`/dashboard/tasks/${task.id}`);
  };


  const dateFormatter = useMemo(() => new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }), []);


  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    if (!Array.isArray(tasks)) return groups;

    const safeTasks = tasks.filter(t => t && typeof t === 'object');

    safeTasks.forEach((task) => {
      let dateKey = "Unassigned Date";
      // Fallback to createdAt if assigned_at is missing, common in older tasks
      const dateStr = task.assigned_at || (task as any).startDate || task.createdAt;

      if (dateStr) {
        try {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            dateKey = dateFormatter.format(d);
          }
        } catch (e) {
          // Fallback
        }
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(task);
    });

    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });

    return groups;
  }, [tasks, dateFormatter]);

  const sortedDateKeys = useMemo(() => {
    return Object.keys(groupedTasks).sort((a, b) => {
      if (a === "Unassigned Date") return 1;
      if (b === "Unassigned Date") return -1;
      return new Date(b).getTime() - new Date(a).getTime();
    });
  }, [groupedTasks]);

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
        <h2 className="text-2xl font-bold text-white mb-4">
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
      <div className="bg-slate-900 border border-white/10 p-8 rounded-[2rem] shadow-2xl w-full max-w-lg animate-in zoom-in duration-300 relative z-[10000]">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-white tracking-tight">
            Add Subtask
          </h2>
          <button
            onClick={() => setSubtaskModalOpen(false)}
            className="text-slate-500 hover:text-white transition-colors"
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
          onClose={() => setSubtaskModalOpen(false)}
          parentId={parentTaskForSubtask.id}
          parentTask={parentTaskForSubtask}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );



  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse border border-slate-700/50">
          <thead>
            <tr className="bg-slate-800/80 text-white">
              <th className="px-2 py-1.5 font-semibold border border-slate-600/50 text-xs w-[120px]">Actions</th>
              <th className="px-2 py-1.5 font-semibold border border-slate-600/50 text-xs w-[50px] text-center">#</th>
              <th className="px-2 py-1.5 font-semibold border border-slate-600/50 text-xs">Description</th>
              <th className="px-2 py-1.5 font-semibold border border-slate-600/50 text-xs w-[100px]">Status</th>
              <th className="px-2 py-1.5 font-semibold border border-slate-600/50 text-xs w-[80px]">Priority</th>
              <th className="px-2 py-1.5 font-semibold border border-slate-600/50 text-xs w-[120px]">Assigned To</th>
              <th className="px-2 py-1.5 font-semibold border border-slate-600/50 text-xs w-[120px]">Assigned By</th>
              <th className="px-2 py-1.5 font-semibold border border-slate-600/50 text-xs w-[120px]">Assigned Date</th>
              <th className="px-2 py-1.5 font-semibold border border-slate-600/50 text-xs w-[120px]">Due Date</th>
              <th className="px-2 py-1.5 font-semibold border border-slate-600/50 text-xs w-[50px] text-center">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedDateKeys.map((dateKey) => (
              <React.Fragment key={dateKey}>
                <tr className="bg-white/5/50">
                  <td colSpan={10} className="px-2 py-1.5 font-bold bg-slate-700/30 text-xs border border-slate-600/50">
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
                          "group hover:bg-white/5 transition-colors",
                          isOverdue && "bg-rose-500/5"
                        )}
                      >
                        <td className="px-2 py-1 border border-slate-700/50 w-[120px] bg-slate-900/40">
                          <div className="flex items-center justify-start gap-1">
                            <Button
                              onClick={() => handleAddSubtask(task)}
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-white"
                              title="Add Subtask"
                              disabled={loadingAddSubtaskId === task.id}
                            >
                              {loadingAddSubtaskId === task.id ? <Loader className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            </Button>

                            {task.status !== "completed" && (
                              <Button
                                onClick={() => handleMarkAsCompleted(task.id)}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-emerald-400"
                                disabled={loadingTaskId === task.id}
                              >
                                {loadingTaskId === task.id ? <Loader className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />}
                              </Button>
                            )}
                            {userRole === "ADMIN" && (
                              <Button
                                onClick={() => handleAssignClick(task)}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-blue-400"
                                title="Assign User"
                                disabled={loadingTaskId === task.id}
                              >
                                {loadingTaskId === task.id ? <Loader className="animate-spin h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                              </Button>
                            )}
                            {userRole === "ADMIN" && (
                              <Button
                                onClick={() => initiateDeleteTask(task.id)}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-rose-400"
                                disabled={loadingTaskId === task.id}
                              >
                                {loadingTaskId === task.id ? <Loader className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1 text-center text-slate-400 font-mono text-xs border border-slate-700/50 bg-slate-900/20">
                          {String(index + 1)}
                        </td>

                        <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/20 max-w-[300px]">
                          <div className="flex items-center gap-2">
                            {task.subtasks && task.subtasks.length > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
                                className="p-0.5 rounded hover:bg-white/10 text-slate-400 transition-colors"
                              >
                                {expandedTasks.has(task.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            )}
                            <div
                              className="font-medium text-white cursor-pointer hover:underline truncate"
                              onClick={() => handleOpenTaskDetail(task)}
                            >
                              {task.description}
                            </div>
                            {task.subtasks && task.subtasks.length > 0 && (
                              <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-full">
                                {task.subtasks.length} sub
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/20">
                          <div className={cn(
                            "px-1.5 py-0.5 text-xs text-center border rounded-sm w-full font-medium",
                            task.status === "completed"
                              ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/50"
                              : task.status === "in-progress"
                                ? "bg-blue-950/30 text-blue-400 border-blue-900/50"
                                : "bg-slate-800/50 text-slate-400 border-slate-700"
                          )}>
                            {task.status}
                          </div>
                        </td>

                        <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/20 font-medium text-xs text-center">
                          <span className={cn(
                            "text-[10px] font-bold",
                            task.priority === "HIGH" ? "text-rose-400" :
                              task.priority === "MEDIUM" ? "text-amber-400" : "text-slate-500"
                          )}>
                            {task.priority}
                          </span>
                        </td>

                        <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/20 text-xs">
                          {assignedUser ? (
                            <span className="text-slate-300">{assignedUser.firstName} {assignedUser.lastName[0]}.</span>
                          ) : (
                            <span className="text-slate-600 italic">Unassigned</span>
                          )}
                        </td>

                        <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/20 text-xs text-slate-400">
                          {task.creatorFirstName ? `${task.creatorFirstName} ${task.creatorLastName || ''}` : '-'}
                        </td>

                        <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/20 text-xs text-slate-400">
                          {task.assigned_at ? formatDateIST(task.assigned_at) : '-'}
                        </td>

                        <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/20 text-xs text-slate-400">
                          {task.dueDate ? formatDateIST(task.dueDate) : '-'}
                        </td>

                        <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/20 text-center font-mono text-slate-300 font-medium text-xs">
                          {task.points || "0"}
                        </td>


                      </tr>
                      {
                        expandedTasks.has(task.id) && task.subtasks && task.subtasks.map((subtask, stIndex) => {
                          const stAssignedUser = users.find((u) => u.id === subtask.assignedTo);
                          return (
                            <tr key={subtask.id} className="bg-white/5 relative">
                              <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/30">
                                <div className="flex items-center justify-start gap-1 scale-90 origin-left">
                                  {subtask.status !== "completed" && (
                                    <Button
                                      onClick={() => handleMarkAsCompleted(subtask.id)}
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-slate-500 hover:text-emerald-400"
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
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
                              <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/30"></td> {/* Spacer for S.No */}
                              <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/30 relative">
                                <div className="flex items-center gap-2 pl-4">
                                  <CornerDownRight className="h-3 w-3 text-slate-500" />
                                  <span
                                    className="text-sm text-slate-400 hover:underline cursor-pointer truncate"
                                    onClick={() => handleOpenTaskDetail(subtask)}
                                  >
                                    {subtask.description}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/30">
                                <div className={cn(
                                  "text-[10px] text-center border rounded-sm w-full",
                                  subtask.status === "completed" ? "text-emerald-500 border-emerald-900/30 bg-emerald-950/20" :
                                    subtask.status === "in-progress" ? "text-blue-500 border-blue-900/30 bg-blue-950/20" : "text-slate-500 border-slate-800 bg-slate-900"
                                )}>
                                  {subtask.status}
                                </div>
                              </td>
                              <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/30 font-medium text-xs text-center">
                                <span className={cn(
                                  "text-[10px]",
                                  subtask.priority === "HIGH" ? "text-rose-400" :
                                    subtask.priority === "MEDIUM" ? "text-amber-400" : "text-slate-500"
                                )}>
                                  {subtask.priority}
                                </span>
                              </td>
                              <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/30">
                                {stAssignedUser ? (
                                  <span className="text-slate-400 text-xs">{stAssignedUser.firstName} {stAssignedUser.lastName[0]}.</span>
                                ) : (
                                  <span className="text-slate-700 text-[10px] italic">Unassigned</span>
                                )}
                              </td>

                              <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/30 text-[10px] text-slate-500">
                                {subtask.creatorFirstName ? `${subtask.creatorFirstName} ${subtask.creatorLastName || ''}` : '-'}
                              </td>

                              <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/30 text-[10px] text-slate-500">
                                {subtask.assigned_at ? formatDateIST(subtask.assigned_at) : '-'}
                              </td>

                              <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/30 text-[10px] text-slate-500">
                                {subtask.dueDate ? formatDateIST(subtask.dueDate) : '-'}
                              </td>
                              <td className="px-2 py-1 border border-slate-700/50 bg-slate-900/30 text-center text-slate-500 text-xs font-mono">
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
              Page <span className="text-white">{currentPage}</span> of {totalPages}
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
      {typeof document !== 'undefined' && ReactDOM.createPortal(subtaskModalContent, document.getElementById('modal-root') as HTMLElement)}

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteTask}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete Task"
        variant="destructive"
      />
    </div >
  );
}
