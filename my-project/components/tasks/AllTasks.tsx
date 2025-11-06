import { Button } from "@/components/ui/button";
import { Task, User, Project } from "@/lib/types";
import axios from "@/lib/axios";
import toast from "react-hot-toast";
import { useState, useEffect } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Loader } from "lucide-react";
import ReactDOM from 'react-dom';
import { jwtDecode } from 'jwt-decode';
import { useRouter } from 'next/navigation';

interface AllTasksProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

export default function AllTasks({ tasks, users, projects, setTasks }: AllTasksProps) {
  const router = useRouter();
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

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
      await axios.delete(`/tasks/tasks/${taskId}`);
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

    } catch (error) {
      toast.error("Failed to export tasks", { id: toastId });
    }
  };

  const handleMarkAsCompleted = async (taskId: string) => {
    const toastId = toast.loading("Marking as completed...");
    try {
      const response = await axios.put(`/tasks/status/${taskId}`, { status: 'completed' });
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? response.data : task))
      );

    } catch {
      toast.error("Failed to mark task as completed", { id: toastId });
    }
  };

  // Function to open the task detail page
  const handleOpenTaskDetail = (task: Task) => {
    router.push(`/dashboard/tasks/${task.id}`);
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
      <table className="w-full text-left responsive-table">
        <thead className="border-b border-accent/20">
          <tr>
            <th className="p-4 font-semibold">Description</th>
            <th className="p-4 font-semibold">Status</th>
            <th className="p-4 font-semibold">Assigned To</th>
            <th className="p-4 font-semibold">Points</th>
            <th className="p-4 font-semibold">Project</th>
            <th className="p-4 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-b border-accent/20 hover:bg-accent/5">
              <td className="p-4 cursor-pointer" onClick={() => handleOpenTaskDetail(task)} data-label="Description"> {/* Make description clickable */}
                {task.description}
              </td>
              <td className="p-4" data-label="Status">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${task.status === "completed"
                      ? "bg-green-500/20 text-green-400"
                      : task.status === "in-progress"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-orange-500/20 text-orange-400"
                    }`}
                >
                  {task.status?.replace("-", " ")}
                </span>
              </td>
              <td className="p-4" data-label="Assigned To">
                <span className="cursor-pointer" onClick={() => router.push(`/dashboard/users/${task.assignedTo}/tasks`)}>
                  {users.find((u) => u.id === task.assignedTo)?.firstName}{" "}
                  {users.find((u) => u.id === task.assignedTo)?.lastName || "Unassigned"}
                </span>
              </td>
              <td className="p-4 font-semibold" data-label="Points">{task.points}</td>
              <td className="p-4" data-label="Project">{projects.find((p) => p.id === task.projectId)?.name}</td>
              <td className="p-4 flex space-x-2" data-label="Actions">
                {userRole === 'ADMIN' && (
                  <Button variant="outline" size="sm" onClick={() => handleAssignClick(task)}>
                    Assign
                  </Button>
                )}
                {task.status !== 'completed' && (
                  <Button variant="outline" size="sm" onClick={() => handleMarkAsCompleted(task.id)}>
                    Complete
                  </Button>
                )}
                {userRole === 'ADMIN' && (
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteTask(task.id)}>
                    Delete
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {typeof document !== 'undefined' && ReactDOM.createPortal(modalContent, document.getElementById('modal-root') as HTMLElement)}
    </div>
  );
}