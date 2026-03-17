'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
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
    Layout,
    Database
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
    const router = useRouter();
    const [locations, setLocations] = useState<QRLocation[]>([]);
    const [visits, setVisits] = useState<QRVisit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [activeTab, setActiveTab] = useState<'locations' | 'history' | 'spatial' | 'setup'>('locations');
    const [viewMode, setViewMode] = useState<'map' | 'indoor'>('map');
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
    const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                const role = decoded.user.role?.toUpperCase();
                setUserRole(role);
                if (role !== 'ADMIN') {
                    router.push('/dashboard/qr/scan');
                }
            } catch (e) {
                console.error('Failed to decode token', e);
                router.push('/');
            }
        } else {
            router.push('/');
        }
    }, [router]);

    const [newLoc, setNewLoc] = useState({
        name: '',
        latitude: 0,
        longitude: 0,
        radius: 50
    });

    const [showAddModal, setShowAddModal] = useState(false);
    const [setupStep, setSetupStep] = useState<'building' | 'floor' | 'zone'>('building');

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
                        Activity Logs
                    </button>
                    <button
                        onClick={() => setActiveTab('spatial')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'spatial' ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-accent'}`}
                    >
                        <Layout className="h-4 w-4" />
                        Live Monitor
                    </button>
                    <button
                        onClick={() => setActiveTab('setup')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'setup' ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-accent'}`}
                    >
                        <ShieldCheck className="h-4 w-4" />
                        Infrastructure Setup
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
                        <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Positions</div>
                        <div className="text-2xl font-bold">{locations.length}</div>
                    </div>
                </div>
                <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-4 transition-all hover:shadow-lg">
                    <div className="p-3 bg-green-500/10 rounded-xl">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                        <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total Scans</div>
                        <div className="text-2xl font-bold">{visits.length}</div>
                    </div>
                </div>
                <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-4 transition-all hover:shadow-lg">
                    <div className="p-3 bg-orange-500/10 rounded-xl">
                        <Zap className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                        <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Accuracy</div>
                        <div className="text-2xl font-bold">
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
                        <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Buildings</div>
                        <div className="text-2xl font-bold">{buildings.length}</div>
                    </div>
                </div>
            </div>

            {activeTab === 'locations' ? (
                <div className="space-y-8">
                    {/* Live Map Visualization */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-primary animate-pulse" />
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Real-time Location View</h2>
                            </div>
                            <button 
                                onClick={() => setShowAddModal(true)}
                                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-primary/20 transition-all active:scale-95"
                            >
                                <Plus className="h-3 w-3" />
                                Add New Location
                            </button>
                        </div>
                        <QRMapVisualization locations={locations} visits={visits} />
                    </div>

                    {/* Locations List Table */}
                    <div className="bg-card border border-border rounded-3xl shadow-2xl overflow-hidden backdrop-blur-md">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-accent/10">
                            <div>
                                <h3 className="font-bold uppercase tracking-tight text-lg">Location Registry</h3>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">Configured QR access points</p>
                            </div>
                            <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                                <span className="text-[10px] font-bold text-primary uppercase">{locations.length} Registered Areas</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-accent/30 border-b border-border">
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Location Name</th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Geo Coordinates</th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">QR Code</th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date Registered</th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {locations.map((loc) => (
                                        <tr key={loc.id} className="hover:bg-accent/10 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary group-hover:text-white transition-all">
                                                        <MapPin className="h-4 w-4" />
                                                    </div>
                                                    <div className="font-black text-xs uppercase tracking-tight">{loc.name}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-blue-400">
                                                        <span className="opacity-30">LAT //</span> {loc.latitude.toFixed(6)}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-blue-400">
                                                        <span className="opacity-30">LNG //</span> {loc.longitude.toFixed(6)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="relative group/qr">
                                                    <div className="bg-white p-1 rounded-lg border border-border group-hover:scale-150 transition-transform origin-left z-20 relative">
                                                        <QRCodeSVG id={`qr-${loc.id}`} value={loc.id} size={32} level="M" />
                                                    </div>
                                                    <div className="hidden group-hover/qr:block absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-card border border-border p-2 rounded-xl shadow-2xl z-30">
                                                        <QRCodeSVG value={loc.id} size={150} level="H" />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-[10px] font-mono font-bold text-muted-foreground">
                                                {format(new Date(loc.createdAt), 'yyyy.MM.dd | HH:mm')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => downloadQR(loc.id, loc.name)}
                                                        className="p-2 bg-secondary/50 hover:bg-primary hover:text-white rounded-lg transition-all border border-border/50 shadow-sm"
                                                        title="Download PNG"
                                                    >
                                                        <Download className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setIsDeleting(loc.id);
                                                            handleDeleteLocation(loc.id);
                                                        }}
                                                        className="p-2 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 rounded-lg transition-all border border-red-500/20 shadow-sm"
                                                        title="Decommission Node"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {locations.length === 0 && (
                                            <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground font-black uppercase tracking-widest text-[10px]">
                                                No locations found in registry
                                            </td>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'history' ? (
                <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-accent/30 border-b border-border">
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">User Info</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Location Name</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Indoor Details</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Time Recorded</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Verification</th>
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
                                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase border ${visit.isValid ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
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
                <div className="grid md:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Constructor Sidebar - Navigation */}
                    <div className="md:col-span-3 space-y-4">
                        <div className="bg-card border border-border rounded-[2rem] p-4 shadow-xl backdrop-blur-md">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 mb-4 mt-2">Configuration Wizard</h3>
                            <div className="space-y-2">
                                {[
                                    { id: 'building', label: '01. Building Registry', icon: BuildingIcon, desc: 'Register Building' },
                                    { id: 'floor', label: '02. Floor Management', icon: Layers, desc: 'Add/Edit Floors' },
                                    { id: 'zone', label: '03. Area Configuration', icon: MapIcon, desc: 'Define Zones' }
                                ].map((step) => (
                                    <button
                                        key={step.id}
                                        onClick={() => setSetupStep(step.id as any)}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${
                                            setupStep === step.id 
                                                ? 'bg-primary border-primary shadow-lg shadow-primary/20 text-white' 
                                                : 'bg-accent/10 border-transparent hover:bg-accent/20 text-muted-foreground'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-xl ${setupStep === step.id ? 'bg-white/20' : 'bg-background'}`}>
                                            <step.icon className="h-4 w-4" />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-[9px] font-black uppercase tracking-widest leading-none mb-1 opacity-70">{step.label}</div>
                                            <div className="text-xs font-bold leading-none">{step.desc}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Quick Stats Node */}
                        <div className="bg-primary/5 border border-primary/20 rounded-[2rem] p-6 space-y-4">
                            <div className="flex items-center gap-2 text-primary">
                                <Activity className="h-3 w-3 animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Active Schema</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <div className="text-2xl font-black">{buildings.length}</div>
                                    <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Buildings</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-2xl font-black">{buildings.flatMap(b => b.floors).length}</div>
                                    <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Levels</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Active Form - Step Content */}
                    <div className="md:col-span-5">
                        <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden h-full min-h-[500px] flex flex-col">
                            {/* Form Header */}
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-primary/10 rounded-3xl">
                                    {setupStep === 'building' && <BuildingIcon className="h-6 w-6 text-primary" />}
                                    {setupStep === 'floor' && <Layers className="h-6 w-6 text-primary" />}
                                    {setupStep === 'zone' && <MapIcon className="h-6 w-6 text-primary" />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold uppercase tracking-tight">
                                        {setupStep === 'building' ? 'Building Information' : setupStep === 'floor' ? 'Floor Configuration' : 'Zone Definition'}
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase opacity-70">
                                        {setupStep === 'building' ? 'Core structural registration' : setupStep === 'floor' ? 'Define vertical levels within building' : 'Detailed zone linking and positioning'}
                                    </p>
                                </div>
                            </div>

                            {/* Dynamic Step Forms */}
                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                {setupStep === 'building' && (
                                    <form onSubmit={handleCreateBuilding} className="space-y-6">
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Building Asset Code</label>
                                                <input
                                                    required
                                                    type="text"
                                                    placeholder="Main Headquarters"
                                                    value={setupBuilding.name}
                                                    onChange={e => setSetupBuilding({ ...setupBuilding, name: e.target.value })}
                                                    className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Latitude Vector</label>
                                                    <input
                                                        required
                                                        type="number"
                                                        step="any"
                                                        placeholder="0.000000"
                                                        value={setupBuilding.latitude || ''}
                                                        onChange={e => setSetupBuilding({ ...setupBuilding, latitude: parseFloat(e.target.value) })}
                                                        className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Longitude Vector</label>
                                                    <input
                                                        required
                                                        type="number"
                                                        step="any"
                                                        placeholder="0.000000"
                                                        value={setupBuilding.longitude || ''}
                                                        onChange={e => setSetupBuilding({ ...setupBuilding, longitude: parseFloat(e.target.value) })}
                                                        className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={getBuildingGPS}
                                                className="w-full flex items-center justify-center gap-2 bg-secondary/50 hover:bg-secondary text-secondary-foreground py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-border/50 transition-all"
                                            >
                                                <Navigation className="h-4 w-4" />
                                                Sync Building GPS
                                            </button>
                                        </div>
                                        <button type="submit" className="w-full bg-primary text-white py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] hover:bg-primary/90 transition-all shadow-2xl shadow-primary/20">
                                            Save Building
                                        </button>
                                    </form>
                                )}

                                {setupStep === 'floor' && (
                                    <form onSubmit={handleCreateFloor} className="space-y-6">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Target Asset</label>
                                            <select
                                                required
                                                className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                                                value={setupFloor.buildingId}
                                                onChange={e => setSetupFloor({ ...setupFloor, buildingId: e.target.value })}
                                            >
                                                <option value="">Select Building</option>
                                                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-4 gap-4">
                                            <div className="col-span-1 space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">LVL</label>
                                                <input
                                                    required
                                                    type="number"
                                                    placeholder="0"
                                                    value={setupFloor.level || ''}
                                                    onChange={e => setSetupFloor({ ...setupFloor, level: parseInt(e.target.value) })}
                                                    className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 text-xs font-black outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                />
                                            </div>
                                            <div className="col-span-3 space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Level Alias</label>
                                                <input
                                                    required
                                                    type="text"
                                                    placeholder="Lobby / Penthouse"
                                                    value={setupFloor.name}
                                                    onChange={e => setSetupFloor({ ...setupFloor, name: e.target.value })}
                                                    className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                />
                                            </div>
                                        </div>
                                        <button type="submit" className="w-full bg-primary text-white py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] hover:bg-primary/90 transition-all shadow-2xl shadow-primary/20 mt-4">
                                            Deploy Level
                                        </button>
                                    </form>
                                )}

                                {setupStep === 'zone' && (
                                    <form onSubmit={handleCreateZone} className="space-y-6">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Vertical Node</label>
                                            <select
                                                required
                                                className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                                                value={setupZone.floorId}
                                                onChange={e => setSetupZone({ ...setupZone, floorId: e.target.value })}
                                            >
                                                <option value="">Select Level</option>
                                                {buildings.flatMap(b => b.floors).map(f => (
                                                    <option key={f.id} value={f.id}>{buildings.find(b => b.floors.some(fl => fl.id === f.id))?.name} — {f.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Sector Label</label>
                                            <input
                                                required
                                                type="text"
                                                placeholder="Security Hub / R&D Zone"
                                                value={setupZone.name}
                                                onChange={e => setSetupZone({ ...setupZone, name: e.target.value })}
                                                className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Sector Typology</label>
                                                <select
                                                    required
                                                    className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                                                    value={setupZone.type}
                                                    onChange={e => setSetupZone({ ...setupZone, type: e.target.value })}
                                                >
                                                    <option value="OFFICE">Workspace</option>
                                                    <option value="ROOM">Meeting Point</option>
                                                    <option value="TRANSIT">Transition Corridor</option>
                                                    <option value="ENTRANCE">Access Point</option>
                                                    <option value="OTHER">Generic Zone</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">QR Signal Link</label>
                                                <select
                                                    required
                                                    className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                                                    value={setupZone.qrLocationId}
                                                    onChange={e => setSetupZone({ ...setupZone, qrLocationId: e.target.value })}
                                                >
                                                    <option value="">Link Marker</option>
                                                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Localization Offset (X% / Y%)</label>
                                            <div className="flex gap-4">
                                                <input type="number" placeholder="X-Pos" value={setupZone.x} onChange={e => setSetupZone({ ...setupZone, x: parseInt(e.target.value) })} className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                                                <input type="number" placeholder="Y-Pos" value={setupZone.y} onChange={e => setSetupZone({ ...setupZone, y: parseInt(e.target.value) })} className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                                            </div>
                                        </div>
                                        <button type="submit" className="w-full bg-primary text-white py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] hover:bg-primary/90 transition-all shadow-2xl shadow-primary/20 mt-4">
                                            Save Zone Configuration
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Hierarchy Explorer - Visualization */}
                    <div className="md:col-span-4">
                        <div className="bg-card/50 border border-border rounded-[2.5rem] p-8 h-full shadow-xl flex flex-col backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Infrastructure Overview</h3>
                                <div className="bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
                                    <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">LIVE DATA</span>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                                {buildings.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-6">
                                        <div className="p-6 bg-accent/20 rounded-full mb-4">
                                            <Database className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-widest">Registry Empty</p>
                                        <p className="text-[8px] font-bold uppercase mt-2">Start by registering a building</p>
                                    </div>
                                ) : (
                                    buildings.map((b) => (
                                        <div key={b.id} className="space-y-3">
                                            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-2xl">
                                                <BuildingIcon className="h-3.5 w-3.5 text-primary" />
                                                <span className="text-[10px] font-bold uppercase">{b.name}</span>
                                            </div>
                                            <div className="pl-6 space-y-3 border-l border-border/50 ml-4.5">
                                                {b.floors.map((f) => (
                                                    <div key={f.id} className="space-y-2">
                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                            <div className="w-2 h-[1px] bg-border/50"></div>
                                                            <Layers className="h-3 w-3" />
                                                            <span className="text-[9px] font-semibold uppercase">LVL {f.level}: {f.name}</span>
                                                        </div>
                                                        <div className="pl-6 flex flex-wrap gap-2">
                                                            {f.zones.map((z) => (
                                                                <div key={z.id} className="px-2 py-1 bg-accent/30 border border-border rounded-lg text-[8px] font-bold uppercase tracking-tighter hover:border-primary transition-colors cursor-default">
                                                                    {z.name}
                                                                </div>
                                                            ))}
                                                            {f.zones.length === 0 && (
                                                                <span className="text-[7px] font-bold text-muted-foreground/30 uppercase italic">No Areas</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                {b.floors.length === 0 && (
                                                    <div className="text-[7px] font-bold text-muted-foreground/30 uppercase italic pl-4">No Levels Defined</div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* SPATIAL MATRIX VIEW */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-4 bg-card/50 p-1.5 rounded-2xl border border-border/50 backdrop-blur-sm shadow-xl">
                            <button
                                onClick={() => setViewMode('map')}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'map' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'hover:bg-accent text-muted-foreground opacity-60'}`}
                            >
                                <MapIcon className="h-3.5 w-3.5" />
                                Global Map
                            </button>
                            <button
                                onClick={() => setViewMode('indoor')}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'indoor' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'hover:bg-accent text-muted-foreground opacity-60'}`}
                            >
                                <BuildingIcon className="h-3.5 w-3.5" />
                                Indoor Tracking
                            </button>
                        </div>

                        {viewMode === 'indoor' && selectedBuilding && (
                            <div className="flex items-center gap-4 bg-primary/5 border border-primary/20 px-6 py-2.5 rounded-2xl animate-in fade-in zoom-in-95 duration-500">
                                <div className="flex flex-col items-end">
                                    <h4 className="text-xs font-bold uppercase tracking-wider leading-none">{selectedBuilding.name}</h4>
                                    <p className="text-[8px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">Live Asset Monitoring: Active</p>
                                </div>
                                <div className="h-8 w-[1px] bg-primary/20 mx-2"></div>
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <Activity className="h-4 w-4 text-primary animate-pulse" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid md:grid-cols-4 gap-6">
                        <div className="md:col-span-1 space-y-4">
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">Property Directory</h3>
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
                                            <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${activeInBuilding > 0 ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                                                {activeInBuilding} ACTIVE
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-sm tracking-tight">{b.name}</h4>
                                        <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider mt-1">{b.floors.length} Floors • {b.floors.reduce((acc, f) => acc + f.zones.length, 0)} Areas</p>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="md:col-span-3">
                            {viewMode === 'map' ? (
                                <div className="space-y-4">
                                    <div className="p-5 bg-card border border-border rounded-3xl flex items-center justify-between shadow-xl">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-primary/10 rounded-2xl">
                                                <MapPin className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold uppercase tracking-wider">Global Monitoring Grid</p>
                                                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">External Asset Feed: Live</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                                            <span className="text-[10px] font-mono text-muted-foreground uppercase">Sync Protocol: Secure</span>
                                        </div>
                                    </div>
                                    <QRMapVisualization locations={locations} visits={visits} />
                                </div>
                            ) : (
                                <div className="bg-card border border-border rounded-[3rem] p-4 h-[600px] flex gap-4 relative overflow-hidden group shadow-2xl">
                                    {!selectedBuilding ? (
                                        <div className="w-full flex flex-col items-center justify-center text-center space-y-4">
                                            <div className="w-24 h-24 bg-accent/30 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 transform rotate-3">
                                                <BuildingIcon className="h-12 w-12 text-muted-foreground opacity-20" />
                                            </div>
                                            <h3 className="text-2xl font-bold uppercase tracking-wider opacity-30">Select Building</h3>
                                            <p className="text-[10px] text-muted-foreground max-w-xs mx-auto uppercase font-semibold tracking-wider leading-relaxed opacity-50">Choose a building from the directory to start tracking.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* BUILDING SCHEMATIC NAVIGATOR - "The Building" */}
                                            <div className="w-48 h-full bg-accent/20 rounded-[2.5rem] border border-border/50 flex flex-col p-4 shadow-inner">
                                                <div className="mb-4 px-2">
                                                    <h5 className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-1">Structural Node</h5>
                                                    <div className="text-[10px] font-black uppercase truncate">{selectedBuilding.name}</div>
                                                </div>
                                                
                                                <div className="flex-1 flex flex-col-reverse gap-2 overflow-y-auto custom-scrollbar pr-1">
                                                    {selectedBuilding.floors.sort((a, b) => a.level - b.level).map((f) => {
                                                        const activeOnFloor = visits.filter(v => v.isValid && v.indoor?.building_name === selectedBuilding.name && v.indoor?.level === f.level).length;
                                                        const isSelected = selectedFloor?.id === f.id;
                                                        
                                                        return (
                                                            <button
                                                                key={f.id}
                                                                onClick={() => setSelectedFloor(f)}
                                                                className={`relative group h-16 w-full rounded-2xl transition-all duration-500 border overflow-hidden ${
                                                                    isSelected 
                                                                        ? 'bg-primary border-primary shadow-lg shadow-primary/30 z-10' 
                                                                        : 'bg-card border-border/50 hover:bg-accent/40'
                                                                }`}
                                                            >
                                                                {/* Floor "Cross-section" look */}
                                                                <div className={`absolute inset-0 opacity-10 ${isSelected ? 'bg-white' : 'bg-primary'}`}>
                                                                    <div className="absolute inset-x-0 bottom-0 h-[2px] bg-current opacity-30"></div>
                                                                    <div className="absolute inset-y-0 right-0 w-[1px] bg-current opacity-20"></div>
                                                                </div>
                                                                
                                                                <div className="relative h-full flex items-center px-4 gap-3">
                                                                    <div className={`flex items-center justify-center w-8 h-8 rounded-xl text-[10px] font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                                                                        L{f.level}
                                                                    </div>
                                                                    <div className="text-left">
                                                                        <div className={`text-[9px] font-bold uppercase tracking-tight leading-none ${isSelected ? 'text-white' : 'text-foreground'}`}>
                                                                            {f.name}
                                                                        </div>
                                                                        {activeOnFloor > 0 && (
                                                                            <div className={`text-[7px] font-bold uppercase mt-1 flex items-center gap-1 ${isSelected ? 'text-white/80' : 'text-green-500'}`}>
                                                                                <div className="h-1 w-1 rounded-full bg-current animate-pulse"></div>
                                                                                {activeOnFloor} Signal
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                
                                                                {/* Hover highlight line */}
                                                                <div className={`absolute left-0 inset-y-0 w-1 bg-white transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}></div>
                                                            </button>
                                                        );
                                                    })}
                                                    {/* Ground Foundation */}
                                                    <div className="h-4 w-full bg-muted/40 rounded-xl border border-dashed border-border/30 flex items-center justify-center">
                                                        <div className="w-12 h-[1px] bg-border/20"></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ZONE MAP DISPLAY */}
                                            <div className="flex-1 relative bg-black/40 rounded-[2.5rem] border border-border/50 overflow-hidden flex items-center justify-center shadow-2xl">
                                                {/* Tactical HUD Header */}
                                                <div className="absolute top-6 left-8 z-20 flex items-center gap-4">
                                                    <div className="p-3 bg-primary/20 backdrop-blur-md rounded-2xl border border-primary/30">
                                                        <Layers className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-bold uppercase tracking-tight text-white">{selectedFloor?.name || 'Monitoring...'}</h3>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></div>
                                                            <span className="text-[8px] font-semibold uppercase tracking-wider text-primary/70">Indoor Asset Location Feed</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Map Grid Background */}
                                                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_2px,transparent_2px),linear-gradient(to_bottom,#80808012_2px,transparent_2px)] bg-[size:50px_50px]"></div>
                                                
                                                {/* Zone Nodes */}
                                                <div className="relative w-full h-full p-20">
                                                    {selectedFloor?.zones.map(zone => {
                                                        const usersInZone = visits.filter(v => v.isValid && v.indoor?.zone_name === zone.name).length;
                                                        return (
                                                            <div
                                                                key={zone.id}
                                                                className="absolute group transition-all duration-700 transform hover:-translate-y-1"
                                                                style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
                                                            >
                                                                <div className={`p-6 rounded-3xl border-2 transition-all shadow-2xl flex flex-col items-center gap-3 backdrop-blur-md ${usersInZone > 0 ? 'bg-primary/20 border-primary shadow-primary/30 scale-110 z-10' : 'bg-card/30 border-border/30 opacity-40 hover:opacity-100 hover:scale-105'}`}>
                                                                    <div className="relative p-2 bg-background/50 rounded-xl">
                                                                        <Smartphone className={`h-5 w-5 ${usersInZone > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                                                                        {usersInZone > 0 && <div className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-background animate-ping"></div>}
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-foreground block">{zone.name}</span>
                                                                        <span className="text-[7px] text-muted-foreground uppercase font-semibold">{zone.type}</span>
                                                                    </div>
                                                                    {usersInZone > 0 && (
                                                                        <div className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-[8px] font-bold">
                                                                            {usersInZone} STAFF PRESENT
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* HUD Diagnostics */}
                                                <div className="absolute bottom-8 right-8 flex flex-col items-end gap-3 z-20">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Update Frequency</span>
                                                        <span className="text-[10px] font-mono font-bold text-primary">Live (5s)</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 h-1 px-3 bg-accent/20 rounded-full w-24">
                                                        <div className="h-full bg-primary rounded-full w-4/5"></div>
                                                    </div>
                                                </div>

                                                <div className="absolute bottom-8 left-8 flex items-center gap-8 z-20 bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 shadow-2xl">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-3 w-3 rounded-full bg-primary shadow-lg shadow-primary/50 animate-pulse"></div>
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Occupied Zone</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-3 w-3 rounded-full bg-white/10"></div>
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Empty Zone</span>
                                                    </div>
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
                                <h3 className="text-xl font-bold uppercase tracking-wider text-foreground">Remove Location?</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                    You are about to permanently delete this registry entry. All historical tracking data for this point will be archived.
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

            {/* Modal for Adding QR Point */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddModal(false)}></div>
                    <div className="bg-card border border-border w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Glow Effect */}
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
                        
                        <div className="p-8 space-y-8 relative z-10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-primary/10 rounded-2xl">
                                        <QrCode className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold uppercase tracking-tight">Add New Area</h3>
                                        <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase opacity-50">Operational Registry Access</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowAddModal(false)}
                                    className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-white"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={(e) => {
                                handleCreateLocation(e);
                                setShowAddModal(false);
                            }} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Location Name</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Main Office"
                                        className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold uppercase tracking-wider text-xs"
                                        value={newLoc.name}
                                        onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Latitude</label>
                                        <input
                                            required
                                            type="number"
                                            step="any"
                                            className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-xs font-bold"
                                            value={newLoc.latitude}
                                            onChange={(e) => setNewLoc({ ...newLoc, latitude: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Longitude</label>
                                        <input
                                            required
                                            type="number"
                                            step="any"
                                            className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-xs font-bold"
                                            value={newLoc.longitude}
                                            onChange={(e) => setNewLoc({ ...newLoc, longitude: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={getCurrentLocation}
                                        className="flex-1 flex items-center justify-center gap-3 bg-secondary/50 hover:bg-secondary text-secondary-foreground py-4 rounded-2xl transition-all font-bold text-[10px] uppercase tracking-wider border border-border/50"
                                    >
                                        <Navigation className="h-4 w-4" />
                                        Sync GPS
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isCreating}
                                        className="flex-[2] flex items-center justify-center gap-3 bg-primary hover:bg-primary/90 text-primary-foreground py-4 rounded-2xl transition-all shadow-2xl shadow-primary/20 font-bold text-[10px] uppercase tracking-wider disabled:opacity-50"
                                    >
                                        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                        Create Location
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
