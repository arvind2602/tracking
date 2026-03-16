'use client';

import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import {
    QrCode,
    MapPin,
    Plus,
    Trash2,
    Download,
    Navigation,
    History,
    CheckCircle2,
    XCircle,
    Loader2,
    Smartphone,
    Activity,
    ShieldCheck,
    Zap,
    AlertTriangle,
    X,
    Building as BuildingIcon,
    Layers,
    Maximize2,
    Filter,
    ArrowUpRight,
    Map as MapIcon,
    Layout
} from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { QRMapVisualization } from '@/components/qr/QRMapVisualization';

interface QRLocation {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
    createdAt: string;
}

interface QRVisit {
    id: string;
    timestamp: string;
    userLat: number;
    userLng: number;
    distance: number;
    isValid: boolean;
    locationName: string;
    firstName: string;
    lastName: string;
    email: string;
    deviceId: string;
    deviceMismatch: boolean;
    indoor?: {
        building_name: string;
        floor_name: string;
        zone_name: string;
        level: number;
    };
}

interface Building {
    id: string;
    name: string;
    lat: number;
    lng: number;
    floors: Floor[];
}

interface Floor {
    id: string;
    level: number;
    name: string;
    mapUrl?: string;
    zones: Zone[];
}

interface Zone {
    id: string;
    name: string;
    type: string;
    x: number;
    y: number;
    qrId?: string;
}

export default function QRVerificationPage() {
    const [locations, setLocations] = useState<QRLocation[]>([]);
    const [visits, setVisits] = useState<QRVisit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [activeTab, setActiveTab] = useState<'locations' | 'history' | 'spatial' | 'setup'>('locations');
    const [viewMode, setViewMode] = useState<'map' | 'indoor'>('map');
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
    const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);

    // New location form
    const [newLoc, setNewLoc] = useState({
        name: '',
        latitude: 0,
        longitude: 0,
        radius: 50
    });

    // Setup forms
    const [setupBuilding, setSetupBuilding] = useState({ name: '', address: '', latitude: 0, longitude: 0 });
    const [setupFloor, setSetupFloor] = useState({ buildingId: '', level: 0, name: '' });
    const [setupZone, setSetupZone] = useState({ floorId: '', name: '', type: 'ROOM', x: 50, y: 50, qrLocationId: '' });

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Live polling every 5s
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [locRes, visitRes, spatialRes] = await Promise.all([
                axios.get('/qr/locations'),
                axios.get('/qr/visits'),
                axios.get('/qr/spatial-tree')
            ]);
            setLocations(locRes.data);
            setVisits(visitRes.data);
            setBuildings(spatialRes.data);
        } catch (error) {
            console.error('Failed to fetch QR data', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            await axios.post('/qr/locations', newLoc);
            toast.success('Location created successfully');
            setNewLoc({ name: '', latitude: 0, longitude: 0, radius: 50 });
            fetchData();
        } catch (error) {
            toast.error('Failed to create location');
        } finally {
            setIsCreating(false);
        }
    };

    const downloadQR = (id: string, name: string) => {
        const svg = document.getElementById(`qr-${id}`);
        if (!svg) return;
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            const pngFile = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.download = `QR-${name}.png`;
            downloadLink.href = `${pngFile}`;
            downloadLink.click();
        };
        img.src = "data:image/svg+xml;base64," + btoa(svgData);
    };

    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setNewLoc({
                    ...newLoc,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
                toast.success("Location captured!");
            },
            () => {
                toast.error("Unable to retrieve your location");
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    };

    const getBuildingGPS = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setSetupBuilding({
                    ...setupBuilding,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
                toast.success("Building coordinates captured!");
            },
            () => {
                toast.error("Unable to retrieve coordinates");
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    };

    const handleCreateBuilding = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post('/qr/buildings', setupBuilding);
            toast.success('Building integrated into matrix');
            setSetupBuilding({ name: '', address: '', latitude: 0, longitude: 0 });
            fetchData();
        } catch (error) {
            toast.error('Matrix rejection: Building registration failed');
        }
    };

    const handleCreateFloor = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post('/qr/floors', setupFloor);
            toast.success('Level added to building');
            setSetupFloor({ ...setupFloor, name: '', level: setupFloor.level + 1 });
            fetchData();
        } catch (error) {
            toast.error('Floor deployment failed');
        }
    };

    const handleCreateZone = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post('/qr/zones', setupZone);
            toast.success('Zone localized');
            setSetupZone({ ...setupZone, name: '', x: setupZone.x + 5, y: setupZone.y + 5 });
            fetchData();
        } catch (error) {
            toast.error('Zone deployment failed');
        }
    };

    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleDeleteLocation = async (id: string) => {
        try {
            await axios.delete(`/qr/locations/${id}`);
            toast.success('Location deleted');
            setIsDeleting(null);
            fetchData();
        } catch (error) {
            toast.error('Failed to delete location');
            console.error(error);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        QR Verification System
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Secure location-based presence tracking using unique QR codes and GPS validation.
                    </p>
                </div>

                <div className="flex bg-card/50 p-1 rounded-xl border border-border/50 backdrop-blur-sm self-start overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('locations')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'locations' ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-accent'}`}
                    >
                        <MapPin className="h-4 w-4" />
                        Locations
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-accent'}`}
                    >
                        <History className="h-4 w-4" />
                        Visit Logs
                    </button>
                    <button
                        onClick={() => setActiveTab('spatial')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'spatial' ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-accent'}`}
                    >
                        <Layout className="h-4 w-4" />
                        Spatial Matrix
                    </button>
                    <button
                        onClick={() => setActiveTab('setup')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'setup' ? 'bg-orange-500 text-white shadow-lg' : 'hover:bg-accent'}`}
                    >
                        <ShieldCheck className="h-4 w-4" />
                        Setup Matrix
                    </button>
                    <Link
                        href="/dashboard/qr/scan"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent transition-all text-muted-foreground ml-2 border-l border-border pl-4"
                    >
                        <Smartphone className="h-4 w-4" />
                        Scanner App
                    </Link>
                </div>
            </div>

            {/* Production Stats Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-4 transition-all hover:shadow-lg">
                    <div className="p-3 bg-blue-500/10 rounded-xl">
                        <MapPin className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Positions</div>
                        <div className="text-2xl font-black">{locations.length}</div>
                    </div>
                </div>
                <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-4 transition-all hover:shadow-lg">
                    <div className="p-3 bg-green-500/10 rounded-xl">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Total Scans</div>
                        <div className="text-2xl font-black">{visits.length}</div>
                    </div>
                </div>
                <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-4 transition-all hover:shadow-lg">
                    <div className="p-3 bg-orange-500/10 rounded-xl">
                        <Zap className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Accuracy</div>
                        <div className="text-2xl font-black">
                            {visits.length > 0
                                ? Math.round((visits.filter(v => v.isValid).length / visits.length) * 100)
                                : 0}%
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-4 transition-all hover:shadow-lg">
                    <div className="p-3 bg-purple-500/10 rounded-xl">
                        <BuildingIcon className="h-6 w-6 text-purple-500" />
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Buildings</div>
                        <div className="text-2xl font-black">{buildings.length}</div>
                    </div>
                </div>
            </div>

            {activeTab === 'locations' ? (
                <div className="space-y-8">
                    {/* Live Map Visualization */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary animate-pulse" />
                            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Spatial Real-time View</h2>
                        </div>
                        <QRMapVisualization locations={locations} visits={visits} />
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Add Location Form */}
                        <div className="md:col-span-1">
                            <div className="bg-card border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Plus className="h-24 w-24 text-primary" />
                                </div>
                                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <Plus className="h-5 w-5 text-primary" />
                                    </div>
                                    Add New QR Point
                                </h2>
                                <form onSubmit={handleCreateLocation} className="space-y-4 relative z-10">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Point Name</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Office Main Entrance"
                                            className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-sm"
                                            value={newLoc.name}
                                            onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Latitude</label>
                                            <input
                                                required
                                                type="number"
                                                step="any"
                                                className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs font-mono"
                                                value={newLoc.latitude}
                                                onChange={(e) => setNewLoc({ ...newLoc, latitude: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Longitude</label>
                                            <input
                                                required
                                                type="number"
                                                step="any"
                                                className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs font-mono"
                                                value={newLoc.longitude}
                                                onChange={(e) => setNewLoc({ ...newLoc, longitude: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={getCurrentLocation}
                                            className="flex-1 flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground py-3 rounded-xl transition-all font-medium border border-border/50 text-xs"
                                        >
                                            <Navigation className="h-3 w-3" />
                                            GPS
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isCreating}
                                            className="flex-[2] flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-xl transition-all shadow-lg shadow-primary/20 font-medium disabled:opacity-50 text-xs uppercase"
                                        >
                                            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                            Deploy
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Locations Grid */}
                        <div className="md:col-span-2">
                            <div className="grid sm:grid-cols-2 gap-4">
                                {locations.map((loc) => (
                                    <div key={loc.id} className="group bg-card border border-border rounded-2xl p-5 hover:shadow-2xl hover:shadow-primary/5 transition-all relative overflow-hidden border-l-4 border-l-primary/50">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <h3 className="font-bold text-lg">{loc.name}</h3>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                                                    <Navigation className="h-3 w-3" />
                                                    {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                                                </div>
                                            </div>
                                            <div className="bg-white p-2 rounded-xl border border-gray-200">
                                                <QRCodeSVG id={`qr-${loc.id}`} value={loc.id} size={80} level="M" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border/50">
                                            <button
                                                onClick={() => downloadQR(loc.id, loc.name)}
                                                className="flex-1 flex items-center justify-center gap-2 bg-secondary hover:bg-accent text-accent-foreground text-[10px] py-2 rounded-lg transition-colors border border-border/50 font-black uppercase tracking-widest"
                                            >
                                                <Download className="h-3 w-3" />
                                                PNG
                                            </button>
                                            <button
                                                className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20"
                                                onClick={() => setIsDeleting(loc.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'history' ? (
                <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-accent/30 border-b border-border">
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Identity</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Matrix Point</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Indoor Context</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Timestamp</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {visits.map((visit) => (
                                    <tr key={visit.id} className="hover:bg-accent/10 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px]">
                                                    {visit.firstName[0]}{visit.lastName[0]}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-xs">{visit.firstName} {visit.lastName}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono">{visit.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-xs font-medium">
                                                <MapPin className="h-3 w-3 text-primary" />
                                                {visit.locationName}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {visit.indoor ? (
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-purple-400">
                                                        <BuildingIcon className="h-3 w-3" />
                                                        {visit.indoor.building_name}
                                                    </div>
                                                    <div className="text-[8px] font-bold text-muted-foreground uppercase pl-4">
                                                        FL {visit.indoor.level} / {visit.indoor.zone_name}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground italic">Outdoor Location</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-[10px] font-mono whitespace-nowrap">
                                            {format(new Date(visit.timestamp), 'MMM dd | HH:mm:ss')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase border ${visit.isValid ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                {visit.isValid ? 'Verified' : 'Violation'}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : activeTab === 'setup' ? (
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Setup Spatial Hierarchy */}
                    <div className="space-y-6">
                        <div className="bg-card border border-border rounded-3xl p-8 space-y-8 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>

                            <div className="flex items-center gap-3 relative z-10">
                                <div className="p-3 bg-orange-500/10 rounded-2xl">
                                    <Layers className="h-6 w-6 text-orange-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tighter">Matrix Weaver</h3>
                                    <p className="text-[8px] text-muted-foreground font-black tracking-[0.3em] uppercase opacity-50">Physical Hierarchy Constructor</p>
                                </div>
                            </div>

                            <div className="space-y-6 relative z-10">
                                {/* Building Form */}
                                <form onSubmit={handleCreateBuilding} className="p-5 bg-background/50 rounded-2xl border border-border/50 space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-2">01. Register Building</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            required
                                            type="text"
                                            placeholder="Building name"
                                            value={setupBuilding.name}
                                            onChange={e => setSetupBuilding({ ...setupBuilding, name: e.target.value })}
                                            className="col-span-2 bg-accent/30 border border-border rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none focus:border-orange-500/50"
                                        />
                                        <input
                                            required
                                            type="number"
                                            step="any"
                                            placeholder="Lat"
                                            value={setupBuilding.latitude || ''}
                                            onChange={e => setSetupBuilding({ ...setupBuilding, latitude: parseFloat(e.target.value) })}
                                            className="bg-accent/30 border border-border rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none"
                                        />
                                        <input
                                            required
                                            type="number"
                                            step="any"
                                            placeholder="Lng"
                                            value={setupBuilding.longitude || ''}
                                            onChange={e => setSetupBuilding({ ...setupBuilding, longitude: parseFloat(e.target.value) })}
                                            className="bg-accent/30 border border-border rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={getBuildingGPS}
                                            className="col-span-2 flex items-center justify-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-orange-500/20 transition-all"
                                        >
                                            <Navigation className="h-3 w-3" />
                                            Capture Building GPS
                                        </button>
                                    </div>
                                    <button type="submit" className="w-full bg-orange-500 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20">Init building</button>
                                </form>

                                {/* Floor Form */}
                                <form onSubmit={handleCreateFloor} className="p-5 bg-background/50 rounded-2xl border border-border/50 space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-2">02. Add Floor Level</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        <select
                                            required
                                            className="col-span-3 bg-accent/30 border border-border rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none"
                                            value={setupFloor.buildingId}
                                            onChange={e => setSetupFloor({ ...setupFloor, buildingId: e.target.value })}
                                        >
                                            <option value="">Target Building</option>
                                            {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                        <input
                                            required
                                            type="number"
                                            placeholder="LVL"
                                            value={setupFloor.level || ''}
                                            onChange={e => setSetupFloor({ ...setupFloor, level: parseInt(e.target.value) })}
                                            className="bg-accent/30 border border-border rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none"
                                        />
                                        <input
                                            required
                                            type="text"
                                            placeholder="Floor Name"
                                            value={setupFloor.name}
                                            onChange={e => setSetupFloor({ ...setupFloor, name: e.target.value })}
                                            className="col-span-2 bg-accent/30 border border-border rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none"
                                        />
                                    </div>
                                    <button type="submit" className="w-full bg-orange-500 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20">Add Level</button>
                                </form>

                                {/* Zone Form */}
                                <form onSubmit={handleCreateZone} className="p-5 bg-background/50 rounded-2xl border border-border/50 space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-2">03. Define Zone</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            required
                                            className="col-span-2 bg-accent/30 border border-border rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none"
                                            value={setupZone.floorId}
                                            onChange={e => setSetupZone({ ...setupZone, floorId: e.target.value })}
                                        >
                                            <option value="">Target Level</option>
                                            {buildings.flatMap(b => b.floors).map(f => (
                                                <option key={f.id} value={f.id}>{buildings.find(b => b.floors.some(fl => fl.id === f.id))?.name} - {f.name}</option>
                                            ))}
                                        </select>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Zone Name"
                                            value={setupZone.name}
                                            onChange={e => setSetupZone({ ...setupZone, name: e.target.value })}
                                            className="col-span-2 bg-accent/30 border border-border rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none"
                                        />
                                        <select
                                            required
                                            className="bg-accent/30 border border-border rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none"
                                            value={setupZone.type}
                                            onChange={e => setSetupZone({ ...setupZone, type: e.target.value })}
                                        >
                                            <option value="OFFICE">Workspace</option>
                                            <option value="ROOM">Meeting Room</option>
                                            <option value="TRANSIT">Hallway</option>
                                            <option value="ENTRANCE">Entry/Exit</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                        <select
                                            required
                                            className="bg-accent/30 border border-border rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none"
                                            value={setupZone.qrLocationId}
                                            onChange={e => setSetupZone({ ...setupZone, qrLocationId: e.target.value })}
                                        >
                                            <option value="">Link QR</option>
                                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                        <div className="flex gap-1">
                                            <input type="number" placeholder="X%" value={setupZone.x} onChange={e => setSetupZone({ ...setupZone, x: parseInt(e.target.value) })} className="w-full bg-accent/30 border border-border rounded-xl px-2 py-2 text-[10px] font-black outline-none" />
                                            <input type="number" placeholder="Y%" value={setupZone.y} onChange={e => setSetupZone({ ...setupZone, y: parseInt(e.target.value) })} className="w-full bg-accent/30 border border-border rounded-xl px-2 py-2 text-[10px] font-black outline-none" />
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full bg-orange-500 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20">Localize Zone</button>
                                </form>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-card border border-border rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-6 border-dashed min-h-[400px]">
                            <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center border border-primary/20 animate-pulse">
                                <ShieldCheck className="h-12 w-12 text-primary opacity-30" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black uppercase tracking-tighter">API Link Active</h3>
                                <p className="text-[10px] text-muted-foreground max-w-xs mx-auto uppercase font-black leading-relaxed">
                                    The matrix Weaver is directly interfaced with the PostgreSQL core. Any additions made here are reflected globally in the tactical dashboard.
                                </p>
                            </div>

                            <div className="w-full max-w-xs space-y-3">
                                <div className="flex justify-between items-center p-3 bg-accent/20 rounded-xl border border-border/50">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground">Spatial Sync</span>
                                    <span className="text-[10px] font-black uppercase text-green-500">Optimized</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-accent/20 rounded-xl border border-border/50">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground">Tree Depth</span>
                                    <span className="text-[10px] font-black uppercase text-primary">3 Levels</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* SPATIAL MATRIX VIEW */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 bg-card/50 p-1.5 rounded-2xl border border-border/50 backdrop-blur-sm">
                            <button
                                onClick={() => setViewMode('map')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-accent text-muted-foreground'}`}
                            >
                                <MapIcon className="h-4 w-4" />
                                Global Map
                            </button>
                            <button
                                onClick={() => setViewMode('indoor')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'indoor' ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-accent text-muted-foreground'}`}
                            >
                                <BuildingIcon className="h-4 w-4" />
                                Indoor Matrix
                            </button>
                        </div>

                        {viewMode === 'indoor' && (
                            <div className="flex items-center gap-3">
                                <select
                                    className="bg-card border border-border rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                                    value={selectedBuilding?.id || ''}
                                    onChange={(e) => {
                                        const b = buildings.find(b => b.id === e.target.value);
                                        setSelectedBuilding(b || null);
                                        setSelectedFloor(b?.floors[0] || null);
                                    }}
                                >
                                    <option value="">Building Target</option>
                                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>

                                {selectedBuilding && (
                                    <div className="flex gap-1 bg-accent/20 p-1 rounded-xl">
                                        {selectedBuilding.floors.map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => setSelectedFloor(f)}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedFloor?.id === f.id ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-primary/10'}`}
                                            >
                                                L{f.level}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid md:grid-cols-4 gap-6">
                        <div className="md:col-span-1 space-y-4">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Tactical Matrix Assets</h3>
                            {buildings.map(b => {
                                const activeInBuilding = visits.filter(v => v.isValid && v.indoor?.building_name === b.name).length;
                                return (
                                    <div
                                        key={b.id}
                                        onClick={() => {
                                            setSelectedBuilding(b);
                                            setSelectedFloor(b.floors[0]);
                                            setViewMode('indoor');
                                        }}
                                        className={`p-4 rounded-2xl border transition-all cursor-pointer group ${selectedBuilding?.id === b.id ? 'bg-primary/5 border-primary shadow-lg shadow-primary/5' : 'bg-card/50 border-border hover:border-primary/50'}`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="p-2 bg-primary/10 rounded-lg group-hover:scale-110 transition-transform">
                                                <BuildingIcon className="h-4 w-4 text-primary" />
                                            </div>
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${activeInBuilding > 0 ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                                                {activeInBuilding} ACTIVE
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-sm tracking-tight">{b.name}</h4>
                                        <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest mt-1">{b.floors.length} Levels • {b.floors.reduce((acc, f) => acc + f.zones.length, 0)} Zones</p>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="md:col-span-3">
                            {viewMode === 'map' ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-full animate-bounce">
                                                <MapPin className="h-4 w-4 text-primary" />
                                            </div>
                                            <p className="text-xs font-bold uppercase tracking-widest text-primary">Global Tracking Mode</p>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground font-mono">ENCRYPTED STREAM: LIVE</div>
                                    </div>
                                    <QRMapVisualization locations={locations} visits={visits} />
                                </div>
                            ) : (
                                <div className="bg-card border border-border rounded-[2.5rem] p-8 h-[550px] flex flex-col items-center justify-center relative overflow-hidden group">
                                    {!selectedBuilding ? (
                                        <div className="text-center space-y-4">
                                            <div className="w-20 h-20 bg-accent/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                                <Layout className="h-10 w-10 text-muted-foreground opacity-30" />
                                            </div>
                                            <h3 className="text-xl font-bold uppercase tracking-widest opacity-50">Select Asset to Initiate Matrix</h3>
                                            <p className="text-[10px] text-muted-foreground max-w-xs mx-auto uppercase font-black leading-relaxed">Indoor mode provides granular floor-level visualization of presence and unauthorized movement.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="absolute top-8 left-8 z-20">
                                                <h3 className="text-2xl font-black uppercase tracking-tighter text-primary">{selectedBuilding.name}</h3>
                                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{selectedFloor?.name || 'Monitoring...'}</p>
                                            </div>

                                            <div className="relative w-full h-full mt-16 bg-black/20 rounded-[3rem] border border-border/50 flex items-center justify-center overflow-hidden shadow-2xl">
                                                {/* Map Grid Background */}
                                                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_2px,transparent_2px),linear-gradient(to_bottom,#80808012_2px,transparent_2px)] bg-[size:40px_40px]"></div>

                                                {selectedFloor?.zones.map(zone => {
                                                    const usersInZone = visits.filter(v => v.isValid && v.indoor?.zone_name === zone.name).length;
                                                    return (
                                                        <div
                                                            key={zone.id}
                                                            className="absolute group transition-all duration-700"
                                                            style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
                                                        >
                                                            <div className={`p-5 rounded-2xl border-2 transition-all shadow-2xl flex flex-col items-center gap-2 ${usersInZone > 0 ? 'bg-primary/20 border-primary shadow-primary/40 scale-125 z-10' : 'bg-card/40 border-border/50 opacity-40 hover:opacity-100 hover:scale-110'}`}>
                                                                <div className="relative">
                                                                    <Layers className={`h-5 w-5 ${usersInZone > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                                                                    {usersInZone > 0 && <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-ping"></div>}
                                                                </div>
                                                                <span className="text-[10px] font-black uppercase tracking-tighter text-foreground">{zone.name}</span>
                                                                {usersInZone > 0 && (
                                                                    <div className="px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-[8px] font-black">
                                                                        {usersInZone} ACT
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Tactical Navigation HUD */}
                                                <div className="absolute top-4 right-8 flex flex-col items-end gap-2 z-20">
                                                    <div className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Signal Strength</div>
                                                    <div className="flex gap-0.5">
                                                        {[1, 2, 3, 4, 5].map(i => <div key={i} className={`w-1 h-4 rounded-full ${i < 5 ? 'bg-primary' : 'bg-muted'}`}></div>)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="absolute bottom-8 left-8 flex items-center gap-6 z-20">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-3 w-3 rounded-full bg-primary shadow-lg shadow-primary/50"></div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Detected Zone</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-3 w-3 rounded-full bg-muted"></div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Standby</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Deletion Modal */}
            {isDeleting && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => setIsDeleting(null)}></div>
                    <div className="bg-card border border-border rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                                <AlertTriangle className="h-8 w-8 text-red-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold uppercase tracking-widest text-foreground">Purge Identity?</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                    You are about to permanently delete this spatial node. All historical tracking data for this point will be wiped from the matrix.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 w-full pt-4">
                                <button
                                    onClick={() => setIsDeleting(null)}
                                    className="px-4 py-3 rounded-2xl bg-secondary text-secondary-foreground font-bold text-[10px] uppercase tracking-widest hover:bg-accent transition-all"
                                >
                                    Abort
                                </button>
                                <button
                                    onClick={() => handleDeleteLocation(isDeleting)}
                                    className="px-4 py-3 rounded-2xl bg-red-500 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                                >
                                    Confirm Purge
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsDeleting(null)}
                            className="absolute top-4 right-4 p-2 text-muted-foreground/50 hover:text-foreground transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
