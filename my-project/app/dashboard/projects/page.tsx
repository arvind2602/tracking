'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import Breadcrumbs from '@/components/ui/breadcrumbs';
import axios from '@/lib/axios';
import toast from 'react-hot-toast';
import { Loader } from 'lucide-react';
import { jwtDecode } from 'jwt-decode';

const ProjectsPage = () => {
  interface Project {
    id: number;
    name: string;
    description: string;
    startDate: string;
  }
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectStartDate, setNewProjectStartDate] = useState('');
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload: any = jwtDecode(token);
        setUserRole(payload.user.role);
      } catch (error) {
        console.error('Invalid token', error);
      }
    }
  }, []);

  useEffect(() => {
    let filtered = projects;
    if (searchQuery) {
      filtered = filtered.filter((project) =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredProjects(filtered);
  }, [projects, searchQuery]);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('/projects');
      setProjects(response.data);
    } catch (error) {
      toast.error('Failed to fetch projects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProject = async () => {
    if (newProjectName.trim() !== '' && newProjectStartDate.trim() !== '') {
      const toastId = toast.loading('Adding project...');
      try {
        const response = await axios.post('/projects', {
          name: newProjectName,
          description: newProjectDescription,
          startDate: newProjectStartDate,
        });
        setProjects([...projects, response.data]);
        setNewProjectName('');
        setNewProjectDescription('');
        setNewProjectStartDate('');
        setIsModalOpen(false);
        toast.success('Project added successfully', { id: toastId });
      } catch (error) {
        toast.error('Failed to add project', { id: toastId });
      }
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    const toastId = toast.loading('Deleting project...');
    try {
      await axios.delete(`/projects/${projectId}`);
      setProjects(projects.filter(p => p.id !== projectId));
      toast.success('Project deleted successfully', { id: toastId });
    } catch (error) {
      toast.error('Failed to delete project', { id: toastId });
    }
  };

  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Projects', href: '/dashboard/projects' },
  ];

  return (
    <div>
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex justify-between items-center mb-4 mt-4">
        <h1 className="text-2xl font-bold">Projects</h1>
        {userRole === 'ADMIN' && (
          <div className="flex space-x-4">
            <Input
              type="text"
              placeholder="Search by name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64"
            />
            <Button onClick={() => setIsModalOpen(true)}>Add New Project</Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="animate-spin h-12 w-12 text-accent" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left responsive-table">
            <thead className="border-b border-accent/20">
              <tr>
                <th className="p-4 font-semibold">Name</th>
                <th className="p-4 font-semibold">Description</th>
                <th className="p-4 font-semibold">Actions</th>
              </tr>
            </thead>
                          <tbody>
                            {filteredProjects.map((project) => (                <tr key={project.id} className="border-b border-accent/20">
                  <td className="p-4" data-label="Name">{project.name}</td>
                  <td className="p-4" data-label="Description">{project.description}</td>
                  <td className="p-4" data-label="Actions">
                    <div className="flex justify-between items-center">
                      <Link href={`/dashboard/projects/${project.id}`}>
                        <Button variant="link">
                          View Tasks
                        </Button>
                      </Link>
                      <Button variant="destructive" onClick={() => handleDeleteProject(project.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-card p-8 rounded-lg shadow-lg w-1/3">
            <h2 className="text-2xl font-bold mb-4">Add New Project</h2>
            <Input
              type="text"
              placeholder="Project Name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="mb-4"
            />
            <Textarea
              placeholder="Project Description"
              value={newProjectDescription}
              onChange={(e) => setNewProjectDescription(e.target.value)}
              className="mb-4"
            />
            <Input
              type="date"
              placeholder="Start Date"
              value={newProjectStartDate}
              onChange={(e) => setNewProjectStartDate(e.target.value)}
              className="mb-4"
            />
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddProject}>Add Project</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
