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
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { AddTaskForm } from "@/components/tasks/AddTaskForm";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { ListChecks, Hourglass, CheckCircle, Plus, LayoutGrid, List, Timer } from 'lucide-react';

interface DecodedToken {
  user: {
    role: string;
  };
  organizationId: string;
}

export default function Tasks() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"All Tasks" | "Kanban">("All Tasks");
  const modalRef = useRef<HTMLDivElement>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalTasks, setTotalTasks] = useState(0);

  useEffect(() => {
    let filtered = tasks;
    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter((task) => task.status === statusFilter);
    }
    if (projectFilter && projectFilter !== "all") {
      filtered = filtered.filter((task) => task.projectId === projectFilter);
    }
    if (userFilter && userFilter !== "all") {
      filtered = filtered.filter((task) => task.assignedTo === userFilter);
    }
    setFilteredTasks(filtered);
  }, [tasks, statusFilter, projectFilter, userFilter]);

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
        // Initial fetch with default page 1
        fetchAllTasks(1);
      } catch {
        toast.error("Failed to fetch initial data");
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



  // Dashboard Stats State
  const [dashboardStats, setDashboardStats] = useState({
    totalTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    pointsToday: 0
  });

  useEffect(() => {
    // Re-fetch tasks when filters change or tab changes, resetting to page 1
    fetchAllTasks(1);
  }, [statusFilter, projectFilter, userFilter, dateFilter, activeTab]);

  // ... existing initial data effect

  const fetchAllTasks = async (page = currentPage) => {
    try {
      setIsLoading(true);

      const isKanban = activeTab === 'Kanban';
      const limit = isKanban ? 1000 : itemsPerPage;
      // In Kanban, always fetch page 1 (all). In List, use requested page.
      const queryPage = isKanban ? 1 : page;

      const params = new URLSearchParams({
        page: queryPage.toString(),
        limit: limit.toString(),
      });

      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (projectFilter && projectFilter !== 'all') params.append('projectId', projectFilter);
      if (userFilter && userFilter !== 'all') params.append('assignedTo', userFilter);
      if (dateFilter && dateFilter !== 'all') params.append('date', dateFilter);

      const response = await axios.get(`/tasks/employees/tasks?${params.toString()}`);

      if (Array.isArray(response.data)) {
        setTasks(response.data);
        setTotalPages(1);
        setTotalTasks(response.data.length);
      } else {
        setTasks(response.data.tasks);
        setTotalPages(response.data.pagination.totalPages);
        setCurrentPage(response.data.pagination.page);
        setTotalTasks(response.data.pagination.total);

        // Only update stats if they are returned (usually yes)
        // KEEP stats global for the user context, as returned by API (which we fixed to be global)
        if (response.data.stats) {
          setDashboardStats(response.data.stats);
        }
      }
    } catch {
      toast.error("Failed to fetch tasks");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      fetchAllTasks(newPage);
    }
  };

  const breadcrumbItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Tasks", href: "/dashboard/tasks" },
  ];

  return (
    <div className="font-sans space-y-8">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tasks</h1>
        {userRole === 'ADMIN' && (
          <Button
            className="rounded-full px-6"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Task
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <SummaryCard
          title="All Tasks"
          value={dashboardStats.totalTasks}
          icon={<ListChecks className="h-4 w-4 text-muted-foreground" />}
          onClick={() => setStatusFilter("all")}
          className={statusFilter === "all" || statusFilter === "" ? "border-primary ring-1 ring-primary" : ""}
        />
        <SummaryCard
          title="Pending Tasks"
          value={dashboardStats.pendingTasks}
          icon={<Hourglass className="h-4 w-4 text-muted-foreground" />}
          onClick={() => setStatusFilter("pending")}
          className={statusFilter === "pending" ? "border-primary ring-1 ring-primary" : ""}
        />
        <SummaryCard
          title="In Progress"
          value={dashboardStats.inProgressTasks}
          icon={<Timer className="h-4 w-4 text-muted-foreground" />}
          onClick={() => setStatusFilter("in-progress")}
          className={statusFilter === "in-progress" ? "border-primary ring-1 ring-primary" : ""}
        />
        <SummaryCard
          title="Completed Tasks"
          value={dashboardStats.completedTasks}
          icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
          onClick={() => setStatusFilter("completed")}
          className={statusFilter === "completed" ? "border-primary ring-1 ring-primary" : ""}
        />
        <SummaryCard title="Points Today" value={dashboardStats.pointsToday} icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />} />
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {userRole === 'ADMIN' && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        )}
        {userRole === 'ADMIN' && (
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Filter by project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {userRole === 'ADMIN' && (
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Filter by user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Filter by date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex space-x-6 border-b border-border">
        <button
          onClick={() => setActiveTab("All Tasks")}
          className={`py-3 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === "All Tasks"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <List className="h-4 w-4" />
          All Tasks
        </button>
        {/* <button
          onClick={() => setActiveTab("Kanban")}
          className={`py-3 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === "Kanban"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Kanban Board
        </button> */}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="animate-spin h-8 w-8 text-primary" />
        </div>
      ) : (
        <div className="h-[calc(100vh-400px)]">
          {activeTab === "All Tasks" && (
            <AllTasks
              tasks={tasks}
              users={users}
              projects={projects}
              setTasks={setTasks}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              itemsPerPage={itemsPerPage}
            />
          )}
          {/* {activeTab === "Kanban" && (
            <KanbanBoard tasks={tasks} users={users} onTaskUpdate={() => fetchAllTasks()} />
          )} */}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div
            ref={modalRef}
            className="bg-card p-6 rounded-lg shadow-lg w-full max-w-lg border border-border z-[10000] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-card-foreground">
                Add New Task
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>

            <AddTaskForm
              users={users}
              projects={projects}
              onTaskAdded={fetchAllTasks}
              onClose={() => setIsModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}