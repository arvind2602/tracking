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
        const displayedVisits = visits.slice(0, 10);
        const lats = [
            ...locations.map(l => l.latitude),
            ...displayedVisits.map(v => v.userLat)
        ];
        const lngs = [
            ...locations.map(l => l.longitude),
            ...displayedVisits.map(v => v.userLng)
        ];

        if (lats.length === 0) return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };

        const minLatRaw = Math.min(...lats);
        const maxLatRaw = Math.max(...lats);
        const minLngRaw = Math.min(...lngs);
        const maxLngRaw = Math.max(...lngs);

        const latDiff = maxLatRaw - minLatRaw;
        const lngDiff = maxLngRaw - minLngRaw;

        // Apply dynamic padding (15% of the range, with a minimum fallback for single points)
        const latPadding = latDiff === 0 ? 0.005 : latDiff * 0.15;
        const lngPadding = lngDiff === 0 ? 0.005 : lngDiff * 0.15;

        return {
            minLat: minLatRaw - latPadding,
            maxLat: maxLatRaw + latPadding,
            minLng: minLngRaw - lngPadding,
            maxLng: maxLngRaw + lngPadding
        };
    }, [locations, visits]);

    const project = (lat: number, lng: number) => {
        const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
        const y = 100 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;
        return { x: `${x}%`, y: `${y}%` };
    };

    return (
        <div className="relative w-full h-[500px] bg-[#020617] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
            {/* Advanced Spatial Grid background */}
            <div className="absolute inset-0 opacity-[0.15]" 
                 style={{ 
                     backgroundImage: `
                        linear-gradient(to right, #3b82f6 1px, transparent 1px),
                        linear-gradient(to bottom, #3b82f6 1px, transparent 1px)
                     `,
                     backgroundSize: '40px 40px'
                 }}>
            </div>
            <div className="absolute inset-0 opacity-[0.05]" 
                 style={{ 
                     backgroundImage: `
                        linear-gradient(to right, #3b82f6 1px, transparent 1px),
                        linear-gradient(to bottom, #3b82f6 1px, transparent 1px)
                     `,
                     backgroundSize: '8px 8px'
                 }}>
            </div>
            
            {/* Vignette effect */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.8)_100%)] pointer-events-none"></div>

            {/* Scanning line effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="w-full h-[150%] bg-gradient-to-b from-transparent via-blue-500/10 to-transparent -translate-y-full animate-[scan_8s_linear_infinite]"></div>
            </div>
            
            {/* Header Overlay */}
            <div className="absolute top-6 left-6 z-20 flex flex-col gap-2">
                <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl shadow-2xl">
                    <div className="relative flex items-center justify-center">
                        <div className="absolute h-3 w-3 rounded-full bg-blue-500 animate-ping opacity-50"></div>
                        <div className="h-2 w-2 rounded-full bg-blue-500 relative z-10"></div>
                    </div>
                    <span className="text-[10px] uppercase font-black tracking-[0.2em] text-blue-400">Tactical Synchronization</span>
                </div>
                <div className="flex items-center gap-2 px-2">
                    <div className="h-1 w-12 bg-blue-500/30 rounded-full overflow-hidden">
                        <div className="h-full w-2/3 bg-blue-500 animate-[loading_2s_ease-in-out_infinite]"></div>
                    </div>
                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Signal: Optimal</span>
                </div>
            </div>

            {/* Spatial Markers */}
            <div className="absolute inset-0">
                {locations.map(loc => {
                    const pos = project(loc.latitude, loc.longitude);
                    return (
                        <div 
                            key={loc.id}
                            className="absolute -translate-x-1/2 -translate-y-1/2 group transition-all duration-700"
                            style={{ left: pos.x, top: pos.y }}
                        >
                            <div className="relative cursor-pointer">
                                {/* Beacon rings */}
                                <div className="absolute -inset-8 bg-blue-500/5 rounded-full scale-0 group-hover:scale-100 transition-transform duration-500"></div>
                                <div className="absolute -inset-4 bg-blue-500/10 rounded-full animate-pulse"></div>
                                
                                {/* Core marker */}
                                <div className="relative z-10 bg-[#0f172a] border border-blue-500/50 p-2.5 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.2)] group-hover:border-blue-400 transition-colors">
                                    <MapPin className="h-5 w-5 text-blue-400" />
                                </div>
                                
                                {/* Proximity HUD */}
                                <div className="absolute top-1/2 left-full ml-4 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 pointer-events-none">
                                    <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-3 rounded-xl min-w-[120px] shadow-2xl">
                                        <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{loc.name}</div>
                                        <div className="flex items-center gap-2 text-[8px] text-white/60 font-mono">
                                            <span className="text-white/30">LOC //</span>
                                            {loc.latitude.toFixed(4)}N {loc.longitude.toFixed(4)}E
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* User Markers */}
                {visits.slice(0, 10).map(visit => {
                    const pos = project(visit.userLat, visit.userLng);
                    return (
                        <div 
                            key={visit.id}
                            className="absolute -translate-x-1/2 -translate-y-1/2 group transition-all duration-1000 ease-in-out"
                            style={{ left: pos.x, top: pos.y }}
                        >
                            <div className="relative">
                                {/* Success/Violation Glow */}
                                <div className={`absolute -inset-3 blur-md opacity-40 rounded-full transition-colors ${visit.isValid ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                
                                {/* User Node */}
                                <div className={`relative z-10 p-2 rounded-full border shadow-xl backdrop-blur-md transition-all scale-90 group-hover:scale-100 ${
                                    visit.isValid 
                                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                                        : 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                                }`}>
                                    <User className="h-3 w-3" />
                                </div>
                                
                                {/* Identity Tag */}
                                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none translate-y-2 group-hover:translate-y-0">
                                    <div className={`px-2 py-1 rounded-md text-[8px] font-bold whitespace-nowrap border shadow-2xl ${
                                        visit.isValid ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-rose-500 text-white border-rose-400'
                                    }`}>
                                        {visit.firstName} {visit.lastName}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend Matrix */}
            <div className="absolute bottom-8 right-8 bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-3xl shadow-2xl space-y-3 min-w-[160px]">
                <div className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em] mb-2 px-1">Tactical Legend</div>
                <div className="flex items-center gap-3 group">
                    <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                    <span className="text-[10px] font-bold text-white/70 group-hover:text-white transition-colors">Matrix Point</span>
                </div>
                <div className="flex items-center gap-3 group">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                    <span className="text-[10px] font-bold text-white/70 group-hover:text-white transition-colors">Verified Entity</span>
                </div>
                <div className="flex items-center gap-3 group">
                    <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
                    <span className="text-[10px] font-bold text-white/70 group-hover:text-white transition-colors">Unauthorized Access</span>
                </div>
            </div>

            <style jsx>{`
                @keyframes scan {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(100%); }
                }
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
            `}</style>
        </div>
    );
}
