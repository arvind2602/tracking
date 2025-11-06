"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Breadcrumbs from "@/components/ui/breadcrumbs";
import axios from "@/lib/axios";
import { jwtDecode } from "jwt-decode";
import toast from "react-hot-toast";
import { Loader } from "lucide-react";
import { Task, Project, User } from "@/lib/types";
import AllTasks from "@/components/tasks/AllTasks";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { ListChecks, Hourglass, CheckCircle, Plus } from 'lucide-react';

interface DecodedToken {
  user: {
    role: string;
  };
  organizationId: string;
}

export default function Tasks() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"All Tasks">("All Tasks");
  const modalRef = useRef<HTMLDivElement>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const [form, setForm] = useState({
    description: "",
    status: "pending" as "pending" | "in-progress" | "completed",
    assignedTo: "",
    points: "",
    projectId: "",
  });

  useEffect(() => {
    const fetchInitialData = async (organizationId: string) => {
      setIsLoading(true);
      try {
        const [projectsResponse, usersResponse] = await Promise.all([
          axios.get("/projects"),
          axios.get(`/auth/organization`),
        ]);
        setProjects(projectsResponse.data);
        setUsers(usersResponse.data);
        fetchAllTasks();
      } catch {
        toast.error("Failed to fetch initial data");
      } finally {
        setIsLoading(false);
      }
    };

    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload: DecodedToken = jwtDecode(token);
        setUserRole(payload.user.role);
        fetchInitialData(payload.organizationId);
      } catch {
        router.push("/login");
      }
    }
  }, [router]);

  const fetchAllTasks = async () => {
    try {
      const response = await axios.get(`/tasks/employees/tasks`);
      setTasks(response.data);
    } catch {
      toast.error("Failed to fetch tasks");
    }
  };



  const handleAddTask = async () => {
    setIsSaving(true);
    const toastId = toast.loading("Adding task...");
    try {
      const response = await axios.post("/tasks", form);
      setTasks((prev) => [response.data, ...prev]);
      setIsModalOpen(false);
      setForm({
        description: "",
        status: "pending",
        assignedTo: "",
        points: "",
        projectId: "",
      });

    } catch {
      toast.error("Failed to add task", { id: toastId });
    } finally {
      setIsSaving(false);
      toast.dismiss(toastId);
    }
  };

  const breadcrumbItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Tasks", href: "/dashboard/tasks" },
  ];

  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const pendingTasks = tasks.filter(task => task.status === 'pending' || task.status === 'in-progress').length;
  const allTasksCount = tasks.length;

  return (
    <div className="font-mono">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex justify-between items-center mb-8 mt-4">
        <h1 className="text-4xl font-bold text-white">Tasks</h1>
        {userRole === 'ADMIN' && (
          <Button
            className="bg-primary text-white hover:bg-primary/90 rounded-full px-6 py-3 shadow-[0_0_15px_rgba(37,99,235,0.5)]"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            Add New Task
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <SummaryCard title="All Tasks" value={allTasksCount} icon={<ListChecks className="h-4 w-4 text-muted-foreground" />} />
        <SummaryCard title="Pending Tasks" value={pendingTasks} icon={<Hourglass className="h-4 w-4 text-muted-foreground" />} />
        <SummaryCard title="Completed Tasks" value={completedTasks} icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />} />
      </div>

      <div className="flex space-x-6 border-b border-accent/20 mb-8">
        <button
          onClick={() => setActiveTab("All Tasks")}
          className={`py-3 border-b-2 font-semibold transition-colors ${activeTab === "All Tasks"
            ? "border-accent text-accent"
            : "border-transparent hover:border-secondary text-secondary"
            }`}
        >
          All Tasks
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="animate-spin h-12 w-12 text-accent" />
        </div>
      ) : (
        <div>
          {activeTab === "All Tasks" && (
            <AllTasks tasks={tasks} users={users} projects={projects} setTasks={setTasks} />
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999]">
          <div
            ref={modalRef}
            className="bg-card/80 backdrop-blur-lg p-8 rounded-2xl shadow-xl w-full max-w-lg border border-accent/20 z-[10000] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <h2 className="text-3xl font-bold text-white mb-6 pr-8">
                Add New Task
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-0 right-0 text-3xl text-white/60 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              <Input
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white"
              />
              <Select
                value={form.status}
                onValueChange={(val: "pending" | "in-progress" | "completed") =>
                  setForm({ ...form, status: val })
                }
              >
                <SelectTrigger className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={form.assignedTo}
                onValueChange={(val) => setForm({ ...form, assignedTo: val })}
              >
                <SelectTrigger className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white">
                  <SelectValue placeholder="Assign To" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Points"
                type="number"
                min="0"
                value={form.points}
                onChange={(e) => setForm({ ...form, points: e.target.value })}
                className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white"
              />
              <Select
                value={form.projectId}
                onValueChange={(val) => setForm({ ...form, projectId: val })}
              >
                <SelectTrigger className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white">
                  <SelectValue placeholder="Select Project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-4 mt-8">
              <Button
                variant="outline"
                className="rounded-full px-6 py-3 border-accent/50 text-accent hover:bg-accent/10"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-primary text-white hover:bg-primary/90 rounded-full px-6 py-3 shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                onClick={handleAddTask}
                disabled={isSaving}
              >
                {isSaving ? <Loader className="animate-spin h-5 w-5 mr-2" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}