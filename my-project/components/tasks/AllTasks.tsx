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
import { Loader, Calendar as CalendarIcon, Copy, Check } from "lucide-react";
import ReactDOM from 'react-dom';
import { jwtDecode } from 'jwt-decode';
import { useRouter } from 'next/navigation';

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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload: any = jwtDecode(token);
        setUserRole(payload.user.role);
      } catch (error) {
        console.error('Invalid token', error);
      }
    }
  }, []);

  const handleDeleteTask = async (taskId: string) => {
    const toastId = toast.loading("Deleting...");
    try {
      await axios.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));

    } catch {
      toast.error("Failed to delete", { id: toastId });
    } finally {
      toast.dismiss(toastId);
    }
  };

  const handleAssignClick = (task: Task) => {
    setSelectedTask(task);
    setIsAssignModalOpen(true);
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
    const toastId = toast.loading("Marking as completed...");
    try {
      const response = await axios.put(`/tasks/${taskId}/status`, { status: 'completed' });
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? response.data : task))
      );
      toast.success("Task marked as completed", { id: toastId });
    } catch {
      toast.error("Failed to mark task as completed", { id: toastId });
    }
  };

  // Function to open the task detail page
  const handleOpenTaskDetail = (task: Task) => {
    router.push(`/dashboard/tasks/${task.id}`);
  };

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      const date = task.assigned_at
        ? new Date(task.assigned_at).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
        : "Unassigned Date";
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(task);
    });

    // Sort tasks within each group by createdAt DESC (Latest first)
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });

    return groups;
  }, [tasks]);

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
      if (task.dueDate) summary += `   Due Date: ${new Date(task.dueDate).toLocaleDateString()}\n`;
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



  return (
    <div className="bg-card/50 backdrop-blur-lg rounded-xl border border-accent/20 shadow-lg overflow-x-auto">
      <div className="flex justify-between items-center p-4">
        <p className="text-sm text-white">Total Tasks: {tasks.length}</p>
        {userRole === 'ADMIN' && (
          <Button onClick={handleExportTasks} size="sm">
            Export Tasks
          </Button>
        )}
      </div>
      <div className="overflow-auto border border-border rounded-lg bg-background">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-muted/40 sticky top-0 z-10">
            <tr>
              <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[50px] text-center">S.No</th>
              <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[100px]">Actions</th>
              <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[300px]">Description</th>
              <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[120px]">Status</th>
              <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[100px]">Priority</th>
              <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[150px]">Assigned To</th>
              <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[150px]">Assigned By</th>
              <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[80px] text-center">Points</th>
              <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[150px]">Project</th>
              <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[120px]">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {sortedDateKeys.map((dateKey) => (
              <>
                <tr key={dateKey} className="bg-muted/30">
                  <td colSpan={10} className="px-3 py-2 font-semibold text-xs text-muted-foreground border border-border uppercase tracking-wider">
                    <div className="flex items-center justify-between">
                      <span>{dateKey}</span>
                      <button
                        onClick={() => copyTaskSummary(dateKey)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-accent/10"
                        title="Copy task summary to clipboard"
                      >
                        {copiedDate === dateKey ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        <span className="text-[10px] normal-case">Copy Summary</span>
                      </button>
                    </div>
                  </td>
                </tr>
                {groupedTasks[dateKey].map((task, index) => {
                  const assignedUser = users.find((u) => u.id === task.assignedTo);
                  const project = projects.find((p) => p.id === task.projectId);
                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "completed";

                  return (
                    <tr
                      key={task.id}
                      className={`group hover:bg-accent/5 transition-colors ${isOverdue ? "bg-red-50/50 dark:bg-red-900/10" : ""
                        }`}
                    >
                      {/* S.No */}
                      <td className="border border-border px-3 py-1.5 align-middle text-center text-muted-foreground">
                        {index + 1}
                      </td>

                      {/* Actions */}
                      <td className="border border-border px-3 py-1.5 align-middle">
                        <div className="flex items-center gap-1">
                          {task.status !== "completed" && (
                            <button
                              onClick={() => handleMarkAsCompleted(task.id)}
                              className="hover:text-green-600 text-muted-foreground transition-colors p-1"
                              title="Mark Done"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </button>
                          )}
                          {userRole === "ADMIN" && (
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="hover:text-red-600 text-muted-foreground transition-colors p-1"
                              title="Delete"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                              </svg>
                            </button>
                          )}
                          {userRole === "ADMIN" && (
                            <button
                              onClick={() => handleAssignClick(task)}
                              className="hover:text-blue-600 text-muted-foreground transition-colors p-1"
                              title="Assign"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="border border-border px-3 py-1.5 align-middle">
                        <div
                          className="line-clamp-1 font-medium cursor-pointer hover:underline decoration-primary/50 underline-offset-4"
                          onClick={() => handleOpenTaskDetail(task)}
                          title={typeof task.description === "string" ? task.description : "View Details"}
                        >
                          {task.description}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="border border-border px-3 py-1.5 align-middle">
                        <span
                          className={`capitalize ${task.status === "completed"
                            ? "text-green-600 dark:text-green-400"
                            : task.status === "in-progress"
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-slate-500"
                            }`}
                        >
                          {task.status?.replace("-", " ")}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="border border-border px-3 py-1.5 align-middle">
                        {task.priority && (
                          <span
                            className={`text-xs font-medium px-1.5 py-0.5 rounded-sm border ${task.priority === "HIGH"
                              ? "border-red-200 text-red-600 bg-red-50 dark:bg-red-950 dark:border-red-900"
                              : task.priority === "MEDIUM"
                                ? "border-amber-200 text-amber-600 bg-amber-50 dark:bg-amber-950 dark:border-amber-900"
                                : "border-slate-200 text-slate-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                              }`}
                          >
                            {task.priority}
                          </span>
                        )}
                      </td>

                      {/* Assigned To */}
                      <td className="border border-border px-3 py-1.5 align-middle">
                        {assignedUser ? (
                          <div
                            className="flex items-center gap-2 truncate"
                            title={`${assignedUser.firstName} ${assignedUser.lastName}`}
                          >
                            <div className="w-5 h-5 rounded bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">
                              {assignedUser.firstName[0]}
                              {assignedUser.lastName[0]}
                            </div>
                            <span className="truncate">
                              {assignedUser.firstName} {assignedUser.lastName[0]}.
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Unassigned</span>
                        )}
                      </td>

                      {/* Assigned By */}
                      <td className="border border-border px-3 py-1.5 align-middle">
                        <span className="text-muted-foreground truncate block">
                          {task.creatorFirstName
                            ? `${task.creatorFirstName} ${task.creatorLastName?.[0]}.`
                            : "System"}
                        </span>
                      </td>



                      {/* Points */}
                      <td className="border border-border px-3 py-1.5 align-middle text-center font-mono">
                        {task.points || "-"}
                      </td>

                      {/* Project */}
                      <td className="border border-border px-3 py-1.5 align-middle">
                        <div className="truncate text-muted-foreground" title={project?.name}>
                          {project?.name || "-"}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="border border-border px-3 py-1.5 align-middle">
                        {task.dueDate ? (
                          <div
                            className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
                              }`}
                          >
                            {new Date(task.dueDate).toLocaleDateString(undefined, {
                              month: "numeric",
                              day: "numeric",
                              year: "2-digit",
                            })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>


                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {currentPage && totalPages && totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-end space-x-2 py-4 px-4 sticky bottom-0 bg-card border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="text-sm text-center min-w-[100px] text-muted-foreground">
            Page <span className="font-medium text-foreground">{currentPage}</span> of <span className="font-medium text-foreground">{totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {typeof document !== 'undefined' && ReactDOM.createPortal(modalContent, document.getElementById('modal-root') as HTMLElement)}
    </div>
  );
}