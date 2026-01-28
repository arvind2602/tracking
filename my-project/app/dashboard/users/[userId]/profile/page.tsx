"use client";

import { useEffect, useState } from "react";
import React from 'react';
import axios from "@/lib/axios";
import { User, Mail, Briefcase, Award, Calendar, BadgeCheck, Shield, Check, Edit2, Save, X, Plus, Camera, Trash2, Download, Loader2 } from "lucide-react";
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
import { TaskPoints } from "@/components/reports/TaskPoints";
import { removeBackground } from "@imgly/background-removal";



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
    joiningDate?: string;
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
    const [phoneNumber, setPhoneNumber] = useState("");
    const [joiningDate, setJoiningDate] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [position, setPosition] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [removeImage, setRemoveImage] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [processedImage, setProcessedImage] = useState<string | null>(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);

    // ID Card content ref
    const idCardRef = React.useRef<HTMLDivElement>(null);

    const handleDownloadIdCard = async () => {
        if (!idCardRef.current) return;
        setIsDownloading(true);
        const toastId = toast.loading("Processing image and generating ID Card...");

        try {
            // Process image first if not already processed
            const sourceImage = imagePreview || profile?.image || "./Arvind.png";
            let currentProcessedImage = processedImage;

            // Always re-process to ensure freshness, or check if we need to
            // For now, let's process it now.
            if (!currentProcessedImage) {
                try {
                    console.log("Starting background removal for ID card image:", sourceImage);
                    const config = {
                        publicPath: 'https://static.imgly.com/lib/background-removal-js/v1.7.0/dist/'
                    };
                    const imageBlob = await removeBackground(sourceImage);
                    currentProcessedImage = URL.createObjectURL(imageBlob);
                    setProcessedImage(currentProcessedImage); // Update state to show it

                    // Wait for state update and re-render
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (err) {
                    console.error("Background removal failed, using original", err);
                    currentProcessedImage = sourceImage;
                }
            }

            // Now capture
            const canvas = await html2canvas(idCardRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: null,
            } as any);

            const link = document.createElement("a");
            link.download = `${profile?.firstName || "user"}_${profile?.lastName || "id_card"}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            toast.success("ID Card downloaded", { id: toastId });
        } catch (error) {
            console.error("Failed to download ID card", error);
            toast.error("Failed to download ID card", { id: toastId });
        } finally {
            setIsDownloading(false);
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
            setEditedResponsibilities(data.responsibilities);
            setDob(data.dob ? new Date(data.dob).toISOString().split('T')[0] : "");
            setBloodGroup(data.bloodGroup || "");
            setPhoneNumber(data.phoneNumber || "");
            setJoiningDate(data.joiningDate ? new Date(data.joiningDate).toISOString().split('T')[0] : (data.createdAt ? new Date(data.createdAt).toISOString().split('T')[0] : ""));
            setPosition(data.position || "");
            setFirstName(data.firstName || "");
            setLastName(data.lastName || "");
            setEmail(data.email || "");
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
            formData.append("firstName", firstName);
            formData.append("lastName", lastName);
            formData.append("email", email);
            formData.append("position", position);
            formData.append("role", profile.role);
            formData.append("dob", dob);
            formData.append("bloodGroup", bloodGroup);
            formData.append("phoneNumber", phoneNumber);
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
                <div ref={idCardRef} className="flex gap-10 items-start p-10" style={{ width: "fit-content", fontFamily: "'Montserrat', sans-serif", backgroundColor: "transparent" }}>
                    {/* External Resources */}
                    <link rel="preconnect" href="https://fonts.googleapis.com" />
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                    <link
                        href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap"
                        rel="stylesheet"
                    />
                    <link
                        href="https://fonts.googleapis.com/icon?family=Material+Icons"
                        rel="stylesheet"
                    />

                    {/* Custom Styles */}
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        .grid-pattern {
                            background-image:
                                linear-gradient(#e2e8f0 1px, transparent 1px),
                                linear-gradient(90deg, #e2e8f0 1px, transparent 1px);
                            background-size: 20px 20px;
                        }
                        .font-display {
                            font-family: 'Montserrat', sans-serif;
                        }
                    `}} />

                    {/* FRONT SIDE */}
                    <div
                        className="w-[450px] h-[720px] rounded-[24px] shadow-2xl overflow-hidden font-display relative flex flex-col shrink-0"
                        style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: '1px' }}
                    >
                        <div className="relative flex-1 flex flex-col">
                            <div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none"></div>

                            <div className="relative z-10 px-8 pt-12 gap-2 flex-1 flex flex-col">
                                {/* Logo Header */}
                                <div className="flex items-center justify-center ">
                                    <img
                                        src="https://admissionuploads.s3.ap-south-1.amazonaws.com//1769512650123_VLogo.png"
                                        alt="VighnoTech Logo"
                                        className=""
                                        crossOrigin="anonymous"
                                    />
                                    <img
                                        src="https://admissionuploads.s3.ap-south-1.amazonaws.com//1769512668299_vighnotechNewLogo.png"
                                        alt="VighnoTech Text Logo"
                                        className=""
                                        crossOrigin="anonymous"
                                    />
                                </div>

                                {/* Employee Name */}
                                <div className="text-center mb-[30px] mt-[-20px]">
                                    <h1 className="text-5xl font-bold leading-tight" style={{ color: '#0f172a' }}>
                                        {profile?.firstName || "Arvind"}
                                    </h1>
                                    <h1 className="text-5xl font-bold leading-tight" style={{ color: '#0f172a' }}>
                                        {profile?.lastName || "Gupta"}
                                    </h1>
                                </div>

                                {/* Designation Badge */}
                                <div className="flex justify-center items-center">
                                    <div
                                        className="px-4 py-2 rounded-full shadow-md items-center justify-center text-center"
                                        style={{ backgroundColor: '#FF7905' }}
                                    >
                                        <p className="font-bold mb-2 mt-[-2px] text-lg uppercase tracking-wider text-white">
                                            {profile?.position || ""}
                                        </p>
                                    </div>
                                </div>



                                {/* Employee Photo Container */}
                                <div className="relative flex-1 overflow-hidden mt-auto">
                                    {/* Large V Logo Background */}
                                    <div className="absolute inset-0 flex items-end justify-center z-0 translate-y-20">
                                        <img
                                            src="https://admissionuploads.s3.ap-south-1.amazonaws.com//1769514419110_Vighnotech_Tick.png"
                                            alt="Background V"
                                            className="w-[450px] max-w-none opacity-90"
                                            crossOrigin="anonymous"
                                        />
                                    </div>

                                    {/* Employee Photo */}
                                    <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center">
                                        <img
                                            src={processedImage || imagePreview || profile?.image || "./Arvind.png"}
                                            className="w-[450px] object-contain"
                                            crossOrigin="anonymous"
                                            alt="Profile"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BACK SIDE */}
                    <div
                        className="w-[450px] h-[720px] rounded-[24px] shadow-2xl overflow-hidden font-display relative flex flex-col shrink-0"
                        style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: '1px' }}
                    >
                        <div className="relative flex-1 flex flex-col">
                            <div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none"></div>

                            <div className="relative z-10 px-8 pt-6 gap-2 flex-1 flex flex-col">
                                {/* Logo Header */}
                                <div className="flex items-center justify-center mb-2">
                                    <img
                                        src="https://admissionuploads.s3.ap-south-1.amazonaws.com//1769512650123_VLogo.png"
                                        alt="VighnoTech Logo"
                                        crossOrigin="anonymous"
                                    />
                                    <img
                                        src="https://admissionuploads.s3.ap-south-1.amazonaws.com//1769512668299_vighnotechNewLogo.png"
                                        alt="VighnoTech Text Logo"
                                        crossOrigin="anonymous"
                                    />
                                </div>

                                {/* Contact Information */}
                                <div className="space-y-6 mb-5">
                                    {/* Email */}
                                    <div className="flex items-center group">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0" style={{ backgroundColor: 'rgba(255, 121, 5, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-icons text-2xl" style={{ color: '#FF7905' }}>alternate_email</span>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase tracking-wider font-bold" style={{ color: '#94a3b8' }}>Email Address</p>
                                            <p className="font-bold break-all text-base" style={{ color: '#1e293b' }}>{profile?.email}</p>
                                        </div>
                                    </div>

                                    {/* Phone */}
                                    <div className="flex items-center group">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0" style={{ backgroundColor: 'rgba(255, 121, 5, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-icons text-2xl" style={{ color: '#FF7905' }}>call</span>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase tracking-wider font-bold" style={{ color: '#94a3b8' }}>Phone Number</p>
                                            <p className="font-bold text-base" style={{ color: '#1e293b' }}>{profile?.phoneNumber || "+91 9833911446"}</p>
                                        </div>
                                    </div>

                                    {/* DOB */}
                                    <div className="flex items-center group">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0" style={{ backgroundColor: 'rgba(255, 121, 5, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-icons text-2xl" style={{ color: '#FF7905' }}>cake</span>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase tracking-wider font-bold" style={{ color: '#94a3b8' }}>Date of Birth</p>
                                            <p className="font-bold text-base" style={{ color: '#1e293b' }}>
                                                {profile?.dob ? new Date(profile.dob).toLocaleDateString('en-GB') : "07 / 03 / 2002"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Blood Group */}
                                    <div className="flex items-center group">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0" style={{ backgroundColor: 'rgba(255, 121, 5, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-icons text-2xl" style={{ color: '#FF7905' }}>water_drop</span>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase tracking-wider font-bold" style={{ color: '#94a3b8' }}>Blood Group</p>
                                            <p className="font-bold text-base" style={{ color: '#1e293b' }}>{profile?.bloodGroup || "'O' Positive"}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* QR Code Section */}
                                <div className="flex flex-col items-center justify-center mb-5 mt-auto">
                                    <div className="relative p-3 rounded-2xl shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: '#f1f5f9', borderWidth: '1px' }}>
                                        <div className="w-48 h-48 flex items-center justify-center relative rounded-lg overflow-hidden" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: '1px' }}>
                                            <QRCodeCanvas
                                                value={`https://vigtask.vercel.app/dashboard/users/${userId}/profile`}
                                                size={170}
                                                bgColor={"transparent"}
                                                fgColor={"#1e293b"}
                                                level={"H"}
                                            />
                                            {/* Center Logo */}
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="p-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.95)' }}>
                                                    <img
                                                        src="https://admissionuploads.s3.ap-south-1.amazonaws.com//1769512650123_VLogo.png"
                                                        alt="Logo"
                                                        className="w-10 h-10 object-contain"
                                                        crossOrigin="anonymous"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Address Footer */}
                            <div className="px-8 py-5 text-center relative z-20" style={{ backgroundColor: '#FF7905' }}>
                                <p className="text-[15px] font-bold leading-relaxed" style={{ color: '#000000' }}>
                                    90 Feet Rd, Thakur Complex, Kandivali East,<br />
                                    Mumbai - 400101, Maharashtra.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleDownloadIdCard}
                        disabled={isDownloading || isProcessingImage}
                        variant="outline"
                        className="border-orange-500/20 hover:bg-orange-500/10 hover:text-orange-600 mr-2"
                    >
                        {isProcessingImage ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing ID...</>
                        ) : isDownloading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Downloading...</>
                        ) : (
                            <><Download className="w-4 h-4 mr-2" /> Download ID Card</>
                        )}
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
                                        <span className="material-icons text-base">call</span>
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
