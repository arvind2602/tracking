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
import { User, Project } from "@/lib/types";

interface AddTaskFormProps {
  users: User[];
  projects: Project[];
  onTaskAdded: () => void;
  onClose: () => void;
}

export function AddTaskForm({ users, projects, onTaskAdded, onClose }: AddTaskFormProps) {
  const [form, setForm] = useState<{
    description: string;
    status: "pending" | "in-progress" | "completed";
    assignedTo: string | undefined;
    points: string;
    projectId: string;
  }>({
    description: "",
    status: "pending",
    assignedTo: undefined, // Make assignedTo optional
    points: "",
    projectId: "",
  });

  const handleAddTask = async () => {
    const toastId = toast.loading("Adding task...");
    try {
      await axios.post("/tasks", form);
      onTaskAdded();
      onClose();
      toast.success("Task added", { id: toastId });
    } catch {
      toast.error("Failed to add task", { id: toastId });
    }
  };

  return (
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
        onValueChange={(val) => setForm({ ...form, assignedTo: val || undefined })}
      >
        <SelectTrigger className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white">
          <SelectValue placeholder="Assign To" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Unassigned</SelectItem>
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
  step="any"
  min="0"
  value={form.points}
  onChange={(e) => setForm({ ...form, points: e.target.value })}
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
          onClick={handleAddTask}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
