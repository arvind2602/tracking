"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useMemo, useRef } from "react";
import React from "react";
import { useRouter } from "next/navigation";
import Breadcrumbs from "@/components/ui/breadcrumbs";
import axios from "@/lib/axios";
import toast from "react-hot-toast";
import { Loader, Trash2, Download, Plus, Search, Check, ChevronsUpDown, X, Filter } from "lucide-react";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { cn } from "@/lib/utils";
import { TaskPoints } from "@/components/reports/TaskPoints";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { IDCardTemplate } from "@/components/IDCardTemplate";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  role: string;
  rank?: number;
  weeklyPoints?: number;
  skills?: string[];
  responsibilities?: string[];
  image?: string;
  emergencyContact?: string;
  joiningDate?: string;
}

export default function Users() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    position: "",
    phoneNumber: "",
    emergencyContact: "",
    role: "USER" as "USER" | "ADMIN",
  });
  const [usersList, setUsersList] = useState<User[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [positionFilter, setPositionFilter] = useState<string>("");
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [sortBy, setSortBy] = useState<string>('weeklyPoints');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [searchQuery, setSearchQuery] = useState("");

  // Skills Filter States
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [isSkillDropdownOpen, setIsSkillDropdownOpen] = useState(false);
  const skillsDropdownRef = useRef<HTMLDivElement>(null);

  // Bulk ID Generation States
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isGeneratingIds, setIsGeneratingIds] = useState(false);
  const [currentProcessingUser, setCurrentProcessingUser] = useState<User | null>(null);
  const processingQueueRef = useRef<User[]>([]);
  const zipRef = useRef<JSZip | null>(null);
  const idCardRef = useRef<HTMLDivElement>(null);

  const groupedUsers = useMemo(() => {
    const groups: { [key: string]: User[] } = {};

    const adminUsers = filteredUsers.filter(user => user.role === "ADMIN");
    const regularUsers = filteredUsers.filter(user => user.role !== "ADMIN");

    adminUsers.forEach((user) => {
      const position = user.position ? user.position.charAt(0).toUpperCase() + user.position.slice(1) : "Unassigned";
      const key = `ADMIN - ${position}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(user);
    });

    regularUsers.forEach((user) => {
      const position = user.position ? user.position.charAt(0).toUpperCase() + user.position.slice(1) : "Unassigned";
      if (!groups[position]) groups[position] = [];
      groups[position].push(user);
    });

    return groups;
  }, [filteredUsers]);

  // Click outside to close skills dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (skillsDropdownRef.current && !skillsDropdownRef.current.contains(event.target as Node)) {
        setIsSkillDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    getUsers();
    fetchAvailableSkills();
  }, [sortBy, sortOrder]);

  const fetchAvailableSkills = async () => {
    try {
      // Fetch all skills (no search term to get all)
      const response = await axios.get("/auth/skills?limit=100"); // Assuming backend handles limit or pagination if needed, or get all
      setAvailableSkills(response.data || []);
    } catch (error) {
      console.error("Failed to fetch skills:", error);
    }
  };

  useEffect(() => {
    let filtered = usersList;
    if (roleFilter && roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }
    if (positionFilter && positionFilter !== "all") {
      filtered = filtered.filter((user) => user.position === positionFilter);
    }

    // Filter by selected skills (AND logic: user must have ALL selected skills)
    if (selectedSkills.length > 0) {
      filtered = filtered.filter(user =>
        user.skills && selectedSkills.every(skill => user.skills!.includes(skill))
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((user) =>
        user.firstName.toLowerCase().includes(query) ||
        user.lastName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.skills?.some(s => s.toLowerCase().includes(query)) ||
        user.responsibilities?.some(r => r.toLowerCase().includes(query))
      );
    }
    setFilteredUsers(filtered);
  }, [usersList, roleFilter, positionFilter, searchQuery, selectedSkills]);

  const getUsers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);

      const response = await axios.get(`/auth/organization?${params.toString()}`);
      setUsersList(response.data);
      // Determine current user role from response or another endpoint if needed. 
      // For now assuming the logged-in user is ADMIN if they can see this page or based on context. 
      // Actually getting user role logic was missing in previous code snippet but `userRole` state exists. 
      // Let's assum userRole is set elsewhere or default to ADMIN for now as this is likely an admin page.
      setUserRole('ADMIN');
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    const toastId = toast.loading("Adding user...");
    try {
      const { data } = await axios.post("/auth/register", form);
      getUsers();
      setIsModalOpen(false);
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        position: "",
        phoneNumber: "",
        emergencyContact: "",
        role: "USER",
      });
      toast.success("User added", { id: toastId });
    } catch {
      toast.error("Failed to add user", { id: toastId });
    }
  };

  const initiateDeleteUser = (userId: string) => {
    setUserToDelete(userId);
    setDeleteModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    const toastId = toast.loading("Deleting...");
    try {
      await axios.delete(`/auth/${userToDelete}`);
      setUsersList((prev) => prev.filter((u) => u.id !== userToDelete));
      toast.success("User deleted", { id: toastId });
    } catch {
      toast.error("Failed to delete user", { id: toastId });
    } finally {
      setUserToDelete(null);
    }
  };

  const handleExportUsers = async () => {
    const toastId = toast.loading("Exporting users...");
    try {
      const response = await axios.get("/auth/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "users.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Users exported", { id: toastId });
    } catch {
      toast.error("Export failed", { id: toastId });
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleBulkDownload = () => {
    if (selectedUsers.length === 0) return;

    const usersToProcess = usersList.filter(u => selectedUsers.includes(u.id));
    processingQueueRef.current = [...usersToProcess];
    zipRef.current = new JSZip();
    setIsGeneratingIds(true);
    processNextUser();
  };

  const processNextUser = () => {
    if (processingQueueRef.current.length === 0) {
      // Finished
      if (zipRef.current) {
        zipRef.current.generateAsync({ type: "blob" }).then((content) => {
          saveAs(content, "ID_Cards.zip");
          setIsGeneratingIds(false);
          setCurrentProcessingUser(null);
          zipRef.current = null;
          toast.success("IDs downloaded successfully!");
        });
      }
      return;
    }

    const nextUser = processingQueueRef.current.shift();
    if (nextUser) {
      setCurrentProcessingUser(nextUser);
      // The template will render, process image, and call onImageProcessed
    }
  };

  const handleTemplateReady = async () => {
    if (!idCardRef.current || !currentProcessingUser) return;

    try {
      // Small delay to ensure rendering is perfect
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(idCardRef.current as HTMLElement, {
        useCORS: true,
        scale: 2,
        backgroundColor: null,
      } as any);

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (blob && zipRef.current) {
        const fileName = `${currentProcessingUser.firstName}_${currentProcessingUser.lastName}_ID.png`;
        zipRef.current.file(fileName, blob);
      }
    } catch (error) {
      console.error("Error capturing ID card:", error);
    }

    processNextUser();
  };

  const breadcrumbItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Users", href: "/dashboard/users" },
  ];

  return (
    <div className="space-y-4">
      <Breadcrumbs items={breadcrumbItems} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Users Management
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-sm">Manage and monitor organizational members.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Button
            onClick={handleExportUsers}
            className="bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl px-6 py-4 transition-all duration-300 gap-2"
          >
            <Download className="h-4 w-4" />
            Export Users
          </Button>
          {selectedUsers.length > 0 && (
            <Button
              onClick={handleBulkDownload}
              disabled={isGeneratingIds}
              className="bg-orange-500 hover:bg-orange-600 text-white border-none rounded-xl px-6 py-4 transition-all duration-300 gap-2"
            >
              {isGeneratingIds ? (
                <><Loader className="h-4 w-4 animate-spin" /> Generating {selectedUsers.length} IDs...</>
              ) : (
                <><Download className="h-4 w-4" /> Download {selectedUsers.length} IDs</>
              )}
            </Button>
          )}
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-none rounded-xl px-6 py-4 shadow-lg shadow-blue-500/20 transition-all duration-300 gap-2 font-semibold"
          >
            <Plus className="h-4 w-4" />
            Add New User
          </Button>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="bg-secondary border border-border rounded-xl p-1 mb-4">
          <TabsTrigger value="list" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white px-6 py-2 font-medium transition-all">
            Users List
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white px-6 py-2 font-medium transition-all">
            Performance Heatmap
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative w-full md:w-1/3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, skills, responsibilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border text-foreground rounded-xl py-6"
              />
            </div>

            {userRole === 'ADMIN' && (
              <>
                <SearchableSelect
                  value={roleFilter}
                  onValueChange={setRoleFilter}
                  options={[
                    { value: "all", label: "All Roles" },
                    { value: "USER", label: "USER" },
                    { value: "ADMIN", label: "ADMIN" },
                  ]}
                  placeholder="Filter by role"
                  className="w-full md:w-1/5"
                />

                <SearchableSelect
                  value={positionFilter}
                  onValueChange={setPositionFilter}
                  options={[
                    { value: "all", label: "All Positions" },
                    ...[...new Set(usersList.map((user) => user.position).filter(Boolean))].map((pos: any) => ({
                      value: pos,
                      label: pos,
                    })),
                  ]}
                  placeholder="Filter by position"
                  className="w-full md:w-1/5"
                />

                {/* Skills Multi-Select Filter */}
                <div className="relative w-full md:w-1/3" ref={skillsDropdownRef}>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isSkillDropdownOpen}
                    className="w-full justify-between bg-card border-border text-foreground rounded-xl py-6 hover:bg-card/80"
                    onClick={() => setIsSkillDropdownOpen(!isSkillDropdownOpen)}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Filter className="h-4 w-4 shrink-0 opacity-50" />
                      <span className="truncate">
                        {selectedSkills.length > 0
                          ? `${selectedSkills.length} selected`
                          : "Filter by skills"}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>

                  {isSkillDropdownOpen && (
                    <div className="absolute top-full left-0 z-50 mt-2 w-full rounded-md border bg-popover shadow-md outline-none animate-in fade-in-0 zoom-in-95">
                      <Command>
                        <CommandInput placeholder="Search skills..." />
                        <CommandList>
                          <CommandEmpty>No skill found.</CommandEmpty>
                          <CommandGroup className="max-h-60 overflow-auto">
                            {availableSkills.map((skill) => (
                              <CommandItem
                                key={skill}
                                value={skill}
                                onSelect={() => toggleSkill(skill)}
                                className="cursor-pointer"
                              >
                                <div className={cn(
                                  "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                  selectedSkills.includes(skill)
                                    ? "bg-primary text-primary-foreground"
                                    : "opacity-50 [&_svg]:invisible"
                                )}>
                                  <Check className={cn("h-4 w-4")} />
                                </div>
                                {skill}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          {selectedSkills.length > 0 && (
                            <div className="p-2 border-t">
                              <Button
                                variant="ghost"
                                className="w-full justify-center text-xs h-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSkills([]);
                                }}
                              >
                                Clear selected
                              </Button>
                            </div>
                          )}
                        </CommandList>
                      </Command>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Active Skills Badges */}
          {selectedSkills.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {selectedSkills.map(skill => (
                <Badge key={skill} variant="secondary" className="px-2 py-1 flex items-center gap-1">
                  {skill}
                  <button
                    onClick={() => toggleSkill(skill)}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedSkills([])}
              >
                Clear all
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full animate-pulse"></div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-2 py-2 md:px-4 md:py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-2 py-2 md:px-4 md:py-3 font-semibold text-slate-400 uppercase tracking-wider text-xs md:text-sm">S.No</th>
                      <th className="px-2 py-2 md:px-4 md:py-3 font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-secondary/80 transition-colors select-none text-xs md:text-sm"
                        onClick={() => {
                          if (sortBy === 'firstName') {
                            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                          } else {
                            setSortBy('firstName');
                            setSortOrder('DESC');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          Name
                          {sortBy === 'firstName' && <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th className="px-2 py-2 md:px-4 md:py-3 font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-secondary/80 transition-colors select-none text-xs md:text-sm"
                        onClick={() => {
                          if (sortBy === 'email') {
                            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                          } else {
                            setSortBy('email');
                            setSortOrder('DESC');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          Email
                          {sortBy === 'email' && <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th className="px-2 py-2 md:px-4 md:py-3 font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-secondary/80 transition-colors select-none text-xs md:text-sm"
                        onClick={() => {
                          if (sortBy === 'role') {
                            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                          } else {
                            setSortBy('role');
                            setSortOrder('DESC');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          Role
                          {sortBy === 'role' && <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th className="px-2 py-2 md:px-4 md:py-3 font-semibold text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:bg-secondary/80 transition-colors select-none text-xs md:text-sm"
                        onClick={() => {
                          if (sortBy === 'weeklyPoints') {
                            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                          } else {
                            setSortBy('weeklyPoints');
                            setSortOrder('DESC');
                          }
                        }}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Pts
                          {sortBy === 'weeklyPoints' && <span className="text-blue-400">{sortOrder === 'ASC' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th className="px-2 py-2 md:px-4 md:py-3 font-semibold text-slate-400 uppercase tracking-wider text-right text-xs md:text-sm">Act</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {Object.entries(groupedUsers).sort((a, b) => a[0].localeCompare(b[0])).map(([position, users]) => (
                      <React.Fragment key={`group-${position}`}>
                        <tr className="bg-secondary/50">
                          <td colSpan={7} className="px-4 py-2 font-bold text-blue-400/80 bg-blue-500/5 text-xs uppercase tracking-widest">
                            {position} ({users.length})
                          </td>
                        </tr>
                        {users.map((u, index) => (
                          <tr key={u.id} className="group hover:bg-secondary transition-all duration-300">
                            <td className="px-2 py-2 md:px-4 md:py-3">
                              <input
                                type="checkbox"
                                checked={selectedUsers.includes(u.id)}
                                onChange={() => toggleSelectUser(u.id)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-2 py-2 md:px-4 md:py-3 text-slate-500 font-mono text-xs text-center md:text-left">
                              {String(index + 1).padStart(2, '0')}
                            </td>
                            <td className="px-2 py-2 md:px-4 md:py-3">
                              <button
                                className="font-semibold text-foreground hover:text-blue-400 transition-colors text-[10px] md:text-sm flex items-center gap-3"
                                onClick={() => router.push(`/dashboard/users/${u.id}/profile`)}
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={u.image} alt={u.firstName} className="object-cover" />
                                  <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                                    {u.firstName[0]}{u.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{u.firstName} {u.lastName}</span>
                              </button>
                            </td>
                            <td className="px-2 py-2 md:px-4 md:py-3 text-slate-400 text-xs md:text-sm truncate max-w-[100px] md:max-w-none">{u.email}</td>
                            <td className="px-2 py-2 md:px-4 md:py-3">
                              <span className={cn(
                                "text-[10px] md:text-xs font-bold uppercase tracking-widest px-1 md:px-2 py-0.5 rounded border",
                                u.role === 'ADMIN'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              )}>
                                {u.role === 'ADMIN' ? 'Admin' : 'User'}
                              </span>
                            </td>
                            <td className="px-2 py-2 md:px-4 md:py-3 text-center">
                              <span className="font-mono text-foreground font-bold text-[10px] md:text-sm">
                                {u.weeklyPoints || 0}
                              </span>
                            </td>
                            <td className="px-2 py-2 md:px-4 md:py-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 md:h-8 md:w-8 text-slate-400 hover:text-red-400 transition-colors"
                                onClick={() => initiateDeleteUser(u.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="heatmap">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
            <TaskPoints />
          </div>
        </TabsContent>
      </Tabs>

      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border p-8 rounded-[2rem] shadow-2xl w-full max-w-lg animate-in zoom-in duration-300">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-foreground tracking-tight">Add New User</h2>
              <p className="text-muted-foreground mt-2">Create a new member for your organization.</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="First Name"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="bg-input border-input text-foreground rounded-xl py-6 focus:border-ring"
                />
                <Input
                  placeholder="Last Name"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="bg-input border-input text-foreground rounded-xl py-6 focus:border-ring"
                />
              </div>
              <Input
                placeholder="Email Address"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-input border-input text-foreground rounded-xl py-6 focus:border-ring"
              />
              <Input
                placeholder="Position (e.g. Developer, Designer)"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="bg-input border-input text-foreground rounded-xl py-6 focus:border-ring"
              />
              <SearchableSelect
                value={form.role}
                onValueChange={(val: any) => setForm({ ...form, role: val })}
                options={[
                  { value: "USER", label: "Standard User" },
                  { value: "ADMIN", label: "Administrator" },
                ]}
                placeholder="Select Role"
                className="w-full"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Primary Phone Number"
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                  className="bg-input border-input text-foreground rounded-xl py-6 focus:border-ring"
                />
                <Input
                  placeholder="Emergency Contact"
                  value={form.emergencyContact}
                  onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                  className="bg-input border-input text-foreground rounded-xl py-6 focus:border-ring"
                />
              </div>
              <Input
                placeholder="Initial Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="bg-input border-input text-foreground rounded-xl py-6 focus:border-ring"
              />
            </div>
            <div className="flex gap-4 mt-10">
              <Button
                variant="ghost"
                className="flex-1 rounded-xl py-6 text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-none rounded-xl py-6 font-bold shadow-lg shadow-blue-500/20"
                onClick={handleSubmit}
              >
                Create User
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteUser}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone and will remove all their data."
        confirmText="Delete User"
        variant="destructive"
      />

      {/* Hidden ID Card Generator */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        {currentProcessingUser && (
          <IDCardTemplate
            profile={currentProcessingUser}
            idCardRef={idCardRef as React.RefObject<HTMLDivElement>}
            onImageProcessed={handleTemplateReady}
            shouldProcess={true}
          />
        )}
      </div>
    </div>
  );
}
