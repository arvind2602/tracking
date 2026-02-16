import { ReactNode } from "react";

/** All valid task statuses matching the backend enum/string values. */
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'pending-review';

/** Legacy alias kept for backward compatibility. */
export type Status = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
  source?: string;
  taskDescription?: string;
}

export interface TaskAssignee {
  id: string;
  taskId: string;
  employeeId: string;
  order?: number;
  isCompleted: boolean;
  assignedAt: string;
  completedAt?: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string | null;
  status: TaskStatus | string;
  points: number | null;
  createdAt: Date;
  updatedAt: Date;
  employeeId: string | null;
  projectId: string;
  comments: Comment[];
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string;
  completedAt?: string;
  order?: number;
  creatorFirstName?: string;
  creatorLastName?: string;
  assigned_at?: string;
  createdBy?: string;
  parentId?: string;
  subtasks?: Task[];
  type?: 'SINGLE' | 'SHARED' | 'SEQUENTIAL';
  assignees?: TaskAssignee[];
  latestComment?: string;
}

export interface Employee {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  archived: boolean;
  organizationId: string;
}

export interface Project {
  id: string;
  name: string;
  organizationId: string;
  priority_order?: number | null;
  headId?: string | null;
  headName?: string | null;
}

export interface Organization {
  id: string;
  name: string;
}

export interface User {
  firstName: string;
  lastName: string;
  id: string;
  name: string;
  email: string;
  organizationId: string;
}