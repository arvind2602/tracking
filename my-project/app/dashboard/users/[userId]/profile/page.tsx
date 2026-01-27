"use client";

import { useEffect, useState } from "react";
import React from 'react';
import axios from "@/lib/axios";
import { User, Mail, Briefcase, Award, Calendar, BadgeCheck, Shield, Check, Edit2, Save, X, Plus, Camera, Trash2, Download } from "lucide-react";
import html2canvas from "html2canvas";
import { QRCodeCanvas } from "qrcode.react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import Breadcrumbs from "@/components/ui/breadcrumbs";
import { TaskPoints } from "@/components/reports/TaskPoints";

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
}

export default function UserProfileView({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = React.use(params);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Edit states
    const [editedSkills, setEditedSkills] = useState<string[]>([]);
    const [editedResponsibilities, setEditedResponsibilities] = useState<string[]>([]);
    const [newSkill, setNewSkill] = useState("");
    const [newResponsibility, setNewResponsibility] = useState("");

    // New fields state
    const [dob, setDob] = useState("");
    const [bloodGroup, setBloodGroup] = useState("");
    const [position, setPosition] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [removeImage, setRemoveImage] = useState(false);

    // ID Card content ref
    const idCardRef = React.useRef<HTMLDivElement>(null);

    const handleDownloadIdCard = async () => {
        if (!idCardRef.current) return;

        try {
            const canvas = await html2canvas(idCardRef.current, {
                useCORS: true, // Important for external images (cloudinary etc)
                scale: 2, // Better quality
                backgroundColor: null,
            } as any);

            const link = document.createElement("a");
            link.download = `${profile?.firstName || "user"}_${profile?.lastName || "id_card"}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            toast.success("ID Card downloaded");
        } catch (error) {
            console.error("Failed to download ID card", error);
            toast.error("Failed to download ID card");
        }
    };

    useEffect(() => {
        if (userId) {
            fetchProfile();
        }
    }, [userId]);

    const fetchProfile = async () => {
        try {
            const response = await axios.get(`/auth/${userId}`);
            const data = response.data;
            // Ensure arrays exist
            data.skills = data.skills || [];
            data.responsibilities = data.responsibilities || [];

            setProfile(data);
            setEditedSkills(data.skills);
            setEditedResponsibilities(data.responsibilities);
            setDob(data.dob ? new Date(data.dob).toISOString().split('T')[0] : "");
            setBloodGroup(data.bloodGroup || "");
            setPosition(data.position || "");
            setImagePreview(data.image || null);
            setRemoveImage(false);
        } catch (error) {
            console.error("Failed to fetch profile:", error);
            toast.error("Failed to load user profile");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!profile) return;
        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.append("firstName", profile.firstName);
            formData.append("lastName", profile.lastName);
            formData.append("position", position);
            formData.append("role", profile.role);
            formData.append("dob", dob);
            formData.append("bloodGroup", bloodGroup);

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
                skills: editedSkills,
                responsibilities: editedResponsibilities,
                dob: dob,
                bloodGroup: bloodGroup,
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

    if (!profile) return <div className="p-8 text-center text-red-500">Failed to load profile.</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Hidden ID Card for Rendering */}
            {/* Hidden ID Card for Rendering */}
            <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
                <div ref={idCardRef} style={{ padding: "40px", background: "#e5e7eb", fontFamily: "'Inter', -apple-system, sans-serif" }}>
                    <div style={{ display: "flex", gap: "40px", justifyContent: "center" }}>

                        {/* FRONT SIDE */}
                        <div style={{
                            width: "340px",
                            height: "540px",
                            background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                            borderRadius: "16px",
                            overflow: "hidden",
                            boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
                            position: "relative",
                            display: "flex",
                            flexDirection: "column"
                        }}>
                            {/* Decorative Pattern */}
                            <div style={{
                                position: "absolute",
                                top: 0,
                                right: 0,
                                width: "200px",
                                height: "200px",
                                background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
                                borderRadius: "50%",
                                transform: "translate(50%, -50%)"
                            }} />
                            {/* Header Section */}
                            <div style={{
                                padding: "24px 24px 16px",
                                background: "rgba(255,255,255,0.95)",
                                position: "relative",
                                zIndex: 1
                            }}>
                                <div style={{
                                    fontSize: "26px",
                                    fontWeight: "800",
                                    letterSpacing: "-0.5px",
                                    textAlign: "center"
                                }}>
                                    <span style={{ color: "#1e3a8a" }}>Vighno</span><span style={{ color: "#f97316" }}>Tech</span>
                                </div>
                                <div style={{
                                    textAlign: "center",
                                    fontSize: "11px",
                                    color: "#6b7280",
                                    marginTop: "4px",
                                    letterSpacing: "1px",
                                    textTransform: "uppercase",
                                    fontWeight: "600"
                                }}>
                                    Employee Identification
                                </div>
                            </div>

                            {/* Photo Section */}
                            <div style={{
                                flex: 1,
                                padding: "32px 24px 24px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                position: "relative",
                                zIndex: 1
                            }}>
                                <div style={{
                                    width: "160px",
                                    height: "200px",
                                    marginBottom: "24px",
                                    borderRadius: "12px",
                                    overflow: "hidden",
                                    border: "4px solid rgba(255,255,255,0.95)",
                                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)"
                                }}>
                                    <img
                                        src={imagePreview || profile?.image || "/placeholder-avatar.jpg"}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            display: "block"
                                        }}
                                        alt="Employee"
                                    />
                                </div>

                                {/* Employee Details */}
                                <div style={{
                                    textAlign: "center",
                                    width: "100%",
                                    background: "rgba(255,255,255,0.95)",
                                    padding: "20px",
                                    borderRadius: "12px",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                                }}>
                                    <h2 style={{
                                        margin: "0 0 8px 0",
                                        fontSize: "22px",
                                        fontWeight: "700",
                                        color: "#1e3a8a",
                                        letterSpacing: "-0.3px"
                                    }}>
                                        {profile?.firstName} {profile?.lastName}
                                    </h2>
                                    <div style={{
                                        fontSize: "13px",
                                        fontWeight: "600",
                                        color: "#f97316",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.8px",
                                        marginBottom: "12px"
                                    }}>
                                        {profile?.position || "Employee"}
                                    </div>
                                    <div style={{
                                        fontSize: "11px",
                                        fontWeight: "600",
                                        color: "#64748b",
                                        fontFamily: "monospace",
                                        letterSpacing: "0.5px"
                                    }}>
                                        ID: {profile?.id?.slice(0, 10).toUpperCase()}
                                    </div>
                                </div>
                            </div>

                            {/* Footer Stripe */}
                            <div style={{
                                height: "8px",
                                background: "#f97316"
                            }} />
                        </div>

                        {/* BACK SIDE */}
                        <div style={{
                            width: "340px",
                            height: "540px",
                            background: "#ffffff",
                            borderRadius: "16px",
                            overflow: "hidden",
                            boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
                            position: "relative",
                            display: "flex",
                            flexDirection: "column"
                        }}>
                            {/* Header */}
                            <div style={{
                                padding: "24px",
                                background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                                textAlign: "center",
                                position: "relative"
                            }}>
                                <div style={{
                                    fontSize: "18px",
                                    fontWeight: "700",
                                    color: "#ffffff",
                                    letterSpacing: "0.5px"
                                }}>
                                    EMPLOYEE INFORMATION
                                </div>
                            </div>

                            {/* Content */}
                            <div style={{
                                flex: 1,
                                padding: "32px 28px",
                                display: "flex",
                                flexDirection: "column"
                            }}>
                                {/* ID Section */}
                                <div style={{ marginBottom: "24px" }}>
                                    <div style={{
                                        fontSize: "11px",
                                        color: "#9ca3af",
                                        marginBottom: "6px",
                                        textTransform: "uppercase",
                                        fontWeight: "700",
                                        letterSpacing: "1px"
                                    }}>
                                        Employee ID Number
                                    </div>
                                    <div style={{
                                        fontSize: "15px",
                                        color: "#1e3a8a",
                                        fontWeight: "600",
                                        fontFamily: "monospace",
                                        background: "#f3f4f6",
                                        padding: "10px 12px",
                                        borderRadius: "6px",
                                        border: "1px solid #e5e7eb"
                                    }}>
                                        {profile?.id?.slice(0, 16).toUpperCase()}
                                    </div>
                                </div>

                                {/* Email */}
                                <div style={{ marginBottom: "24px" }}>
                                    <div style={{
                                        fontSize: "11px",
                                        color: "#9ca3af",
                                        marginBottom: "6px",
                                        textTransform: "uppercase",
                                        fontWeight: "700",
                                        letterSpacing: "1px"
                                    }}>
                                        Official Email
                                    </div>
                                    <div style={{
                                        fontSize: "13px",
                                        color: "#111827",
                                        fontWeight: "500",
                                        wordBreak: "break-word"
                                    }}>
                                        {profile?.email}
                                    </div>
                                </div>

                                {/* Personal Details Grid */}
                                <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: "20px",
                                    marginBottom: "28px",
                                    padding: "20px",
                                    background: "#f9fafb",
                                    borderRadius: "8px",
                                    border: "1px solid #e5e7eb"
                                }}>
                                    <div>
                                        <div style={{
                                            fontSize: "11px",
                                            color: "#9ca3af",
                                            marginBottom: "6px",
                                            textTransform: "uppercase",
                                            fontWeight: "700",
                                            letterSpacing: "0.5px"
                                        }}>
                                            Date of Birth
                                        </div>
                                        <div style={{
                                            fontSize: "13px",
                                            color: "#111827",
                                            fontWeight: "600"
                                        }}>
                                            {profile?.dob ? new Date(profile.dob).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: '2-digit',
                                                year: 'numeric'
                                            }) : "N/A"}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{
                                            fontSize: "11px",
                                            color: "#9ca3af",
                                            marginBottom: "6px",
                                            textTransform: "uppercase",
                                            fontWeight: "700",
                                            letterSpacing: "0.5px"
                                        }}>
                                            Blood Type
                                        </div>
                                        <div style={{
                                            fontSize: "13px",
                                            color: "#111827",
                                            fontWeight: "600"
                                        }}>
                                            {profile?.bloodGroup || "N/A"}
                                        </div>
                                    </div>
                                </div>

                                {/* QR Code Section */}
                                <div style={{
                                    marginTop: "auto",
                                    textAlign: "center",
                                    padding: "20px",
                                    background: "#ffffff",
                                    borderRadius: "8px",
                                    border: "2px dashed #e5e7eb"
                                }}>
                                    <div style={{
                                        fontSize: "10px",
                                        color: "#9ca3af",
                                        marginBottom: "12px",
                                        textTransform: "uppercase",
                                        fontWeight: "700",
                                        letterSpacing: "1px"
                                    }}>
                                        Scan for Verification
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "center" }}>
                                        <QRCodeCanvas
                                            value={`vighnotech:employee:${profile?.id}`}
                                            size={110}
                                            level={"H"}
                                            style={{ border: "4px solid white", borderRadius: "8px" }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{
                                padding: "16px",
                                background: "#f9fafb",
                                borderTop: "1px solid #e5e7eb",
                                textAlign: "center"
                            }}>
                                <div style={{
                                    fontSize: "9px",
                                    color: "#9ca3af",
                                    fontWeight: "600",
                                    letterSpacing: "0.5px"
                                }}>
                                    This card remains property of VighnoTech • Report if lost
                                </div>
                            </div>

                            {/* Bottom Accent */}
                            <div style={{
                                height: "8px",
                                background: "#1e3a8a"
                            }} />
                        </div>

                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <div className="flex items-center gap-2">
                    <Button onClick={handleDownloadIdCard} variant="outline" className="border-orange-500/20 hover:bg-orange-500/10 hover:text-orange-600 mr-2">
                        <Download className="w-4 h-4 mr-2" /> Download ID Card
                    </Button>
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
                                        <AvatarImage src={imagePreview || profile.image} alt={profile.firstName} className="object-cover" />
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

                            <h2 className="text-2xl font-bold mb-1">{profile.firstName} {profile.lastName}</h2>
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
                                            <Select value={bloodGroup} onValueChange={setBloodGroup}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Select" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                                                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
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
                                <h3 className="text-2xl font-bold mb-2">Employee Overview</h3>
                                <p className="text-blue-100 max-w-lg">
                                    Reviewing the profile and performance details of {profile.firstName}.
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
                                Technologies and competencies.
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
                                    <p className="text-sm text-muted-foreground italic">No skills listed.</p>
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
                    {/* Responsibilities Section */}
                    {/* ... (existing code for responsibilities) ... */}
                    <Card className="border-none shadow-lg bg-sidebar/30 backdrop-blur-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Briefcase className="w-5 h-5 text-purple-500" />
                                Roles & Responsibilities
                            </CardTitle>
                            <CardDescription>
                                Key duties and expected contributions.
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
        </div >
    );
}
