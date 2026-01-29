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
import { ListChecks, Hourglass, CheckCircle, Plus, LayoutGrid, List, Timer, Sparkles } from 'lucide-react';
import { cn } from "@/lib/utils";
import React from 'react';


interface DecodedToken {
  user: {
    role: string;
    uuid: string;
    organization_uuid: string;
  };
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

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

  // Initial initialization
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }

    try {
      const payload: DecodedToken = jwtDecode(token);
      setUserRole(payload.user.role);
      setCurrentUserId(payload.user.uuid);
    } catch {
      router.push("/");
      return;
    }

    const fetchInitialData = async () => {
      try {
        const [projectsResponse, usersResponse] = await Promise.all([
          axios.get("/projects"),
          axios.get(`/auth/organization`),
        ]);
        setProjects(projectsResponse.data);
        setUsers(usersResponse.data);
        // fetchAllTasks will be triggered by dependency effect or called here once
        await fetchAllTasks(1);
      } catch {
        toast.error("Failed to fetch initial data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
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
    // Skip the very first run as initialData fetch handles it
    if (!isLoading) {
      fetchAllTasks(1);
    }
  }, [statusFilter, projectFilter, userFilter, dateFilter, activeTab, sortBy, sortOrder]);

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
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);

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

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full animate-pulse"></div>
        </div>
        <p className="text-muted-foreground animate-pulse">Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs items={breadcrumbItems} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Tasks
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-sm">Manage and monitor organizational tasks.</p>
        </div>
        {userRole === 'ADMIN' && (
          <Button
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-none rounded-xl px-6 py-4 shadow-lg shadow-blue-500/20 transition-all duration-300 gap-2 font-bold"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="h-5 w-5" />
            Add New Task
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard
          title="All Tasks"
          value={dashboardStats.totalTasks}
          icon={<ListChecks className="h-5 w-5 text-slate-400" />}
          onClick={() => setStatusFilter("all")}
          className={cn(
            "transition-all duration-300",
            (statusFilter === "all" || statusFilter === "") && "border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/10"
          )}
        />
        <SummaryCard
          title="Pending"
          value={dashboardStats.pendingTasks}
          icon={<Hourglass className="h-5 w-5 text-amber-400" />}
          onClick={() => setStatusFilter("pending")}
          className={cn(
            "transition-all duration-300",
            statusFilter === "pending" && "border-amber-500/50 bg-amber-500/10 shadow-lg shadow-amber-500/10"
          )}
        />
        <SummaryCard
          title="In Progress"
          value={dashboardStats.inProgressTasks}
          icon={<Timer className="h-5 w-5 text-blue-400" />}
          onClick={() => setStatusFilter("in-progress")}
          className={cn(
            "transition-all duration-300",
            statusFilter === "in-progress" && "border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/10"
          )}
        />
        <SummaryCard
          title="Completed"
          value={dashboardStats.completedTasks}
          icon={<CheckCircle className="h-5 w-5 text-emerald-400" />}
          onClick={() => setStatusFilter("completed")}
          className={cn(
            "transition-all duration-300",
            statusFilter === "completed" && "border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
          )}
        />
        <SummaryCard
          title="Points Today"
          value={dashboardStats.pointsToday}
          icon={<Sparkles className="h-5 w-5 text-purple-400" />}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {userRole === 'ADMIN' && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[220px] bg-card border-border text-foreground rounded-xl py-4">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 text-slate-300">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        )}
        {userRole === 'ADMIN' && (
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full md:w-[220px] bg-card border-border text-foreground rounded-xl py-4">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 text-slate-300">
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
            <SelectTrigger className="w-full md:w-[220px] bg-white/5 border-white/10 text-slate-300 rounded-xl py-4">
              <SelectValue placeholder="Assigned To" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 text-slate-300">
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
          <SelectTrigger className="w-full md:w-[220px] bg-card border-border text-foreground rounded-xl py-4">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-white/10 text-slate-300">
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
          className={`pb-2 border-b-2 font-bold text-sm transition-all duration-300 flex items-center gap-2 uppercase tracking-widest ${activeTab === "All Tasks"
            ? "border-blue-500 text-blue-400"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <List className="h-4 w-4" />
          All Tasks
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full animate-pulse"></div>
          </div>
        </div>
      ) : (
        <div className="min-h-[500px] bg-card border border-border rounded-[2rem] overflow-hidden">
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
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={(column) => {
                if (sortBy === column) {
                  setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                } else {
                  setSortBy(column);
                  setSortOrder('DESC');
                }
              }}
            />
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div
            ref={modalRef}
            className="bg-card border border-border p-8 rounded-[2rem] shadow-2xl w-full max-w-lg animate-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-foreground tracking-tight">
                Add New Task
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-8 w-8 rotate-45" />
              </button>
            </div>

            <AddTaskForm
              users={users}
              projects={projects}
              onTaskAdded={fetchAllTasks}
              onClose={() => setIsModalOpen(false)}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      )}
    </div>
  );
}

