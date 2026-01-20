"use client";

import { useEffect, useState } from "react";
import axios from "@/lib/axios";
import { User, Mail, Briefcase, Award, Calendar, BadgeCheck, Shield, Plus, X, Save, Edit2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";

interface UserProfile {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    position: string;
    role: string;
    organiationId: string;
    organizationName?: string;
    createdAt?: string;
    skills: string[];
    responsibilities: string[];
}

export default function ProfilePage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    // Edit states
    const [editedSkills, setEditedSkills] = useState<string[]>([]);
    const [editedResponsibilities, setEditedResponsibilities] = useState<string[]>([]);
    const [newSkill, setNewSkill] = useState("");
    const [newResponsibility, setNewResponsibility] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await axios.get("/auth/profile");
            const data = response.data;
            // Ensure arrays exist
            data.skills = data.skills || [];
            data.responsibilities = data.responsibilities || [];

            setProfile(data);
            setEditedSkills(data.skills);
            setEditedResponsibilities(data.responsibilities);
        } catch (error) {
            console.error("Failed to fetch profile:", error);
            toast.error("Failed to load profile");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!profile) return;
        setIsSaving(true);
        try {
            await axios.put(`/auth/${profile.id}`, {
                firstName: profile.firstName,
                lastName: profile.lastName,
                position: profile.position,
                role: profile.role,
                skills: editedSkills,
                responsibilities: editedResponsibilities
            });

            setProfile({
                ...profile,
                skills: editedSkills,
                responsibilities: editedResponsibilities
            });
            setIsEditing(false);
            toast.success("Profile updated successfully");
        } catch (error) {
            console.error("Failed to update profile:", error);
            toast.error("Failed to update profile");
        } finally {
            setIsSaving(false);
        }
    };

    const addSkill = () => {
        if (newSkill.trim()) {
            setEditedSkills([...editedSkills, newSkill.trim()]);
            setNewSkill("");
        }
    };

    const removeSkill = (index: number) => {
        setEditedSkills(editedSkills.filter((_, i) => i !== index));
    };

    const addResponsibility = () => {
        if (newResponsibility.trim()) {
            setEditedResponsibilities([...editedResponsibilities, newResponsibility.trim()]);
            setNewResponsibility("");
        }
    };

    const removeResponsibility = (index: number) => {
        setEditedResponsibilities(editedResponsibilities.filter((_, i) => i !== index));
    };

    if (loading) {
        return (
            <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-8">
                <div className="flex justify-between">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-10 w-24" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <Skeleton className="h-[400px] w-full md:col-span-1 rounded-2xl" />
                    <div className="md:col-span-2 space-y-6">
                        <Skeleton className="h-[200px] w-full rounded-2xl" />
                        <Skeleton className="h-[300px] w-full rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (!profile) return <div className="p-8 text-center text-red-500">Failed to load profile.</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                        My Profile
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage your personal information and professional details.</p>
                </div>

                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
                                {isSaving ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                            </Button>
                        </>
                    ) : (
                        <Button onClick={() => setIsEditing(true)} variant="outline" className="border-blue-500/20 hover:bg-blue-500/10 hover:text-blue-500">
                            <Edit2 className="w-4 h-4 mr-2" /> Edit Profile
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Left Column: Identity Card */}
                <div className="md:col-span-4 lg:col-span-4">
                    <Card className="h-auto border-none shadow-xl bg-gradient-to-b from-sidebar/50 to-sidebar/20 backdrop-blur-xl overflow-hidden relative group transition-all duration-300 hover:shadow-2xl hover:bg-sidebar/40 sticky top-4">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                        <CardContent className="pt-10 pb-8 px-6 flex flex-col items-center text-center relative z-10">
                            <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 p-[2px] shadow-lg mb-6">
                                <div className="w-full h-full rounded-full bg-sidebar flex items-center justify-center overflow-hidden">
                                    <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-purple-600">
                                        {profile.firstName[0]}{profile.lastName[0]}
                                    </span>
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold mb-1">{profile.firstName} {profile.lastName}</h2>
                            <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                <Briefcase className="w-4 h-4" />
                                <span className="text-sm">{profile.position}</span>
                            </div>

                            <Badge variant="secondary" className="mb-6 px-3 py-1">
                                {profile.role}
                            </Badge>

                            <div className="w-full h-[1px] bg-border/50 mb-6"></div>

                            <div className="w-full space-y-4 text-left">
                                <div className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-sidebar/50 transition-colors">
                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                        <Mail className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs text-muted-foreground">Email</p>
                                        <p className="font-medium truncate" title={profile.email}>{profile.email}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-sidebar/50 transition-colors">
                                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Joined</p>
                                        <p className="font-medium">
                                            {profile.createdAt
                                                ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                                                : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-sidebar/50 transition-colors">
                                    <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                                        <Shield className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs text-muted-foreground">Organization</p>
                                        <p className="font-medium truncate">{profile.organizationName || "Unknown"}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Editable Sections */}
                <div className="md:col-span-8 lg:col-span-8 space-y-6">
                    {/* Welcome Banner */}
                    <Card className="border-none shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white overflow-hidden relative">
                        <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <CardContent className="p-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="text-center md:text-left">
                                <h3 className="text-2xl font-bold mb-2">Welcome back, {profile.firstName}!</h3>
                                <p className="text-blue-100 max-w-lg">
                                    Keep your profile updated to showcase your growth and contribute effectively to the team.
                                </p>
                            </div>
                            <div className="shrink-0 bg-white/20 hover:bg-white/30 transition-colors p-4 rounded-full backdrop-blur-md cursor-pointer">
                                <Award className="w-10 h-10 text-white" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Skills Section */}
                    <Card className="border-none shadow-lg bg-sidebar/30 backdrop-blur-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <BadgeCheck className="w-5 h-5 text-blue-500" />
                                Skills & Expertise
                            </CardTitle>
                            <CardDescription>
                                Technologies and competencies you specialize in.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {(isEditing ? editedSkills : profile.skills).map((skill, index) => (
                                    <Badge key={index} variant="secondary" className="px-3 py-1.5 text-sm bg-background/50 hover:bg-background border border-border/50 flex items-center gap-2 transition-all">
                                        {skill}
                                        {isEditing && (
                                            <button onClick={() => removeSkill(index)} className="text-muted-foreground hover:text-destructive transition-colors">
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </Badge>
                                ))}
                                {(isEditing ? editedSkills : profile.skills).length === 0 && (
                                    <p className="text-sm text-muted-foreground italic">No skills added yet.</p>
                                )}
                            </div>

                            {isEditing && (
                                <div className="flex gap-2 max-w-md mt-4">
                                    <Input
                                        placeholder="Add a new skill..."
                                        value={newSkill}
                                        onChange={(e) => setNewSkill(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                                        className="bg-background/50"
                                    />
                                    <Button onClick={addSkill} size="sm" variant="secondary">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Responsibilities Section */}
                    <Card className="border-none shadow-lg bg-sidebar/30 backdrop-blur-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Briefcase className="w-5 h-5 text-purple-500" />
                                Roles & Responsibilities
                            </CardTitle>
                            <CardDescription>
                                Key duties and expected contributions for your role.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-3">
                                {(isEditing ? editedResponsibilities : profile.responsibilities).map((item, index) => (
                                    <li key={index} className="flex items-start gap-3 p-3 rounded-lg bg-background/40 border border-border/30">
                                        <div className="mt-1 p-1 rounded-full bg-purple-500/10 text-purple-500 shrink-0">
                                            <Check className="w-3 h-3" />
                                        </div>
                                        <span className="text-sm text-foreground/90 flex-1">{item}</span>
                                        {isEditing && (
                                            <button onClick={() => removeResponsibility(index)} className="text-muted-foreground hover:text-destructive transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </li>
                                ))}
                                {(isEditing ? editedResponsibilities : profile.responsibilities).length === 0 && (
                                    <p className="text-sm text-muted-foreground italic">No responsibilities listed.</p>
                                )}
                            </ul>

                            {isEditing && (
                                <div className="flex gap-2 mt-6">
                                    <Input
                                        placeholder="Add a new responsibility..."
                                        value={newResponsibility}
                                        onChange={(e) => setNewResponsibility(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addResponsibility()}
                                        className="bg-background/50"
                                    />
                                    <Button onClick={addResponsibility} size="sm" variant="secondary">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
