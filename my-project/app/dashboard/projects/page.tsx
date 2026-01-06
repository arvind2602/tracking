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
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { jwtDecode } from 'jwt-decode';
import { cn } from '@/lib/utils';


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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);
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

  const initiateDeleteProject = (projectId: number) => {
    setProjectToDelete(projectId);
    setDeleteModalOpen(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

    const toastId = toast.loading('Deleting project...');
    try {
      await axios.delete(`/projects/${projectToDelete}`);
      setProjects(projects.filter(p => p.id !== projectToDelete));
      toast.success('Project deleted successfully', { id: toastId });
    } catch (error) {
      toast.error('Failed to delete project', { id: toastId });
    } finally {
      setProjectToDelete(null);
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
    <div className="space-y-8">
      <Breadcrumbs items={breadcrumbItems} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mt-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-200 to-purple-200">
            Projects
          </h1>
          <p className="text-slate-400 mt-2 font-medium">Manage and monitor organizational projects.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group">
            <Input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 bg-white/5 border-white/10 text-white rounded-xl py-6 pl-4 focus:border-blue-500/50 transition-all duration-300"
            />
            <div className="absolute inset-0 rounded-xl bg-blue-500/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300"></div>
          </div>
          <Button
            onClick={handleExportProjects}
            className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl px-6 py-6 transition-all duration-300 gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          {userRole === 'ADMIN' && (
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-none rounded-xl px-6 py-6 shadow-lg shadow-blue-500/20 transition-all duration-300 gap-2 font-semibold"
            >
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full animate-pulse"></div>
          </div>
        </div>
      ) : (
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase tracking-wider">Top Performer</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase tracking-wider text-center">Points</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase tracking-wider text-center">Yesterday</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="group hover:bg-white/5 transition-all duration-300">
                    <td className="px-4 py-4 align-top">
                      <span className="font-bold text-white block">
                        {project.name}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="line-clamp-2 text-slate-400 text-sm" title={project.description}>
                        {project.description}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {project.topPerformers && project.topPerformers.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-white text-sm">{project.topPerformers[0].name} {project.topPerformers[0].initial}.</span>
                          <span className="text-[10px] text-blue-400 font-mono">{project.topPerformers[0].points} pts</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">No performer yet</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center align-top">
                      <span className="font-mono text-sm font-bold text-white">{project.totalPoints || 0}</span>
                    </td>
                    <td className="px-4 py-4 text-center align-top">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold border",
                        project.yesterdayPoints > 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border-white/5"
                      )}>
                        {project.yesterdayPoints > 0 ? `+${project.yesterdayPoints}` : project.yesterdayPoints || 0}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right align-top">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/projects/${project.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-blue-400 transition-colors"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                        {userRole === 'ADMIN' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-400 transition-colors"
                            onClick={() => initiateDeleteProject(project.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-[2rem] shadow-2xl w-full max-w-lg animate-in zoom-in duration-300">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white tracking-tight">Add New Project</h2>
              <p className="text-slate-400 mt-2">Fill in the details for the new project.</p>
            </div>
            <div className="space-y-4">
              <Input
                placeholder="Project Name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="bg-white/5 border-white/10 text-white rounded-xl py-6 focus:border-blue-500/50"
              />
              <Textarea
                placeholder="Description"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                className="bg-white/5 border-white/10 text-white rounded-xl py-4 min-h-[120px] focus:border-blue-500/50"
              />
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Start Date</label>
                <Input
                  type="date"
                  value={newProjectStartDate}
                  onChange={(e) => setNewProjectStartDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-white rounded-xl py-6 focus:border-blue-500/50 block dark:[color-scheme:dark]"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <Button
                variant="ghost"
                className="flex-1 rounded-xl py-6 text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-none rounded-xl py-6 font-bold shadow-lg shadow-blue-500/20"
                onClick={handleAddProject}
              >
                Add Project
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteProject}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone."
        confirmText="Delete Project"
        variant="destructive"
      />
    </div>
  );
};

export default ProjectsPage;





