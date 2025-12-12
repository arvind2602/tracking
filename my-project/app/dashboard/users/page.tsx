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
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Breadcrumbs from "@/components/ui/breadcrumbs";
import axios from "@/lib/axios";
import toast from "react-hot-toast";
import { Loader, Trash2, Download, Plus } from "lucide-react";
import { get } from "http";

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
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [positionFilter, setPositionFilter] = useState<string>("");
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);

  const groupedUsers = useMemo(() => {
    const groups: { [key: string]: User[] } = {};
    filteredUsers.forEach((user) => {
      const position = user.position ? user.position.charAt(0).toUpperCase() + user.position.slice(1) : "Unassigned";
      if (!groups[position]) {
        groups[position] = [];
      }
      groups[position].push(user);
    });

    // Sort users within groups: ADMIN first
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        if (a.role === "ADMIN" && b.role !== "ADMIN") return -1;
        if (a.role !== "ADMIN" && b.role === "ADMIN") return 1;
        return 0;
      });
    });

    return groups;
  }, [filteredUsers]);

  useEffect(() => {
    getUsers();
  }, []);

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
      const response = await axios.get("/auth/organization");
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

  const handleDeleteUser = async (userId: string) => {
    const toastId = toast.loading("Deleting...");
    try {
      await axios.delete(`/auth/${userId}`);
      setUsersList((prev) => prev.filter((u) => u.id !== userId));
      toast.success("User deleted", { id: toastId });
    } catch {
      toast.error("Failed to delete user", { id: toastId });
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
    <div className="font-mono">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex justify-between items-center mb-8 mt-4">
        <h1 className="text-4xl font-bold text-white">Users</h1>
        <div className="flex space-x-4">
          <Button
            onClick={handleExportUsers}
            variant="outline"
            className="rounded-full gap-2"
          >
            <Download className="h-4 w-4" />
            Export Users
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="rounded-full gap-2"
          >
            <Plus className="h-4 w-4" />
            Add New User
          </Button>
        </div>
      </div>

      <div className="flex space-x-4 mb-8">
        {userRole === 'ADMIN' && (
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full md:w-1/4">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="USER">USER</SelectItem>
              <SelectItem value="ADMIN">ADMIN</SelectItem>
            </SelectContent>
          </Select>
        )}
        {userRole === 'ADMIN' && (
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="w-full md:w-1/4">
              <SelectValue placeholder="Filter by position" />
            </SelectTrigger>
            <SelectContent>
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
          <Loader className="animate-spin h-12 w-12 text-accent" />
        </div>
      ) : (
        <div className="bg-card/50 backdrop-blur-lg rounded-xl border border-accent/20 shadow-lg overflow-x-auto">
          <div className="flex justify-between items-center p-4">
            <p className="text-sm text-foreground">Total Users: {usersList.length}</p>
          </div>
          <div className="overflow-auto border border-border rounded-lg bg-background">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-muted/40 sticky top-0 z-10">
                <tr>
                  <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[60px]">S.No</th>
                  <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[80px]">Rank</th>
                  <th className="border border-border px-3 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="border border-border px-3 py-2 font-medium text-muted-foreground">Email</th>
                  <th className="border border-border px-3 py-2 font-medium text-muted-foreground">Role</th>
                  <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[100px]">Weekly Pts</th>
                  <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedUsers).sort((a, b) => a[0].localeCompare(b[0])).map(([position, users]) => (
                  <>
                    <tr key={`group-${position}`} className="bg-muted/20">
                      <td colSpan={7} className="border border-border px-3 py-2 font-semibold text-foreground bg-muted/30">
                        {position} <span className="text-muted-foreground font-normal ml-1">({users.length})</span>
                      </td>
                    </tr>
                    {users.map((u, index) => (
                      <tr key={u.id} className="group hover:bg-accent/5 transition-colors">
                        <td className="border border-border px-3 py-1.5 align-middle text-muted-foreground font-mono text-xs">
                          {index + 1}
                        </td>
                        <td className="border border-border px-3 py-1.5 align-middle text-center">
                          {u.rank ? (
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${u.rank === '1' || u.rank === 1 ? 'bg-yellow-500/20 text-yellow-600 border border-yellow-500/50' : u.rank === '2' || u.rank === 2 ? 'bg-gray-400/20 text-gray-400 border border-gray-400/50' : u.rank === '3' || u.rank === 3 ? 'bg-orange-500/20 text-orange-600 border border-orange-500/50' : 'text-muted-foreground'}`}>
                              {u.rank}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="border border-border px-3 py-1.5 align-middle">
                          <span
                            className="cursor-pointer font-medium hover:underline decoration-primary/50 underline-offset-4"
                            onClick={() => router.push(`/dashboard/users/${u.id}/tasks`)}
                          >
                            {`${u.firstName} ${u.lastName}`}
                          </span>
                        </td>
                        <td className="border border-border px-3 py-1.5 align-middle">{u.email}</td>
                        <td className="border border-border px-3 py-1.5 align-middle">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="border border-border px-3 py-1.5 align-middle font-mono text-sm">
                          {u.weeklyPoints || 0}
                        </td>
                        <td className="border border-border px-3 py-1.5 align-middle">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              onClick={() => handleDeleteUser(u.id)}
                              title="Delete User"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-card/80 backdrop-blur-lg p-8 rounded-2xl shadow-xl w-full max-w-lg border border-accent/20">
            <h2 className="text-3xl font-bold text-white mb-6">Add New User</h2>
            <div className="space-y-6">
              <Input
                placeholder="First Name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white"
              />
              <Input
                placeholder="Last Name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white"
              />
              <Input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white"
              />
              <Input
                placeholder="Position"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white"
              />
              <Select
                value={form.role}
                onValueChange={(val: "USER" | "ADMIN") => setForm({ ...form, role: val })}
              >
                <SelectTrigger className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">USER</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white"
              />
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
                onClick={handleSubmit}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}