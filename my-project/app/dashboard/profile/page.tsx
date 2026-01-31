"use client";

import { useEffect, useState } from "react";
import axios from "@/lib/axios";
import { User, Mail, Briefcase, Award, Calendar, BadgeCheck, Shield, Plus, X, Save, Edit2, Check, Camera, Trash2, Phone, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import { TaskPoints } from "@/components/reports/TaskPoints";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { KeyRound, Lock } from "lucide-react";
import { getProxiedImageUrl } from "@/lib/imageProxy";

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
    dob?: string;
    bloodGroup?: string;
    image?: string;
    phoneNumber?: string;
    emergencyContact?: string;
    address?: string;
    joiningDate?: string;
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

    // New fields state
    const [dob, setDob] = useState("");
    const [bloodGroup, setBloodGroup] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [emergencyContact, setEmergencyContact] = useState("");
    const [address, setAddress] = useState("");
    const [joiningDate, setJoiningDate] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [position, setPosition] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [removeImage, setRemoveImage] = useState(false);

    // Password change states
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Autocomplete states
    const [availableSkills, setAvailableSkills] = useState<string[]>([]);
    const [openSkillSearch, setOpenSkillSearch] = useState(false);

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
            setDob(data.dob ? new Date(data.dob).toISOString().split('T')[0] : "");
            setJoiningDate(data.joiningDate ? new Date(data.joiningDate).toISOString().split('T')[0] : (data.createdAt ? new Date(data.createdAt).toISOString().split('T')[0] : ""));

            setBloodGroup(data.bloodGroup || "");
            setPhoneNumber(data.phoneNumber || "");
            setEmergencyContact(data.emergencyContact || "");
            setAddress(data.address || "");
            setPosition(data.position || "");
            setFirstName(data.firstName || "");
            setLastName(data.lastName || "");
            setEmail(data.email || "");
            setImagePreview(data.image || null);
            setRemoveImage(false);
        } catch (error) {
            console.error("Failed to fetch profile:", error);
            toast.error("Failed to load profile");
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableSkills = async (search: string = "") => {
        if (!search.trim()) {
            setAvailableSkills([]);
            return;
        }
        try {
            console.log("Fetching skills with search:", search);
            const response = await axios.get("/auth/skills", {
                params: { search }
            });
            console.log("Available skills fetched:", response.data);
            setAvailableSkills(response.data || []);
        } catch (error) {
            console.error("Failed to fetch skills:", error);
        }
    };

    const handleSave = async () => {
        if (!profile) return;
        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.append("firstName", firstName);
            formData.append("lastName", lastName);
            formData.append("email", email);
            formData.append("position", position);
            formData.append("role", profile.role);
            formData.append("dob", dob);
            formData.append("bloodGroup", bloodGroup);
            formData.append("phoneNumber", phoneNumber);
            formData.append("emergencyContact", emergencyContact);
            formData.append("address", address);
            formData.append("joiningDate", joiningDate);

            // Append arrays as JSON strings
            formData.append("skills", JSON.stringify(editedSkills));
            formData.append("responsibilities", JSON.stringify(editedResponsibilities));

            if (imageFile) {
                formData.append("image", imageFile);
            } else if (removeImage) {
                formData.append("removeImage", "true");
            }

            const response = await axios.put(`/auth/${profile.id}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setProfile({
                ...profile,
                firstName: firstName,
                lastName: lastName,
                email: email,
                skills: editedSkills,
                responsibilities: editedResponsibilities,
                dob: dob,
                bloodGroup: bloodGroup,
                phoneNumber: phoneNumber,
                emergencyContact: emergencyContact,
                address: address,
                joiningDate: joiningDate,
                position: position,
                image: response.data.image || (removeImage ? null : profile.image)
            });
            setIsEditing(false);
            setRemoveImage(false);
            toast.success("Profile updated successfully");
        } catch (error) {
            console.error("Failed to update profile:", error);
            toast.error("Failed to update profile");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddSkill = (skillToAdd: string) => {
        if (skillToAdd.trim() && !editedSkills.includes(skillToAdd.trim())) {
            setEditedSkills([...editedSkills, skillToAdd.trim()]);
            setNewSkill("");
            toast.success("Skill added");
        }
    };

    const removeSkill = (index: number) => {
        setEditedSkills(editedSkills.filter((_, i) => i !== index));
        toast.success("Skill removed");
    };

    const addResponsibility = () => {
        if (newResponsibility.trim()) {
            setEditedResponsibilities([...editedResponsibilities, newResponsibility.trim()]);
            setNewResponsibility("");
            toast.success("Responsibility added");
        }
    };

    const removeResponsibility = (index: number) => {
        setEditedResponsibilities(editedResponsibilities.filter((_, i) => i !== index));
        toast.success("Responsibility removed");
    };

    const handleChangePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            toast.error("Password must be at least 6 characters long");
            return;
        }

        setIsChangingPassword(true);
        try {
            if (!profile) return;
            await axios.put(`/auth/${profile.id}/change-password`, { password: newPassword });
            toast.success("Password updated successfully");
            setIsPasswordDialogOpen(false);
            setNewPassword("");
        } catch (error) {
            console.error("Failed to change password:", error);
            toast.error("Failed to update password");
        } finally {
            setIsChangingPassword(false);
        }
    };

    // Filter skills that are not yet added and match current input
    const filteredAvailableSkills = newSkill.trim() === "" ? [] : availableSkills.filter(
        skill => !editedSkills.includes(skill) &&
            skill.toLowerCase().includes(newSkill.toLowerCase())
    );


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
                    <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-orange-500/20 hover:bg-orange-500/10 hover:text-orange-600 mr-2">
                                <KeyRound className="w-4 h-4 mr-2" /> Change Password
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Change Your Password</DialogTitle>
                                <DialogDescription>
                                    Enter a new password for your account.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex items-center space-x-2 py-4">
                                <div className="grid flex-1 gap-2">
                                    <Input
                                        type="password"
                                        placeholder="Enter new password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
                                    />
                                </div>
                            </div>
                            <DialogFooter className="sm:justify-end">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setIsPasswordDialogOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleChangePassword}
                                    disabled={isChangingPassword}
                                    className="bg-orange-600 hover:bg-orange-700"
                                >
                                    {isChangingPassword ? "Updating..." : "Update Password"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
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
                            <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 p-[2px] shadow-lg mb-6 relative group/avatar">
                                <div className="w-full h-full rounded-full bg-sidebar flex items-center justify-center overflow-hidden relative">
                                    <Avatar className="w-full h-full">
                                        <AvatarImage src={getProxiedImageUrl(imagePreview || profile.image || "")} alt={profile.firstName} className="object-cover" />
                                        <AvatarFallback className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-purple-600">
                                            {profile.firstName[0]}{profile.lastName[0]}
                                        </AvatarFallback>
                                    </Avatar>

                                    {isEditing && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity gap-2">
                                            <div
                                                className="bg-white/20 p-2 rounded-full cursor-pointer hover:bg-white/30 transition-colors"
                                                onClick={() => document.getElementById('image-upload')?.click()}
                                                title="Upload Image"
                                            >
                                                <Camera className="w-5 h-5 text-white" />
                                            </div>
                                            {(imagePreview || profile.image) && (
                                                <div
                                                    className="bg-red-500/80 p-2 rounded-full cursor-pointer hover:bg-red-600/80 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setImageFile(null);
                                                        setImagePreview(null);
                                                        setRemoveImage(true);
                                                    }}
                                                    title="Remove Image"
                                                >
                                                    <Trash2 className="w-5 h-5 text-white" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    id="image-upload"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setImageFile(file);
                                            setImagePreview(URL.createObjectURL(file));
                                            setRemoveImage(false);
                                        }
                                    }}
                                    disabled={!isEditing}
                                />
                            </div>

                            {isEditing ? (
                                <div className="flex gap-2 mb-1">
                                    <Input
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="h-8 text-lg font-bold text-center"
                                        placeholder="First Name"
                                    />
                                    <Input
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="h-8 text-lg font-bold text-center"
                                        placeholder="Last Name"
                                    />
                                </div>
                            ) : (
                                <h2 className="text-2xl font-bold mb-1">{profile.firstName} {profile.lastName}</h2>
                            )}
                            <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                <Briefcase className="w-4 h-4" />
                                {isEditing ? (
                                    <Input
                                        value={position}
                                        onChange={(e) => setPosition(e.target.value)}
                                        className="h-8 text-sm max-w-[200px]"
                                    />
                                ) : (
                                    <span className="text-sm">{profile.position}</span>
                                )}
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
                                        {isEditing ? (
                                            <Input
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="h-8 text-sm"
                                                placeholder="Email Address"
                                            />
                                        ) : (
                                            <p className="font-medium truncate" title={profile.email}>{profile.email}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-sidebar/50 transition-colors">
                                    <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                                        <Phone className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs text-muted-foreground">Phone</p>
                                        {isEditing ? (
                                            <Input
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                                className="h-8 text-sm"
                                                placeholder="+91 0000000000"
                                            />
                                        ) : (
                                            <p className="font-medium truncate">{profile.phoneNumber || "Not set"}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-sidebar/50 transition-colors">
                                    <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                                        <Phone className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs text-muted-foreground">Emergency Contact</p>
                                        {isEditing ? (
                                            <Input
                                                value={emergencyContact}
                                                onChange={(e) => setEmergencyContact(e.target.value)}
                                                className="h-8 text-sm"
                                                placeholder="Emergency number"
                                            />
                                        ) : (
                                            <p className="font-medium truncate">{profile.emergencyContact || "Not set"}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-sidebar/50 transition-colors">
                                    <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500">
                                        <MapPin className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs text-muted-foreground">Address</p>
                                        {isEditing ? (
                                            <Input
                                                value={address}
                                                onChange={(e) => setAddress(e.target.value)}
                                                className="h-8 text-sm"
                                                placeholder="Address"
                                            />
                                        ) : (
                                            <p className="font-medium truncate" title={profile.address}>{profile.address || "Not set"}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-sidebar/50 transition-colors">
                                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs text-muted-foreground">Joined</p>
                                        {isEditing ? (
                                            <Input
                                                type="date"
                                                value={joiningDate}
                                                onChange={(e) => setJoiningDate(e.target.value)}
                                                className="h-8 text-xs"
                                            />
                                        ) : (
                                            <p className="font-medium">
                                                {profile.joiningDate
                                                    ? new Date(profile.joiningDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                                                    : (profile.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A')}
                                            </p>
                                        )}
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

                                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border/50">
                                    <div className="p-2 rounded-lg bg-sidebar/50">
                                        <p className="text-xs text-muted-foreground mb-1">Date of Birth</p>
                                        {isEditing ? (
                                            <Input
                                                type="date"
                                                value={dob}
                                                onChange={(e) => setDob(e.target.value)}
                                                className="h-8 text-xs"
                                            />
                                        ) : (
                                            <p className="font-medium text-sm">
                                                {profile.dob ? new Date(profile.dob).toLocaleDateString() : "Not set"}
                                            </p>
                                        )}
                                    </div>
                                    <div className="p-2 rounded-lg bg-sidebar/50">
                                        <p className="text-xs text-muted-foreground mb-1">Blood Group</p>
                                        {isEditing ? (
                                            <SearchableSelect
                                                value={bloodGroup}
                                                onValueChange={setBloodGroup}
                                                options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => ({
                                                    value: bg,
                                                    label: bg,
                                                }))}
                                                placeholder="Select"
                                                className="h-8 text-[10px]"
                                            />
                                        ) : (
                                            <p className="font-medium text-sm">{profile.bloodGroup || "Not set"}</p>
                                        )}
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
                    <Card className="border-none shadow-lg bg-sidebar/30 backdrop-blur-md relative z-30 overflow-visible">
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
                                <div className="relative max-w-md mt-4 z-50">
                                    <Command shouldFilter={false} className="rounded-lg border shadow-md bg-popover overflow-visible">
                                        <CommandInput
                                            placeholder="Search or add skill..."
                                            value={newSkill}
                                            onValueChange={setNewSkill}
                                            onFocus={() => setOpenSkillSearch(true)}
                                            onBlur={() => setTimeout(() => setOpenSkillSearch(false), 200)}
                                        />
                                        {openSkillSearch && (
                                            <div className="absolute top-full left-0 w-full bg-popover border rounded-b-lg shadow-lg mt-1 max-h-60 overflow-y-auto z-50">
                                                <CommandList>
                                                    {filteredAvailableSkills.length > 0 && (
                                                        <CommandGroup heading="Suggestions">
                                                            {filteredAvailableSkills.map(skill => (
                                                                <CommandItem
                                                                    key={skill}
                                                                    onSelect={() => {
                                                                        handleAddSkill(skill);
                                                                    }}
                                                                    className="cursor-pointer"
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault();
                                                                        handleAddSkill(skill);
                                                                    }}
                                                                >
                                                                    {skill}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    )}

                                                    {filteredAvailableSkills.length === 0 && newSkill.trim() !== "" && (
                                                        <CommandGroup heading="Create new">
                                                            <CommandItem
                                                                onSelect={() => {
                                                                    handleAddSkill(newSkill);
                                                                }}
                                                                className="cursor-pointer"
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    handleAddSkill(newSkill);
                                                                }}
                                                            >
                                                                <Plus className="w-3 h-3 mr-2" /> Create "{newSkill}"
                                                            </CommandItem>
                                                        </CommandGroup>
                                                    )}

                                                    {filteredAvailableSkills.length === 0 && newSkill.trim() === "" && (
                                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                                            Type to search or add skills...
                                                        </div>
                                                    )}
                                                </CommandList>
                                            </div>
                                        )}
                                    </Command>
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

                    {/* Performance Heatmap */}
                    <Card className="border-none shadow-lg bg-sidebar/30 backdrop-blur-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Award className="w-5 h-5 text-orange-500" />
                                Performance Heatmap
                            </CardTitle>
                            <CardDescription>
                                Task completion points across different projects.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TaskPoints employeeName={`${profile.firstName} ${profile.lastName}`} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
