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
import { useState, useEffect, useRef } from "react";
import axios from "@/lib/axios";
import toast from "react-hot-toast";
import { User, Project } from "@/lib/types";
import { Command, CommandGroup, CommandItem, CommandList, CommandInput, CommandEmpty } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
  // Multi-select state
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<{
    description: string;
    status: "pending" | "in-progress" | "completed";
    points: string;
    projectId: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    dueDate: string;
    parentId?: string;
    type: "SINGLE" | "SHARED" | "SEQUENTIAL";
  }>({
    description: "",
    status: "pending",
    points: "",
    projectId: "",
    priority: "MEDIUM",
    dueDate: "",
    parentId: parentId || (parentTask ? parentTask.id : undefined),
    type: "SINGLE"
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAssignDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (parentTask) {
      setForm(prev => ({
        ...prev,
        projectId: parentTask.projectId,
        parentId: parentTask.id
      }));
      if (currentUserId) {
        setSelectedAssignees([currentUserId]);
      }
    }
  }, [parentTask, currentUserId]);

  useEffect(() => {
    if (selectedAssignees.length > 1) {
      // If transitioning from 1 to >1, default to SHARED if previously SINGLE
      if (form.type === 'SINGLE') {
        setForm(prev => ({ ...prev, type: 'SHARED' }));
      }
    } else {
      // If 0 or 1, force SINGLE
      if (form.type !== 'SINGLE') {
        setForm(prev => ({ ...prev, type: 'SINGLE' }));
      }
    }
  }, [selectedAssignees.length]);

  useEffect(() => {
    if (parentTask && percentage && parentTask.points) {
      const calculatedPoints = (parseFloat(percentage) / 100) * Number(parentTask.points);
      const decimalPoints = calculatedPoints.toFixed(2);
      setForm(prev => ({ ...prev, points: decimalPoints }));
    }
  }, [percentage, parentTask]);

  useEffect(() => {
    // Only run if we have a currentUserId, projects are loaded, no project is selected yet, and we are not in subtask mode
    if (currentUserId && projects.length > 0 && !form.projectId && !parentTask) {
      // Find a project where the current user is the head
      const headedProject = projects.find(p => p.headId === currentUserId);
      if (headedProject) {
        setForm(prev => ({ ...prev, projectId: headedProject.id }));
      }
    }
  }, [projects, currentUserId, parentTask, form.projectId]); // Added form.projectId to deps to run once when it's empty

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleAddTask = async () => {
    const toastId = toast.loading("Adding task...");
    try {
      const payload: any = {
        ...form,
        points: Number(form.points),
        assignees: selectedAssignees
      };

      // Handle Single vs Multiple Logic for backend compatibility
      if (selectedAssignees.length === 1) {
        payload.assignedTo = selectedAssignees[0];
        payload.type = 'SINGLE';
      } else if (selectedAssignees.length > 1) {
        payload.type = form.type; // SHARED or SEQUENTIAL
      }
      // If 0 assignees, assignedTo remains undefined (Unassigned)

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
          <div className="space-y-2" ref={dropdownRef}>
            <label className="text-sm font-medium leading-none">Assign To</label>
            <div className="relative">
              <div
                className="flex min-h-[40px] w-full flex-wrap items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                onClick={() => setAssignDropdownOpen(!assignDropdownOpen)}
              >
                <div className="flex flex-wrap gap-1">
                  {selectedAssignees.length > 0 ? (
                    selectedAssignees.map(userId => {
                      const user = users.find(u => u.id === userId);
                      return (
                        <Badge key={userId} variant="secondary" className="mr-1">
                          {user?.firstName} {user?.lastName}
                          <div
                            className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAssignee(userId);
                            }}
                          >
                            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </div>
                        </Badge>
                      );
                    })
                  ) : (
                    <span className="text-muted-foreground">Select Members</span>
                  )}
                </div>
              </div>
              {assignDropdownOpen && (
                <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95">
                  <Command>
                    <CommandInput placeholder="Search users..." />
                    <CommandList>
                      <CommandEmpty>No users found.</CommandEmpty>
                      <CommandGroup className="max-h-60 overflow-auto">
                        {users.map((user) => (
                          <CommandItem
                            key={user.id}
                            onSelect={() => toggleAssignee(user.id)}
                            className="cursor-pointer flex items-center justify-between"
                          >
                            <span>{user.firstName} {user.lastName}</span>
                            {selectedAssignees.includes(user.id) && <Check className="h-4 w-4" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>
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

      {/* Task Type Selector - Only visible when multiple assignees */}
      {selectedAssignees.length > 1 && (
        <div className="space-y-2 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
          <label className="text-sm font-medium leading-none text-blue-400">Task Mode</label>
          <div className="flex gap-4">
            <div
              className={cn(
                "flex-1 p-3 rounded-md border cursor-pointer transition-all",
                form.type === 'SHARED' ? "bg-blue-500/20 border-blue-500 text-blue-100" : "bg-transparent border-slate-700 text-slate-400 hover:bg-slate-800"
              )}
              onClick={() => setForm({ ...form, type: 'SHARED' })}
            >
              <div className="font-bold flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-blue-400" />
                Shared
              </div>
              <p className="text-xs opacity-80">Task is shared with everyone. Points divided equally.</p>
            </div>

            <div
              className={cn(
                "flex-1 p-3 rounded-md border cursor-pointer transition-all",
                form.type === 'SEQUENTIAL' ? "bg-purple-500/20 border-purple-500 text-purple-100" : "bg-transparent border-slate-700 text-slate-400 hover:bg-slate-800"
              )}
              onClick={() => setForm({ ...form, type: 'SEQUENTIAL' })}
            >
              <div className="font-bold flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-purple-400" />
                Sequential
              </div>
              <p className="text-xs opacity-80">Task moves from one user to next upon completion.</p>
            </div>
          </div>
        </div>
      )}

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

