import { ReactNode } from "react";

export type Status = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
}

export interface Task {
  description: ReactNode;
  assignedTo: any;
  id: string;
  title: string;
  status: Status;
  points: number | null;
  createdAt: Date;
  updatedAt: Date;
  employeeId: string | null;
  projectId: string;
  comments: Comment[];
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
  firstName: ReactNode;
  lastName: ReactNode;
  id: string;
  name: string;
  email: string;
  organizationId: string;
}