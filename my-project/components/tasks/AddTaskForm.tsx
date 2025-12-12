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
    priority: "LOW" | "MEDIUM" | "HIGH";
    dueDate: string;
  }>({
    description: "",
    status: "pending",
    assignedTo: undefined,
    points: "",
    projectId: "",
    priority: "MEDIUM",
    dueDate: "",
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
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">Task Description</label>
        <Input
          placeholder="Enter task details"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Status</label>
          <Select
            value={form.status}
            onValueChange={(val: "pending" | "in-progress" | "completed") =>
              setForm({ ...form, status: val })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Priority</label>
          <Select
            value={form.priority}
            onValueChange={(val: "LOW" | "MEDIUM" | "HIGH") =>
              setForm({ ...form, priority: val })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Assign To</label>
          <Select
            value={form.assignedTo || "unassigned"}
            onValueChange={(val) => setForm({ ...form, assignedTo: val === "unassigned" ? undefined : val })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Due Date</label>
          <Input
            type="datetime-local"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Points</label>
          <Input
            placeholder="0"
            type="number"
            step="any"
            min="0"
            value={form.points}
            onChange={(e) => setForm({ ...form, points: e.target.value })}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Project</label>
          <Select
            value={form.projectId}
            onValueChange={(val) => setForm({ ...form, projectId: val })}
          >
            <SelectTrigger className="w-full">
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
      </div>
      <div className="flex justify-end space-x-4 mt-8">
        <Button
          variant="outline"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          onClick={handleAddTask}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
