'use client';

import { useMemo } from 'react';
import { MapPin, User, Search } from 'lucide-react';

interface QRLocation {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
}

interface QRVisit {
    id: string;
    userLat: number;
    userLng: number;
    firstName: string;
    lastName: string;
    locationName: string;
    isValid: boolean;
}

export function QRMapVisualization({ locations, visits }: { locations: QRLocation[], visits: QRVisit[] }) {
    // We normalize coordinates to fit into an SVG grid
    const bounds = useMemo(() => {
        if (locations.length === 0) return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
        
        const lats = locations.map(l => l.latitude);
        const lngs = locations.map(l => l.longitude);
        
        return {
            minLat: Math.min(...lats) - 0.01,
            maxLat: Math.max(...lats) + 0.01,
            minLng: Math.min(...lngs) - 0.01,
            maxLng: Math.max(...lngs) + 0.01
        };
    }, [locations]);

    const project = (lat: number, lng: number) => {
        const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
        const y = 100 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;
        return { x: `${x}%`, y: `${y}%` };
    };

    return (
        <div className="relative w-full h-[400px] bg-card/30 border border-border rounded-3xl overflow-hidden backdrop-blur-xl">
            {/* Map Grid Background */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
            
            {/* Admin Controls Overlay */}
            <div className="absolute top-4 left-4 z-10 space-y-2">
                <div className="flex items-center gap-2 bg-background/80 backdrop-blur-md border border-border px-3 py-1.5 rounded-full shadow-lg">
                    <Search className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Live Tracking Active</span>
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
                </div>
            </div>

            {/* Connection Lines (Optional visualization of movement) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
                {/* SVG lines could be added here to show most frequent paths */}
            </svg>

            {/* Location Markers */}
            {locations.map(loc => {
                const pos = project(loc.latitude, loc.longitude);
                return (
                    <div 
                        key={loc.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                        style={{ left: pos.x, top: pos.y }}
                    >
                        <div className="relative">
                            <div className="absolute -inset-4 bg-primary/20 rounded-full animate-ping opacity-20"></div>
                            <div className="bg-primary text-white p-2 rounded-xl shadow-xl shadow-primary/20 relative z-10">
                                <MapPin className="h-5 w-5" />
                            </div>
                            
                            {/* Label */}
                            <div className="absolute top-FULL mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-card border border-border px-3 py-1 rounded-lg text-[10px] font-bold shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                {loc.name}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* User Presence (Live-ish) */}
            {visits.slice(0, 10).map(visit => {
                const pos = project(visit.userLat, visit.userLng);
                return (
                    <div 
                        key={visit.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 group transition-all duration-1000"
                        style={{ left: pos.x, top: pos.y }}
                    >
                        <div className="relative">
                            <div className={`p-1.5 rounded-full border-2 ${visit.isValid ? 'bg-green-500/20 border-green-500' : 'bg-red-500/20 border-red-500'} shadow-lg backdrop-blur-sm`}>
                                <User className={`h-3 w-3 ${visit.isValid ? 'text-green-400' : 'text-red-400'}`} />
                            </div>
                            
                            {/* Floating User Name */}
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-background/90 text-foreground px-2 py-0.5 rounded text-[8px] font-medium shadow-sm border border-border">
                                {visit.firstName}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Legend */}
            <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur-md border border-border p-3 rounded-2xl shadow-xl space-y-2">
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-primary"></div>
                    <span className="text-[10px] font-medium">QR Point</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full border-2 border-green-500 bg-green-500/20"></div>
                    <span className="text-[10px] font-medium">Verified User</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full border-2 border-red-500 bg-red-500/20"></div>
                    <span className="text-[10px] font-medium">Out of Range</span>
                </div>
            </div>
        </div>
    );
}
