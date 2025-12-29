'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import Breadcrumbs from '@/components/ui/breadcrumbs';
import axios from '@/lib/axios';
import toast from 'react-hot-toast';
import { Loader, Trash2, ArrowRight, Plus, Trophy, User, Download } from 'lucide-react';
import { jwtDecode } from 'jwt-decode';

const ProjectsPage = () => {
  interface Project {
    id: number;
    name: string;
    description: string;
    startDate: string;
    totalPoints: number;
    yesterdayPoints: number;
    topPerformers: { name: string; initial: string; points: number }[];
  }

  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectStartDate, setNewProjectStartDate] = useState('');
  const [newProjectEndDate, setNewProjectEndDate] = useState('');
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
          // endDate: newProjectEndDate,
        });
        setProjects([...projects, response.data]);
        setNewProjectName('');
        setNewProjectDescription('');
        setNewProjectStartDate('');
        setNewProjectEndDate('');
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

  const handleExportProjects = async () => {
    const toastId = toast.loading('Exporting projects...');
    try {
      const response = await axios.get('/projects/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'projects.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Projects exported', { id: toastId });
    } catch {
      toast.error('Export failed', { id: toastId });
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
        <div className="flex space-x-4">
          <Input
            type="text"
            placeholder="Search by name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64"
          />
          <Button
            onClick={handleExportProjects}
            variant="outline"
            className="gap-2 rounded-full"
          >
            <Download className="h-4 w-4" />
            Export Projects
          </Button>
          {userRole === 'ADMIN' && (
            <Button onClick={() => setIsModalOpen(true)} className="gap-2 rounded-full">
              <Plus className="h-4 w-4" />
              Add New Project
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="animate-spin h-12 w-12 text-accent" />
        </div>
      ) : (
        <div className="bg-card/50 backdrop-blur-lg rounded-xl border border-accent/20 shadow-lg overflow-x-auto">
          <div className="overflow-auto border border-border rounded-lg bg-background">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-muted/40 sticky top-0 z-10">
                <tr>
                  <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[200px]">Name</th>
                  <th className="border border-border px-3 py-2 font-medium text-muted-foreground">Description</th>
                  <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[200px]">Top Performers</th>
                  <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[120px]">Total Points</th>
                  <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[120px]">Yesterday</th>
                  <th className="border border-border px-3 py-2 font-medium text-muted-foreground w-[180px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="group hover:bg-accent/5 transition-colors">
                    <td className="border border-border px-3 py-1.5 align-middle font-medium text-foreground">
                      {project.name}
                    </td>
                    <td className="border border-border px-3 py-1.5 align-middle">
                      <div className="line-clamp-2 text-muted-foreground text-sm" title={project.description}>
                        {project.description}
                      </div>
                    </td>
                    <td className="border border-border px-3 py-1.5 align-middle">
                      <div className="flex flex-col gap-1 min-h-[50px] justify-center">
                        {project.topPerformers && project.topPerformers.length > 0 ? (
                          project.topPerformers.map((p, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i === 0 ? 'text-sm font-medium' : 'text-xs'}`}>
                              {i === 0 && <Trophy className="h-3 w-3 text-yellow-500" />}
                              {i === 1 && <Trophy className="h-3 w-3 text-gray-400" />}
                              {i === 2 && <Trophy className="h-3 w-3 text-amber-600" />}
                              <div className="flex flex-1 justify-between items-center gap-2">
                                <span className="font-medium truncate max-w-[100px]" title={p.name}>{p.name} {p.initial}.</span>
                                <span className="text-muted-foreground font-mono">{p.points}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No data</span>
                        )}
                      </div>
                    </td>
                    <td className="border border-border px-3 py-1.5 align-middle">
                      <Badge variant="secondary" className="font-mono text-sm">
                        {project.totalPoints || 0} pts
                      </Badge>
                    </td>
                    <td className="border border-border px-3 py-1.5 align-middle">
                      <span className={`font-mono text-sm font-medium ${project.yesterdayPoints > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                        {project.yesterdayPoints > 0 ? '+' : ''}{project.yesterdayPoints || 0} pts
                      </span>
                    </td>
                    <td className="border border-border px-3 py-1.5 align-middle">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/projects/${project.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="View Tasks"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={() => handleDeleteProject(project.id)}
                          title="Delete Project"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
