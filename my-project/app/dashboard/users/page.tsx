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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useMemo } from "react";
import React from "react";
import { useRouter } from "next/navigation";
import Breadcrumbs from "@/components/ui/breadcrumbs";
import axios from "@/lib/axios";
import toast from "react-hot-toast";
import { Loader, Trash2, Download, Plus } from "lucide-react";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { cn } from "@/lib/utils";
import { TaskPoints } from "@/components/reports/TaskPoints";


interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  role: string;
  rank?: number;
  weeklyPoints?: number;
}

export default function Users() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    position: "",
    role: "USER" as "USER" | "ADMIN",
  });
  const [usersList, setUsersList] = useState<User[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [positionFilter, setPositionFilter] = useState<string>("");
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [sortBy, setSortBy] = useState<string>('weeklyPoints');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const groupedUsers = useMemo(() => {
    const groups: { [key: string]: User[] } = {};

    // First, separate users by role
    const adminUsers = filteredUsers.filter(user => user.role === "ADMIN");
    const regularUsers = filteredUsers.filter(user => user.role !== "ADMIN");

    // Process admins first
    adminUsers.forEach((user) => {
      const position = user.position ? user.position.charAt(0).toUpperCase() + user.position.slice(1) : "Unassigned";
      const key = `ADMIN - ${position}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(user);
    });

    // Then process regular users
    regularUsers.forEach((user) => {
      const position = user.position ? user.position.charAt(0).toUpperCase() + user.position.slice(1) : "Unassigned";
      if (!groups[position]) {
        groups[position] = [];
      }
      groups[position].push(user);
    });

    return groups;
  }, [filteredUsers]);

  useEffect(() => {
    getUsers();
  }, [sortBy, sortOrder]);

  useEffect(() => {
    let filtered = usersList;
    if (roleFilter && roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }
    if (positionFilter && positionFilter !== "all") {
      filtered = filtered.filter((user) => user.position === positionFilter);
    }
    setFilteredUsers(filtered);
  }, [usersList, roleFilter, positionFilter]);

  const getUsers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);

      const response = await axios.get(`/auth/organization?${params.toString()}`);
      setUsersList(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    const toastId = toast.loading("Adding user...");
    try {
      const { data } = await axios.post("/auth/register", form);
      getUsers();
      setIsModalOpen(false);
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        position: "",
        role: "USER",
      });
      toast.success("User added", { id: toastId });
    } catch {
      toast.error("Failed to add user", { id: toastId });
    }
  };

  const initiateDeleteUser = (userId: string) => {
    setUserToDelete(userId);
    setDeleteModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    const toastId = toast.loading("Deleting...");
    try {
      await axios.delete(`/auth/${userToDelete}`);
      setUsersList((prev) => prev.filter((u) => u.id !== userToDelete));
      toast.success("User deleted", { id: toastId });
    } catch {
      toast.error("Failed to delete user", { id: toastId });
    } finally {
      setUserToDelete(null);
    }
  };

  const handleExportUsers = async () => {
    const toastId = toast.loading("Exporting users...");
    try {
      const response = await axios.get("/auth/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "users.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Users exported", { id: toastId });
    } catch {
      toast.error("Export failed", { id: toastId });
    }
  };

  const breadcrumbItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Users", href: "/dashboard/users" },
  ];

  return (
    <div className="space-y-4">
      <Breadcrumbs items={breadcrumbItems} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Users Management
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-sm">Manage and monitor organizational members.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Button
            onClick={handleExportUsers}
            className="bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl px-6 py-4 transition-all duration-300 gap-2"
          >
            <Download className="h-4 w-4" />
            Export Users
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-none rounded-xl px-6 py-4 shadow-lg shadow-blue-500/20 transition-all duration-300 gap-2 font-semibold"
          >
            <Plus className="h-4 w-4" />
            Add New User
          </Button>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="bg-secondary border border-border rounded-xl p-1 mb-4">
          <TabsTrigger
            value="list"
            className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white px-6 py-2 font-medium transition-all"
          >
            Users List
          </TabsTrigger>
          <TabsTrigger
            value="heatmap"
            className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white px-6 py-2 font-medium transition-all"
          >
            Performance Heatmap
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {userRole === 'ADMIN' && (
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full md:w-1/4 bg-card border-border text-foreground rounded-xl py-4">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-slate-300">
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="USER">USER</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            )}
            {userRole === 'ADMIN' && (
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-full md:w-1/4 bg-card border-border text-foreground rounded-xl py-4">
                  <SelectValue placeholder="Filter by position" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-slate-300">
                  <SelectItem value="all">All Positions</SelectItem>
                  {[...new Set(usersList.map((user) => user.position).filter(Boolean))].map((position) => (
                    <SelectItem key={position} value={position}>
                      {position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full animate-pulse"></div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-4 py-3 font-semibold text-slate-400 uppercase tracking-wider">S.No</th>
                      <th
                        className="px-4 py-3 font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-secondary/80 transition-colors select-none"
                        onClick={() => {
                          if (sortBy === 'firstName') {
                            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                          } else {
                            setSortBy('firstName');
                            setSortOrder('DESC');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          Name
                          {sortBy === 'firstName' && (
                            <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-secondary/80 transition-colors select-none"
                        onClick={() => {
                          if (sortBy === 'email') {
                            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                          } else {
                            setSortBy('email');
                            setSortOrder('DESC');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          Email
                          {sortBy === 'email' && (
                            <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-secondary/80 transition-colors select-none"
                        onClick={() => {
                          if (sortBy === 'role') {
                            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                          } else {
                            setSortBy('role');
                            setSortOrder('DESC');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          Role
                          {sortBy === 'role' && (
                            <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 font-semibold text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:bg-secondary/80 transition-colors select-none"
                        onClick={() => {
                          if (sortBy === 'weeklyPoints') {
                            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                          } else {
                            setSortBy('weeklyPoints');
                            setSortOrder('DESC');
                          }
                        }}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Weekly Pts
                          {sortBy === 'weeklyPoints' && (
                            <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {Object.entries(groupedUsers).sort((a, b) => a[0].localeCompare(b[0])).map(([position, users]) => (
                      <React.Fragment key={`group-${position}`}>
                        <tr className="bg-secondary/50">
                          <td colSpan={6} className="px-4 py-2 font-bold text-blue-400/80 bg-blue-500/5 text-xs uppercase tracking-widest">
                            {position} ({users.length})
                          </td>
                        </tr>
                        {users.map((u, index) => (
                          <tr key={u.id} className="group hover:bg-secondary transition-all duration-300">
                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                              {String(index + 1).padStart(2, '0')}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                className="font-semibold text-foreground hover:text-blue-400 transition-colors"
                                onClick={() => router.push(`/dashboard/users/${u.id}/tasks`)}
                              >
                                {u.firstName} {u.lastName}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-slate-400">{u.email}</td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border",
                                u.role === 'ADMIN'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              )}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-mono text-foreground font-bold">
                                {u.weeklyPoints || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-400 transition-colors"
                                onClick={() => initiateDeleteUser(u.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="heatmap">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
            <TaskPoints />
          </div>
        </TabsContent>
      </Tabs>

      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border p-8 rounded-[2rem] shadow-2xl w-full max-w-lg animate-in zoom-in duration-300">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-foreground tracking-tight">Add New User</h2>
              <p className="text-muted-foreground mt-2">Create a new member for your organization.</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="First Name"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="bg-input border-input text-foreground rounded-xl py-6 focus:border-ring"
                />
                <Input
                  placeholder="Last Name"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="bg-input border-input text-foreground rounded-xl py-6 focus:border-ring"
                />
              </div>
              <Input
                placeholder="Email Address"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-input border-input text-foreground rounded-xl py-6 focus:border-ring"
              />
              <Input
                placeholder="Position (e.g. Developer, Designer)"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="bg-input border-input text-foreground rounded-xl py-6 focus:border-ring"
              />
              <Select
                value={form.role}
                onValueChange={(val: "USER" | "ADMIN") => setForm({ ...form, role: val })}
              >
                <SelectTrigger className="bg-card border-border text-foreground rounded-xl py-6">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-slate-300">
                  <SelectItem value="USER">Standard User</SelectItem>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Initial Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="bg-input border-input text-foreground rounded-xl py-6 focus:border-ring"
              />
            </div>
            <div className="flex gap-4 mt-10">
              <Button
                variant="ghost"
                className="flex-1 rounded-xl py-6 text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-none rounded-xl py-6 font-bold shadow-lg shadow-blue-500/20"
                onClick={handleSubmit}
              >
                Create User
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteUser}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone and will remove all their data."
        confirmText="Delete User"
        variant="destructive"
      />
    </div>
  );
}
