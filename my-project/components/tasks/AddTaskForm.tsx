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
import { useState, useEffect } from "react";
import axios from "@/lib/axios";
import toast from "react-hot-toast";
import { User, Project } from "@/lib/types";

interface AddTaskFormProps {
  users: User[];
  projects: Project[];
  onTaskAdded: () => void;
  onClose: () => void;
  parentId?: string;
  parentTask?: any;
  currentUserId?: string | null;
}

export function AddTaskForm({ users, projects, onTaskAdded, onClose, parentId, parentTask, currentUserId }: AddTaskFormProps) {
  const [percentage, setPercentage] = useState<string>("");
  const [form, setForm] = useState<{
    description: string;
    status: "pending" | "in-progress" | "completed";
    assignedTo: string | undefined;
    points: string;
    projectId: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    dueDate: string;
    parentId?: string;
  }>({
    description: "",
    status: "pending",
    assignedTo: undefined,
    points: "",
    projectId: "",
    priority: "MEDIUM",
    dueDate: "",
    parentId: parentId || (parentTask ? parentTask.id : undefined),
  });

  useEffect(() => {
    if (parentTask) {
      setForm(prev => ({
        ...prev,
        projectId: parentTask.projectId,
        assignedTo: currentUserId || undefined,
        parentId: parentTask.id
      }));
    }
  }, [parentTask, currentUserId]);

  useEffect(() => {
    if (parentTask && percentage && parentTask.points) {
      const calculatedPoints = (parseFloat(percentage) / 100) * Number(parentTask.points);
      const decimalPoints = calculatedPoints.toFixed(2);
      setForm(prev => ({ ...prev, points: decimalPoints }));
    }
  }, [percentage, parentTask]);

  const handleAddTask = async () => {
    const toastId = toast.loading("Adding task...");
    try {
      const payload = { ...form, points: Number(form.points) };
      await axios.post("/tasks", payload);
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
        {!parentTask && (
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
        )}

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
          <label className="text-sm font-medium leading-none">
            {parentTask ? "Percentage of Parent Task" : "Points"}
          </label>
          {parentTask ? (
            <div className="flex items-center gap-2">
              <Input
                placeholder="e.g. 50"
                type="number"
                min="0"
                max="100"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                className="w-full"
              />
              <span className="text-sm font-bold">%</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                ({form.points || 0} pts)
              </span>
            </div>
          ) : (
            <Input
              placeholder="0"
              type="number"
              step="any"
              min="0"
              value={form.points}
              onChange={(e) => setForm({ ...form, points: e.target.value })}
              className="w-full"
            />
          )}
        </div>

        {!parentTask && (
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
        )}
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
    </div >
  );
}
