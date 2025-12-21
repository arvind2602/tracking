"use client";

import React, { useState, useEffect } from "react";
import axios from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MapPin, Plus, Download, Trash2, Loader } from "lucide-react";
import toast from "react-hot-toast";
import QRCode from "qrcode";

interface Site {
    id: string;
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
    createdAt: string;
}

export default function SitesPage() {
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newSite, setNewSite] = useState({ name: "", description: "", latitude: 0, longitude: 0 });
    const [gettingLocation, setGettingLocation] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSites();
    }, []);

    const fetchSites = async () => {
        try {
            const res = await axios.get("/sites");
            setSites(res.data);
        } catch (err) {
            toast.error("Failed to load sites.");
        } finally {
            setLoading(false);
        }
    };

    const getCurrentLocation = () => {
        setGettingLocation(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setNewSite(prev => ({
                        ...prev,
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude
                    }));
                    setGettingLocation(false);
                    toast.success("Location captured!");
                },
                (err) => {
                    toast.error("Failed to get location.");
                    setGettingLocation(false);
                }
            );
        } else {
            toast.error("Geolocation not supported.");
            setGettingLocation(false);
        }
    };

    const handleAddSite = async () => {
        if (!newSite.name || !newSite.latitude || !newSite.longitude) {
            toast.error("Name and location are required.");
            return;
        }
        setSaving(true);
        try {
            const res = await axios.post("/sites", newSite);
            setSites(prev => [res.data, ...prev]);
            setShowAddModal(false);
            setNewSite({ name: "", description: "", latitude: 0, longitude: 0 });
            toast.success("Site created!");
        } catch (err) {
            toast.error("Failed to create site.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSite = async (siteId: string) => {
        if (!confirm("Are you sure you want to delete this site?")) return;
        try {
            await axios.delete(`/sites/${siteId}`);
            setSites(prev => prev.filter(s => s.id !== siteId));
            toast.success("Site deleted.");
        } catch (err) {
            toast.error("Failed to delete site.");
        }
    };

    const handleDownloadQR = async (site: Site) => {
        try {
            const res = await axios.get(`/sites/${site.id}/qr`);
            const token = res.data.token;

            // Generate QR Code as Data URL
            const qrDataUrl = await QRCode.toDataURL(token, { width: 400, margin: 2 });

            // Create download link
            const link = document.createElement("a");
            link.href = qrDataUrl;
            link.download = `${site.name.replace(/\s+/g, "_")}_QR.png`;
            link.click();

            toast.success("QR Code downloaded!");
        } catch (err) {
            toast.error("Failed to generate QR code.");
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Sites / Checkpoints</h1>
                <Button onClick={() => setShowAddModal(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Site
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sites.map((site) => (
                    <Card key={site.id} className="relative">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-primary" />
                                {site.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-2">
                                {site.description || "No description"}
                            </p>
                            <div className="text-xs text-muted-foreground font-mono">
                                {site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}
                            </div>
                            <div className="flex gap-2 mt-4">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={() => handleDownloadQR(site)}
                                >
                                    <Download className="h-3 w-3" />
                                    Download QR
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-500 hover:text-red-600"
                                    onClick={() => handleDeleteSite(site.id)}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {sites.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No sites created yet.</p>
                    <p className="text-sm">Add your first site to generate a QR code.</p>
                </div>
            )}

            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Site</DialogTitle>
                        <DialogDescription>
                            Create a checkpoint location. Use "Get Current Location" while at the site.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Site Name *</label>
                            <Input
                                placeholder="e.g., Main Entrance"
                                value={newSite.name}
                                onChange={(e) => setNewSite(prev => ({ ...prev, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description</label>
                            <Input
                                placeholder="Optional description"
                                value={newSite.description}
                                onChange={(e) => setNewSite(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Location *</label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder="Latitude"
                                    value={newSite.latitude || ""}
                                    onChange={(e) => setNewSite(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                                    className="flex-1"
                                />
                                <Input
                                    type="number"
                                    placeholder="Longitude"
                                    value={newSite.longitude || ""}
                                    onChange={(e) => setNewSite(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                                    className="flex-1"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full gap-2"
                                onClick={getCurrentLocation}
                                disabled={gettingLocation}
                            >
                                <MapPin className="h-4 w-4" />
                                {gettingLocation ? "Getting Location..." : "Get Current Location"}
                            </Button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                        <Button onClick={handleAddSite} disabled={saving}>
                            {saving ? "Saving..." : "Create Site"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
