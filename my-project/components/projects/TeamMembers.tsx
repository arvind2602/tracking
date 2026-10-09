'use client';

import React, { useState, useRef, useEffect } from 'react';
import axios from '@/lib/axios';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandGroup, CommandItem, CommandList, CommandInput, CommandEmpty } from '@/components/ui/command';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Trash2, Loader, Check, Users } from 'lucide-react';

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  image: string | null;
  isHead: boolean;
  joinedAt: string;
}

interface TeamMembersProps {
  projectId: string;
  members: TeamMember[];
  employees: { id: string; firstName: string; lastName: string }[];
  canManage: boolean;
  onChanged: () => void;
}

const fullName = (m: { firstName: string; lastName: string }) => `${m.firstName} ${m.lastName}`;

const initials = (m: { firstName: string; lastName: string }) =>
  `${m.firstName.charAt(0)}${m.lastName.charAt(0)}`.toUpperCase();

export default function TeamMembers({ projectId, members, employees, canManage, onChanged }: TeamMembersProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const memberIds = new Set(members.map(m => m.id));

  // Close the picker on outside click (same pattern as HeadSelect)
  useEffect(() => {
    if (!isAddOpen) return;
    const handler = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) setIsAddOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isAddOpen]);

  const addMember = async (employeeId: string) => {
    if (isAdding) return;
    setIsAdding(employeeId);
    try {
      await axios.post(`/projects/${projectId}/members`, { employeeId });
      toast.success('Team member added');
      setIsAddOpen(false);
      onChanged();
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.response?.data?.error || 'Failed to add member');
    } finally {
      setIsAdding(null);
    }
  };

  const removeMember = async (member: TeamMember) => {
    if (isRemoving) return;
    setIsRemoving(member.id);
    try {
      await axios.delete(`/projects/${projectId}/members/${member.id}`);
      toast.success('Team member removed');
      onChanged();
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.response?.data?.error || 'Failed to remove member');
    } finally {
      setIsRemoving(null);
    }
  };

  return (
    <div>
      <div className="p-5 border-b bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-bold">Team</h3>
          <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-mono">
            {members.length}
          </Badge>
        </div>
        {canManage && (
          <div className="relative" ref={anchorRef}>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 font-bold border-dashed"
              onClick={() => setIsAddOpen(!isAddOpen)}
            >
              <Plus className="h-4 w-4" /> Add Member
            </Button>
            {isAddOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border bg-popover text-popover-foreground shadow-md">
                <Command>
                  <CommandInput placeholder="Search employees..." />
                  <CommandList>
                    <CommandEmpty>No employees found.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-auto">
                      {employees.map(emp => {
                        const isMember = memberIds.has(emp.id);
                        return (
                          <CommandItem
                            key={emp.id}
                            disabled={isMember}
                            onSelect={() => { if (!isMember) addMember(emp.id); }}
                            className="cursor-pointer flex items-center justify-between disabled:opacity-60"
                          >
                            <span>{emp.firstName} {emp.lastName}</span>
                            {isMember
                              ? <Check className="h-4 w-4 text-emerald-500" />
                              : isAdding === emp.id ? <Loader className="h-4 w-4 animate-spin" /> : null}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-5">
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No team members yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {members.map(m => (
              <li key={m.id} className="py-3 flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  {m.image ? <AvatarImage src={m.image} alt={fullName(m)} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials(m)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate flex items-center gap-2">
                    <span>{fullName(m)}</span>
                    {m.isHead && (
                      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">Head</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{m.position}</p>
                </div>
                {canManage && !m.isHead && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-500"
                    disabled={!!isRemoving}
                    onClick={() => removeMember(m)}
                    title="Remove from team"
                  >
                    {isRemoving === m.id ? <Loader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && members.some(m => m.isHead) && (
          <p className="text-[11px] text-muted-foreground mt-3">
            Project heads are inherent team members and are managed in project settings.
          </p>
        )}
      </div>
    </div>
  );
}
