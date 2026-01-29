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
import { Loader, Trash2, ArrowRight, Plus, Trophy, User, Download, GripVertical, List, BarChart3, Pencil } from 'lucide-react';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { jwtDecode } from 'jwt-decode';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"


const ProjectsPage = () => {
  interface Project {
    id: number;
    name: string;
    description: string;
    startDate: string;
    totalPoints: number;
    yesterdayPoints: number;
    priority_order?: number | null;

    topPerformers: { name: string; initial: string; points: number }[];
    headId?: string;
    headName?: string;
  }

  interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
  }

  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectStartDate, setNewProjectStartDate] = useState('');
  const [newProjectEndDate, setNewProjectEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'priority'>('overview');
  const [sortBy, setSortBy] = useState<string>('priority_order');

  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newProjectHeadId, setNewProjectHeadId] = useState<string>('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get('/auth/organization'); // Adjust endpoint if needed
      setEmployees(response.data);
    } catch (error) {
      console.error("Failed to fetch employees", error);
    }
  }

  useEffect(() => {
    fetchProjects();
  }, [sortBy, sortOrder]);

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
      const params = new URLSearchParams();
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);

      const response = await axios.get(`/projects?${params.toString()}`);
      setProjects(response.data);
    } catch (error) {
      toast.error('Failed to fetch projects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProject = async () => {
    if (newProjectName.trim() !== '' && newProjectStartDate.trim() !== '') {
      const toastId = toast.loading(editingProject ? 'Updating project...' : 'Adding project...');
      try {
        const getHeadName = (id: string | null) => {
          if (!id) return 'Unassigned';
          const emp = employees.find(e => e.id === id);
          return emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned';
        };

        if (editingProject) {
          const response = await axios.put(`/projects/${editingProject.id}`, {
            name: newProjectName,
            description: newProjectDescription,
            startDate: newProjectStartDate,
            headId: newProjectHeadId === "unassigned" ? null : newProjectHeadId,
          });

          setProjects(projects.map(p => p.id === editingProject.id ? {
            ...p,
            ...response.data,
            headName: getHeadName(response.data.headId)
          } : p));

          toast.success('Project updated successfully', { id: toastId });
        } else {
          const response = await axios.post('/projects', {
            name: newProjectName,
            description: newProjectDescription,
            startDate: newProjectStartDate,
            headId: newProjectHeadId === "unassigned" ? null : newProjectHeadId,
          });

          const newProjectData: Project = {
            ...response.data,
            totalPoints: 0,
            yesterdayPoints: 0,
            topPerformers: [],
            headName: getHeadName(response.data.headId)
          };

          setProjects([...projects, newProjectData]);
          toast.success('Project added successfully', { id: toastId });
        }

        closeModal();
      } catch (error) {
        toast.error(editingProject ? 'Failed to update project' : 'Failed to add project', { id: toastId });
      }
    }
  };

  const openAddModal = () => {
    setEditingProject(null);
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectStartDate('');
    setNewProjectHeadId('unassigned');
    setIsModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setNewProjectName(project.name);
    setNewProjectDescription(project.description || '');
    setNewProjectStartDate(project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '');
    setNewProjectHeadId(project.headId || 'unassigned');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProject(null);
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectStartDate('');
    setNewProjectHeadId('');
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setProjects((items) => {
        const oldIndex = items.findIndex((item) => item.id.toString() === active.id);
        const newIndex = items.findIndex((item) => item.id.toString() === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSavePriority = async () => {
    const toastId = toast.loading('Saving priority order...');
    try {
      const projectPriorities = projects.map((project, index) => ({
        id: project.id,
        priority_order: index
      }));

      await axios.put('/projects/priority/update', { projectPriorities });
      toast.success('Priority order saved successfully', { id: toastId });
      fetchProjects(); // Refresh to get updated data
    } catch (error) {
      toast.error('Failed to save priority order', { id: toastId });
    }
  };

  interface SortableProjectItemProps {
    project: Project;
    index: number;
  }

  const SortableProjectItem: React.FC<SortableProjectItemProps> = ({ project, index }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: project.id.toString() });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group bg-card border border-border rounded-2xl p-3 md:p-6 flex items-center gap-3 md:gap-6 transition-all duration-300",
          isDragging && "shadow-2xl shadow-blue-500/20 scale-105 z-50"
        )}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-blue-400 transition-colors"
        >
          <GripVertical className="h-4 w-4 md:h-6 md:w-6" />
        </div>

        <div className="flex items-center justify-center w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-blue-500/10 border border-blue-500/20 font-bold text-blue-400 text-sm md:text-base">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-base md:text-lg truncate">{project.name}</h3>
          <p className="text-slate-400 text-xs md:text-sm truncate">{project.description}</p>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <div className="text-right">
            <p className="text-[10px] md:text-xs text-slate-500 uppercase tracking-wider mb-0.5 md:mb-1">Pts</p>
            <p className="font-mono text-sm md:text-lg font-bold text-foreground">{project.totalPoints || 0}</p>
          </div>

          <Link href={`/dashboard/projects/${project.id}`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:h-10 md:w-10 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
            >
              <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </Link>
        </div>
      </div>
    );
  };

  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Projects', href: '/dashboard/projects' },
  ];

  return (
    <div className="space-y-4">
      <Breadcrumbs items={breadcrumbItems} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Projects
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-sm">Manage and monitor organizational projects.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group">
            <Input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 bg-card border-border text-foreground rounded-xl py-4 pl-4 focus:border-ring transition-all duration-300"
            />
            <div className="absolute inset-0 rounded-xl bg-blue-500/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300"></div>
          </div>
          <Button
            onClick={handleExportProjects}
            className="bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl px-6 py-4 transition-all duration-300 gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          {userRole === 'ADMIN' && (
            <Button
              onClick={openAddModal}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-none rounded-xl px-6 py-4 shadow-lg shadow-blue-500/20 transition-all duration-300 gap-2 font-semibold"
            >
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-8 border-b border-border">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            "pb-2 border-b-2 font-bold text-sm transition-all duration-300 flex items-center gap-2 uppercase tracking-widest",
            activeTab === 'overview'
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <BarChart3 className="h-4 w-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('priority')}
          className={cn(
            "pb-2 border-b-2 font-bold text-sm transition-all duration-300 flex items-center gap-2 uppercase tracking-widest",
            activeTab === 'priority'
              ? "border-purple-500 text-purple-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <List className="h-4 w-4" />
          Priority
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full animate-pulse"></div>
          </div>
        </div>
      ) : activeTab === 'overview' ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th
                    className="px-2 py-2 md:px-4 md:py-3 font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-secondary/80 transition-colors select-none text-xs md:text-sm"
                    onClick={() => {
                      if (sortBy === 'name') {
                        setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                      } else {
                        setSortBy('name');
                        setSortOrder('DESC');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Project
                      {sortBy === 'name' && (
                        <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-2 py-2 md:px-4 md:py-3 font-semibold text-slate-400 uppercase tracking-wider text-xs md:text-sm">Desc</th>

                  <th className="px-2 py-2 md:px-4 md:py-3 font-semibold text-slate-400 uppercase tracking-wider text-xs md:text-sm">Head</th>
                  <th className="px-2 py-2 md:px-4 md:py-3 font-semibold text-slate-400 uppercase tracking-wider text-xs md:text-sm">Top</th>
                  <th
                    className="px-2 py-2 md:px-4 md:py-3 font-semibold text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:bg-secondary/80 transition-colors select-none text-xs md:text-sm"
                    onClick={() => {
                      if (sortBy === 'totalPoints') {
                        setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                      } else {
                        setSortBy('totalPoints');
                        setSortOrder('DESC');
                      }
                    }}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Pts
                      {sortBy === 'totalPoints' && (
                        <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-2 py-2 md:px-4 md:py-3 font-semibold text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:bg-secondary/80 transition-colors select-none text-xs md:text-sm"
                    onClick={() => {
                      if (sortBy === 'yesterdayPoints') {
                        setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                      } else {
                        setSortBy('yesterdayPoints');
                        setSortOrder('DESC');
                      }
                    }}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Y-Day
                      {sortBy === 'yesterdayPoints' && (
                        <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-2 py-2 md:px-4 md:py-3 font-semibold text-slate-400 uppercase tracking-wider text-right text-xs md:text-sm">Act</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="group hover:bg-secondary transition-all duration-300">
                    <td className="px-2 py-2 md:px-4 md:py-4 align-top">
                      <span className="font-bold text-foreground block text-xs md:text-sm">
                        {project.name}
                      </span>
                    </td>
                    <td className="px-2 py-2 md:px-4 md:py-4 align-top">
                      <p className="line-clamp-1 md:line-clamp-2 text-slate-400 text-xs md:text-sm" title={project.description}>
                        {project.description}
                      </p>
                    </td>
                    <td className="px-2 py-2 md:px-4 md:py-4 align-top">
                      <span className="font-medium text-foreground text-xs md:text-sm">
                        {project.headName === 'Unassigned' ? <span className="text-slate-500 italic">Unassigned</span> : project.headName}
                      </span>
                    </td>
                    <td className="px-2 py-2 md:px-4 md:py-4 align-top">
                      {project.topPerformers && project.topPerformers.length > 0 ? (
                        <div className="flex flex-col gap-0.5 md:gap-1">
                          <span className="font-medium text-foreground text-xs md:text-sm truncate max-w-[60px] md:max-w-none">{project.topPerformers[0].name} {project.topPerformers[0].initial}.</span>
                          <span className="text-[10px] md:text-xs text-blue-400 font-mono">{project.topPerformers[0].points} pts</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">None</span>
                      )}
                    </td>
                    <td className="px-2 py-2 md:px-4 md:py-4 text-center align-top">
                      <span className="font-mono text-xs md:text-sm font-bold text-foreground">{project.totalPoints || 0}</span>
                    </td>
                    <td className="px-2 py-2 md:px-4 md:py-4 text-center align-top">
                      <span className={cn(
                        "px-1 md:px-2 py-0.5 rounded text-[10px] md:text-xs font-bold border",
                        project.yesterdayPoints > 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border-white/5"
                      )}>
                        {project.yesterdayPoints > 0 ? `+${project.yesterdayPoints}` : project.yesterdayPoints || 0}
                      </span>
                    </td>
                    <td className="px-2 py-2 md:px-4 md:py-4 text-right align-top">
                      <div className="flex items-center justify-end gap-1 md:gap-2">
                        <Link href={`/dashboard/projects/${project.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 md:h-8 md:w-8 text-slate-400 hover:text-blue-400 transition-colors"
                          >
                            <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                        </Link>
                        {userRole === 'ADMIN' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 md:h-8 md:w-8 text-slate-400 hover:text-yellow-400 transition-colors"
                              onClick={() => openEditModal(project)}
                            >
                              <Pencil className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 md:h-8 md:w-8 text-slate-400 hover:text-red-400 transition-colors"
                              onClick={() => initiateDeleteProject(project.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Project Priority</h2>
              <p className="text-muted-foreground mt-1">Drag and drop to reorder projects by priority</p>
            </div>
            {userRole === 'ADMIN' && (
              <Button
                onClick={handleSavePriority}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-none rounded-xl px-6 py-4 shadow-lg shadow-purple-500/20 transition-all duration-300 gap-2 font-semibold"
              >
                <Plus className="h-4 w-4" />
                Save Priority
              </Button>
            )}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={projects.map(p => p.id.toString())}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {projects.map((project, index) => (
                  <SortableProjectItem key={project.id} project={project} index={index} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )
      }

      {
        isModalOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border p-8 rounded-[2rem] shadow-2xl w-full max-w-lg animate-in zoom-in duration-300">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-foreground tracking-tight">{editingProject ? 'Edit Project' : 'Add New Project'}</h2>
                <p className="text-muted-foreground mt-2">{editingProject ? 'Update the project details below.' : 'Fill in the details for the new project.'}</p>
              </div>
              <div className="space-y-4">
                <Input
                  placeholder="Project Name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="bg-input border-input text-foreground rounded-xl py-6 focus:border-ring block dark:[color-scheme:dark]"
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
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Project Head</label>
                  <SearchableSelect
                    value={newProjectHeadId}
                    onValueChange={setNewProjectHeadId}
                    options={[
                      { value: "unassigned", label: "Unassigned" },
                      ...employees.map((emp) => ({
                        value: emp.id,
                        label: `${emp.firstName} ${emp.lastName}`,
                      })),
                    ]}
                    placeholder="Select a head (optional)"
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-10">
                <Button
                  variant="ghost"
                  className="flex-1 rounded-xl py-6 text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border"
                  onClick={closeModal}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-none rounded-xl py-6 font-bold shadow-lg shadow-blue-500/20"
                  onClick={handleSaveProject}
                >
                  {editingProject ? 'Update Project' : 'Add Project'}
                </Button>
              </div>
            </div>
          </div>
        )
      }

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteProject}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone."
        confirmText="Delete Project"
        variant="destructive"
      />
    </div >
  );
};

export default ProjectsPage;





