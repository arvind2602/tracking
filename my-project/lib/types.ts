import { ReactNode } from "react";

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
  id: string; // TaskAssignee ID
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
  description: ReactNode;
  assignedTo: any;
  id: string;
  title: string;
  status: string; // Changed to string to match backend
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
  parentId?: string;
  subtasks?: Task[];
  type?: 'SINGLE' | 'SHARED' | 'SEQUENTIAL';
  assignees?: TaskAssignee[];
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  archived: boolean;
  organizationId: string;
}

export interface Project {
  id: string;
  name: string;
  organizationId: string;
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