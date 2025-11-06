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
    <div className="space-y-6">
      <Input
        placeholder="First Name"
        value={form.firstName}
        onChange={(e) =>
          setForm({ ...form, firstName: e.target.value })
        }
        className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white"
      />
      <Input
        placeholder="Last Name"
        value={form.lastName}
        onChange={(e) =>
          setForm({ ...form, lastName: e.target.value })
        }
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
        onChange={(e) =>
          setForm({ ...form, position: e.target.value })
        }
        className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white"
      />
      <Select
        value={form.role}
        onValueChange={(val: "USER" | "ADMIN") =>
          setForm({ ...form, role: val })
        }
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
        onChange={(e) =>
          setForm({ ...form, password: e.target.value })
        }
        className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white"
      />
      <div className="flex justify-end space-x-4 mt-8">
        <Button
          variant="outline"
          className="rounded-full px-6 py-3 border-accent/50 text-accent hover:bg-accent/10"
          onClick={onClose}
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
  );
}
