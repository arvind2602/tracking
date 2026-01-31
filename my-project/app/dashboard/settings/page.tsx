'use client';

import React, { useEffect, useState, useRef } from 'react';
import axios from '@/lib/axios';
import { Settings, Layout, Save, Loader2, Building, Upload, X, Link } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { getProxiedImageUrl } from '@/lib/imageProxy';

export default function OrganizationSettings() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);

    const [settings, setSettings] = useState({
        name: '',
        showBanner: true,
        logo: ''
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                if (decoded.user.role !== 'ADMIN') {
                    router.push('/dashboard');
                    return;
                }
            } catch (e) {
                router.push('/');
                return;
            }
        } else {
            router.push('/');
            return;
        }

        const fetchSettings = async () => {
            try {
                const response = await axios.get('/organization/settings');
                setSettings({
                    ...response.data,
                    logo: response.data.logo || ''
                });
            } catch (error) {
                console.error('Failed to fetch settings', error);
                toast.error("Failed to load organization settings");
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [router]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                toast.error("File size should be less than 2MB");
                return;
            }
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setSettings({ ...settings, logo: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('name', settings.name);
            formData.append('showBanner', String(settings.showBanner));

            // If it's a file, upload it. If it's a string, send as URL
            if (logoFile) {
                formData.append('logo', logoFile);
            } else {
                formData.append('logo', settings.logo);
            }

            await axios.put('/organization/settings', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            toast.success("Settings saved successfully");
            // Refresh to update sidebar and layout immediately
            window.location.reload();
        } catch (error) {
            console.error('Failed to save settings', error);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            <div className="flex items-center gap-2 mb-8">
                <Settings className="h-8 w-8 text-blue-500" />
                <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Organization Settings
                </h1>
            </div>

            <div className="grid gap-6">
                {/* Branding Block */}
                <Card className="border-sidebar-border bg-sidebar/50 backdrop-blur-xl shadow-2xl overflow-hidden relative group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                                <Building className="h-5 w-5 text-purple-500" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">Organization Branding</CardTitle>
                                <CardDescription>Update your company name and logo displayed across the platform.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {/* Name Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground ml-1">Company Name</label>
                            <Input
                                value={settings.name}
                                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                                placeholder="Enter organization name"
                                className="bg-sidebar-accent/30 border-sidebar-border focus:border-purple-500/50 transition-all"
                            />
                        </div>

                        {/* Logo URL Input */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-sm font-medium text-foreground">Organization Logo</label>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest bg-sidebar-accent px-2 py-0.5 rounded">URL or Upload</span>
                            </div>

                            <div className="flex gap-4 items-start">
                                <div className="relative w-24 h-24 rounded-2xl bg-sidebar-accent flex items-center justify-center overflow-hidden border border-sidebar-border shadow-inner shrink-0 group-hover:border-purple-500/30 transition-all">
                                    {settings.logo ? (
                                        <img src={getProxiedImageUrl(settings.logo)} alt="Preview" className="w-full h-full object-contain p-2" />
                                    ) : (
                                        <Building className="h-10 w-10 text-muted-foreground/30" />
                                    )}
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                    >
                                        <Upload className="h-6 w-6 text-white" />
                                    </div>
                                </div>

                                <div className="flex-1 space-y-3">
                                    <div className="relative">
                                        <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={settings.logo}
                                            onChange={(e) => {
                                                setSettings({ ...settings, logo: e.target.value });
                                                setLogoFile(null); // Clear file if URL is manually edited
                                            }}
                                            placeholder="https://example.com/logo.png"
                                            className="bg-sidebar-accent/30 border-sidebar-border focus:border-purple-500/50 pl-10 h-10 transition-all"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            className="hidden"
                                            accept="image/*"
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-sidebar-border hover:bg-sidebar-accent h-8 text-xs font-semibold"
                                        >
                                            <Upload className="h-3 w-3 mr-2" />
                                            Upload File
                                        </Button>
                                        {settings.logo && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setSettings({ ...settings, logo: '' });
                                                    setLogoFile(null);
                                                }}
                                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-xs"
                                            >
                                                <X className="h-3 w-3 mr-2" />
                                                Clear
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground ml-1 italic italic">Best: 1:1 ratio, transparent background. Max 2MB for uploads.</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Preferences Block */}
                <Card className="border-sidebar-border bg-sidebar/50 backdrop-blur-xl shadow-xl overflow-hidden relative group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <Layout className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">Display Preferences</CardTitle>
                                <CardDescription>Manage global dashboard visibility settings.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-sidebar-accent/30 border border-sidebar-border hover:border-blue-500/20 transition-all duration-300">
                            <div className="space-y-1">
                                <h4 className="text-sm font-semibold text-foreground">Performance Banner</h4>
                                <p className="text-xs text-muted-foreground max-w-md">
                                    Show/hide the top banner (birthdays, star performers, alerts).
                                </p>
                            </div>
                            <Switch
                                checked={settings.showBanner}
                                onCheckedChange={(checked: boolean) => setSettings({ ...settings, showBanner: checked })}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-end pt-4">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-xl min-w-[160px] animate-in zoom-in-95 duration-300"
                >
                    {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                    Save All Changes
                </Button>
            </div>
        </div>
    );
}
