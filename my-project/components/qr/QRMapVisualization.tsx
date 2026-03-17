'use client';

import { useMemo, useState } from 'react';
import { MapPin, User, Search, X, Maximize2 } from 'lucide-react';

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
    const [focusedLocId, setFocusedLocId] = useState<string | null>(null);

    // We normalize coordinates to fit into an SVG grid
    const bounds = useMemo(() => {
        if (focusedLocId) {
            const loc = locations.find(l => l.id === focusedLocId);
            if (loc) {
                // Find all visitors who are at this specific location
                const locationVisitors = visits.filter(v => v.locationName === loc.name);
                
                const lats = [loc.latitude, ...locationVisitors.map(v => v.userLat)];
                const lngs = [loc.longitude, ...locationVisitors.map(v => v.userLng)];
                
                const minLatRaw = Math.min(...lats);
                const maxLatRaw = Math.max(...lats);
                const minLngRaw = Math.min(...lngs);
                const maxLngRaw = Math.max(...lngs);

                const latDiff = maxLatRaw - minLatRaw;
                const lngDiff = maxLngRaw - minLngRaw;

                // Ensure a minimum spread (roughly 50m) to allow for anti-collision labels
                const minSpread = 0.0005;
                const latPadding = Math.max(latDiff * 0.4, minSpread);
                const lngPadding = Math.max(lngDiff * 0.4, minSpread);

                return {
                    minLat: minLatRaw - latPadding,
                    maxLat: maxLatRaw + latPadding,
                    minLng: minLngRaw - lngPadding,
                    maxLng: maxLngRaw + lngPadding
                };
            }
        }

        const displayedVisits = visits.slice(0, 15);
        const lats = [
            ...locations.map(l => l.latitude),
            ...displayedVisits.map(v => v.userLat)
        ];
        const lngs = [
            ...locations.map(l => l.longitude),
            ...displayedVisits.map(v => v.userLng)
        ];

        if (lats.length === 0) return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };

        return {
            minLat: Math.min(...lats),
            maxLat: Math.max(...lats),
            minLng: Math.min(...lngs),
            maxLng: Math.max(...lngs)
        };
    }, [locations, visits]);

    const project = (lat: number, lng: number) => {
        const latDiff = bounds.maxLat - bounds.minLat;
        const lngDiff = bounds.maxLng - bounds.minLng;

        // Use a "Safe Tactical Zone" to avoid UI overlaps
        // Header occupies roughly top 15%
        // Legend occupies roughly bottom 35% on the right
        // We project data into: X [15% to 85%], Y [20% to 60%]
        
        const xRatio = lngDiff === 0 ? 0.5 : (lng - bounds.minLng) / lngDiff;
        const yRatio = latDiff === 0 ? 0.5 : (lat - bounds.minLat) / latDiff;

        const x = 15 + (xRatio * 70);
        const y = 65 - (yRatio * 40); // 65% is the baseline for the "safe" area vertically
        
        return { x: `${x}%`, y: `${y}%` };
    };

    return (
        <div className="relative w-full h-[550px] bg-[#020617] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
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
            
            {/* Header Overlay - Tactical Synchronization */}
            <div className="absolute top-8 left-8 z-30 flex flex-col gap-2 pointer-events-none">
                <div className="flex items-center gap-3 bg-black/60 backdrop-blur-2xl border border-white/10 px-5 py-2.5 rounded-2xl shadow-2xl pointer-events-auto">
                    {focusedLocId ? (
                        <button 
                            onClick={() => setFocusedLocId(null)}
                            className="flex items-center gap-2 text-blue-400 hover:text-white transition-colors"
                        >
                            <X className="h-4 w-4" />
                            <span className="text-xs uppercase font-black tracking-[0.2em]">Reset Global View</span>
                        </button>
                    ) : (
                        <>
                            <div className="relative flex items-center justify-center">
                                <div className="absolute h-4 w-4 rounded-full bg-blue-500 animate-ping opacity-30"></div>
                                <div className="h-2 w-2 rounded-full bg-blue-500 relative z-10 shadow-[0_0_10px_#3b82f6]"></div>
                            </div>
                            <span className="text-xs uppercase font-black tracking-[0.3em] text-blue-400">Tactical Synchronization</span>
                        </>
                    )}
                </div>
                
                {focusedLocId && (
                    <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl backdrop-blur-md">
                        <MapPin className="h-3 w-3 text-blue-400" />
                        <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest">
                            Target: {locations.find(l => l.id === focusedLocId)?.name}
                        </span>
                    </div>
                )}
                
                {!focusedLocId && (
                    <div className="flex items-center gap-3 px-2">
                        <div className="h-1 w-16 bg-blue-500/20 rounded-full overflow-hidden">
                            <div className="h-full w-2/3 bg-blue-500 animate-[loading_2s_ease-in-out_infinite]"></div>
                        </div>
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Signal Presence: Optimal</span>
                    </div>
                )}
            </div>

            {/* Spatial Markers Layer */}
            <div className="absolute inset-0 z-10">
                {locations.filter(l => !focusedLocId || l.id === focusedLocId).map(loc => {
                    const pos = project(loc.latitude, loc.longitude);
                    const isFocused = focusedLocId === loc.id;
                    
                    return (
                        <div 
                            key={loc.id}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-600 ${isFocused ? 'z-50' : 'group'}`}
                            style={{ 
                                left: pos.x, 
                                top: pos.y,
                                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
                            }}
                        >
                            <div 
                                className="relative cursor-pointer"
                                onClick={() => setFocusedLocId(isFocused ? null : loc.id)}
                            >
                                {/* Beacon rings */}
                                <div className={`absolute -inset-16 bg-blue-500/5 rounded-full transition-all duration-600 ${isFocused ? 'scale-150 animate-pulse' : 'scale-0 group-hover:scale-100'}`} style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}></div>
                                <div className="absolute -inset-6 bg-blue-500/10 rounded-full animate-pulse"></div>
                                
                                {/* Core marker */}
                                <div className={`relative z-10 bg-[#0f172a]/90 backdrop-blur-md border border-blue-500/30 p-3 rounded-2xl shadow-2xl transition-all duration-600 ${
                                    isFocused 
                                        ? 'border-blue-400 scale-125 shadow-[0_0_60px_rgba(59,130,246,0.6)]' 
                                        : 'group-hover:border-blue-400/60 group-hover:shadow-[0_0_35px_rgba(59,130,246,0.3)]'
                                }`} style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
                                    <MapPin className={`h-6 w-6 transition-colors ${isFocused ? 'text-white' : 'text-blue-400'}`} />
                                </div>
                                
                                {/* Fixed Header Label - Always show if focused or hovered */}
                                <div className={`absolute bottom-full mb-6 left-1/2 -translate-x-1/2 transition-all duration-600 pointer-events-none ${
                                    isFocused ? 'opacity-100 translate-y-0 scale-110' : 'opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0'
                                }`} style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
                                    <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(37,99,235,0.4)] border border-blue-400/50 whitespace-nowrap">
                                        {loc.name}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* User Markers Layer - Filtered and Collision-Aware */}
                {visits
                    .filter(v => !focusedLocId || v.locationName === locations.find(l => l.id === focusedLocId)?.name)
                    .slice(0, 15)
                    .map((visit, idx) => {
                        const pos = project(visit.userLat, visit.userLng);
                        const isZoomed = focusedLocId !== null;
                        
                        // ANTI-COLLISION OFFSET
                        const labelOffset = isZoomed ? (idx % 3) * 35 : 0;
                        const horizontalOffset = isZoomed ? ((idx % 2 === 0 ? 1 : -1) * 20) : 0;

                        return (
                            <div 
                                key={visit.id}
                                className="absolute -translate-x-1/2 -translate-y-1/2 group transition-all duration-600"
                                style={{ 
                                    left: pos.x, 
                                    top: pos.y,
                                    zIndex: isZoomed ? 60 - idx : 10,
                                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
                                }}
                            >
                                <div className="relative">
                                    {/* Success/Violation Glow */}
                                    <div className={`absolute -inset-5 blur-2xl opacity-40 rounded-full transition-colors ${visit.isValid ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                    
                                    {/* User Node */}
                                    <div className={`relative z-10 p-3 rounded-full border shadow-2xl backdrop-blur-xl transition-all duration-600 ${
                                        isZoomed ? 'scale-110 border-white/50' : 'scale-90 group-hover:scale-110'
                                    } ${
                                        visit.isValid 
                                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                                            : 'bg-rose-500/20 border-rose-500/40 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                                    }`} style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
                                        <User className="h-4 w-4" />
                                    </div>
                                    
                                    {/* Identity Tag - Staggered to prevent overlap */}
                                    <div 
                                        className={`absolute transition-all duration-600 pointer-events-none ${
                                            isZoomed ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                        style={{ 
                                            top: isZoomed ? '140%' : '110%',
                                            left: '50%',
                                            transform: `translateX(calc(-50% + ${horizontalOffset}px)) translateY(${labelOffset}px)`,
                                            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
                                        }}
                                    >
                                        <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase border shadow-2xl whitespace-nowrap transition-all flex flex-col items-center gap-0.5 ${
                                            visit.isValid 
                                                ? 'bg-emerald-500/90 text-white border-emerald-400/50' 
                                                : 'bg-rose-500/90 text-white border-rose-400/50'
                                        }`}>
                                            <span>{visit.firstName} {visit.lastName}</span>
                                            {isZoomed && <div className="w-1 h-1 bg-white/30 rounded-full"></div>}
                                        </div>
                                        
                                        {/* Connector line for zoomed mode */}
                                        {isZoomed && (
                                            <div 
                                                className="absolute bottom-full left-1/2 -translate-x-1/2 w-[1px] bg-white/20 transition-all duration-600"
                                                style={{ 
                                                    height: `${labelOffset + 10}px`,
                                                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
                                                }}
                                            ></div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
            </div>

            {/* Tactical Legend Overlay */}
            <div className="absolute bottom-8 right-8 z-30 bg-black/60 backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] shadow-2xl space-y-4 min-w-[180px] pointer-events-none">
                <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-2 px-1">Legend Protocol</div>
                <div className="space-y-3">
                    <div className="flex items-center gap-4 transition-opacity group-hover:opacity-100 opacity-80">
                        <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]"></div>
                        <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Fixed Node</span>
                    </div>
                    <div className="flex items-center gap-4 transition-opacity group-hover:opacity-100 opacity-80">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"></div>
                        <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Verified Unit</span>
                    </div>
                    <div className="flex items-center gap-4 transition-opacity group-hover:opacity-100 opacity-80">
                        <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]"></div>
                        <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Signal Breach</span>
                    </div>
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
