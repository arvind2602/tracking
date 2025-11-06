'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Breadcrumbs from '@/components/ui/breadcrumbs';
import axios from '@/lib/axios';
import toast from 'react-hot-toast';
import { Loader } from 'lucide-react';
import Link from 'next/link';

interface Task {
  id: string;
  description: string;
  status: string;
  points: number;
  assignedToName: string;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;
  tasks: Task[];
}

const ProjectDetailsPage = () => {
  const params = useParams();
  const { projectId } = params;
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`/projects/${projectId}`);
        setProject(response.data);
      } catch (error) {
        toast.error('Failed to fetch project details');
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin h-12 w-12 text-accent" />
      </div>
    );
  }

  if (!project) {
    return <div>Project not found</div>;
  }

  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Projects', href: '/dashboard/projects' },
    { label: project.name, href: `/dashboard/projects/${project.id}` },
  ];

  const stats = [
    { label: 'Total Tasks', value: project.tasks?.length || 0 },
    { label: 'Completed', value: project.tasks?.filter((t: Task) => t.status === 'DONE').length || 0 },
    { label: 'In Progress', value: project.tasks?.filter((t: Task) => t.status === 'IN_PROGRESS').length || 0 },
    { label: 'To Do', value: project.tasks?.filter((t: Task) => t.status === 'TODO').length || 0 },
  ];

  return (
    <div>
      <Breadcrumbs items={breadcrumbItems} />
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border rounded-xl p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Project Info */}
      <div className="mt-8">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-muted-foreground mt-1">{project.description}</p>
        <p className="text-sm text-gray-500 mt-2">
          Started: {new Date(project.startDate).toLocaleDateString('en-IN')}
        </p>
      </div>

      {/* Tasks */}
      <h2 className="text-xl font-bold mt-8 mb-4">Tasks</h2>
      {project.tasks?.length > 0 ? (
        <div className="space-y-3">
          {project.tasks.map((task: Task) => (
            <div key={task.id} className="p-4 border rounded-lg bg-card hover:bg-accent/5 transition cursor-pointer">
              <Link href={`/dashboard/tasks/${task.id}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium">{task.description}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Status:{' '}
                      <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ml-1
                        ${task.status === 'DONE' ? 'bg-green-100 text-green-800' :
                          task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                          task.status === 'TODO' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'}`}>
                        {task.status}
                      </span>
                      {' | Points: '}{task.points}{' | '}
                      Assigned to:{' '}
                      <span className="font-semibold text-primary">
                        {task.assignedToName}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Created: {new Date(task.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      {task.updatedAt && task.updatedAt !== task.createdAt && (
                        <> | Updated: {new Date(task.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</>
                      )}
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No tasks yet.</p>
      )}
    </div>
  );
};

export default ProjectDetailsPage;