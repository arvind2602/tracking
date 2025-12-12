'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import axios from "@/lib/axios";
import toast from "react-hot-toast";

interface AddUserFormProps {
  organizationId: string;
  onUserAdded: () => void;
  onClose: () => void;
}

export function AddUserForm({ organizationId, onUserAdded, onClose }: AddUserFormProps) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    position: "",
    role: "USER" as "USER" | "ADMIN",
    organizationId,
  });

  const handleSubmit = async () => {
    const toastId = toast.loading("Adding user...");
    try {
      await axios.post("/auth/register", form);
      onUserAdded();
      onClose();
      toast.success("User added", { id: toastId });
    } catch {
      toast.error("Failed to add user", { id: toastId });
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">First Name</label>
          <Input
            placeholder="John"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Last Name</label>
          <Input
            placeholder="Doe"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="w-full"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">Email Address</label>
        <Input
          placeholder="john.doe@example.com"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Position</label>
          <Input
            placeholder="Developer"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Role</label>
          <Select
            value={form.role}
            onValueChange={(val: "USER" | "ADMIN") => setForm({ ...form, role: val })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">User</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">Password</label>
        <Input
          placeholder="••••••••"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full"
        />
      </div>

      <div className="flex justify-end space-x-4 mt-8">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit}>
          Save
        </Button>
      </div>
    </div>
  );
}
