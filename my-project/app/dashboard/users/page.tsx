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
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Breadcrumbs from "@/components/ui/breadcrumbs";
import axios from "@/lib/axios";
import toast from "react-hot-toast";
import { Loader } from "lucide-react";
import { get } from "http";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  role: string;
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
      const response = await axios.get("/users/export", { responseType: "blob" });
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
          {userRole === "ADMIN" && (
            <Button
              onClick={handleExportUsers}
              className="bg-green-500 text-white hover:bg-green-600 rounded-full px-6 py-3 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
            >
              Export Users
            </Button>
          )}
          <Button
            className="bg-primary text-white hover:bg-primary/90 rounded-full px-6 py-3 shadow-[0_0_15px_rgba(37,99,235,0.5)]"
            onClick={() => setIsModalOpen(true)}
          >
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
        <div className="bg-card/50 backdrop-blur-lg rounded-xl border border-accent/20 shadow-lg">
          <div className="flex justify-between items-center p-4">
            <p className="text-sm text-white">Total Users: {usersList.length}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left responsive-table">
              <thead className="border-b border-accent/20">
                <tr>
                  <th className="p-4 font-semibold">Name</th>
                  <th className="p-4 font-semibold">Email</th>
                  <th className="p-4 font-semibold">Position</th>
                  <th className="p-4 font-semibold">Role</th>
                  <th className="p-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-accent/20">
                    <td className="p-4" data-label="Name">
                      <span
                        className="cursor-pointer"
                        onClick={() => router.push(`/dashboard/users/${u.id}/tasks`)}
                      >
                        {`${u.firstName} ${u.lastName}`}
                      </span>
                    </td>
                    <td className="p-4" data-label="Email">{u.email}</td>
                    <td className="p-4" data-label="Position">{u.position}</td>
                    <td className="p-4" data-label="Role">{u.role}</td>
                    <td className="p-4" data-label="Actions">
                      <Button variant="destructive" onClick={() => handleDeleteUser(u.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
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