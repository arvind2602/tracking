'use client';

import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { 
    QrCode, 
    Navigation, 
    Smartphone, 
    Lock,
    ShieldCheck,
    AlertCircle,
    Loader2,
    CheckCircle2,
    MapPin
} from 'lucide-react';
import { toast } from 'sonner';

export default function QRScanSimulator() {
    const [scannedData, setScannedData] = useState<any>(null);
    const [status, setStatus] = useState<'idle' | 'scanning' | 'verifying' | 'success' | 'failed'>('idle');
    const [verificationResult, setVerificationResult] = useState<any>(null);
    const [locationId, setLocationId] = useState('');
    const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | null>(null);

    // Mock scan - in real app this would come from a QR scanner library
    const simulateScan = (id: string) => {
        setStatus('scanning');
        setTimeout(() => {
            setScannedData({ location_id: id });
            setLocationId(id);
            setStatus('verifying');
            verifyPresence(id);
        }, 1500);
    };

    const verifyPresence = async (locId: string) => {
        if (!navigator.geolocation) {
            toast.error("GPS not supported");
            setStatus('failed');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCoordinates(gps);
                
                try {
                    const response = await axios.post('/qr/verify', {
                        location_id: locId,
                        device_id: 'BROWSER_SIMULATOR_' + Math.random().toString(36).substring(7),
                        timestamp: new Date().toISOString(),
                        user_gps: gps
                    });
                    
                    setVerificationResult(response.data);
                    setStatus('success');
                    toast.success('Location Verified!');
                } catch (error: any) {
                    setVerificationResult(error.response?.data || { message: 'Verification failed' });
                    setStatus('failed');
                    toast.error('Verification Failed');
                }
            },
            (err) => {
                console.error(err);
                toast.error("GPS Access Denied");
                setStatus('failed');
            }
        );
    };

    const reset = () => {
        setStatus('idle');
        setScannedData(null);
        setVerificationResult(null);
        setLocationId('');
    };

    return (
        <div className="max-w-md mx-auto py-12 px-4 space-y-8 animate-in slide-in-from-bottom-8 duration-500">
            <div className="text-center space-y-2">
                <div className="inline-flex p-3 bg-primary/10 rounded-2xl mb-4">
                    <Smartphone className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">QR Presence Verification</h1>
                <p className="text-muted-foreground">Mobile app scan simulator</p>
            </div>

            <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/5 rounded-full -ml-12 -mb-12 blur-2xl"></div>

                {status === 'idle' && (
                    <div className="space-y-6 py-6 text-center">
                        <div className="relative mx-auto w-48 h-48 flex items-center justify-center bg-accent/50 rounded-3xl border-2 border-dashed border-border group overflow-hidden">
                            <QrCode className="h-24 w-24 text-muted-foreground opacity-50 group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent flex items-end justify-center pb-4">
                                <span className="text-xs font-bold uppercase tracking-widest text-primary">Ready to scan</span>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground px-6">
                                Enter a Location ID manually to simulate a QR scan from the dashboard.
                            </p>
                            <input 
                                type="text"
                                placeholder="Paste Location ID here..."
                                value={locationId}
                                onChange={(e) => setLocationId(e.target.value)}
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-center font-mono text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                            />
                            <button
                                onClick={() => simulateScan(locationId)}
                                disabled={!locationId}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-4 rounded-2xl font-bold tracking-wide shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                                Simulate Scan
                            </button>
                        </div>
                    </div>
                )}

                {(status === 'scanning' || status === 'verifying') && (
                    <div className="py-12 flex flex-col items-center space-y-6 text-center">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Navigation className="h-8 w-8 text-primary animate-pulse" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold uppercase tracking-widest">
                                {status === 'scanning' ? 'Scanning QR...' : 'Verifying GPS...'}
                            </h3>
                            <p className="text-sm text-muted-foreground animate-pulse">
                                Securing your presence data
                            </p>
                        </div>
                    </div>
                )}

                {status === 'success' && (
                    <div className="py-8 flex flex-col items-center space-y-6 text-center">
                        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center border-4 border-green-500 animate-in zoom-in-50 duration-300">
                            <CheckCircle2 className="h-12 w-12 text-green-500" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-green-500 uppercase tracking-tighter">Verified</h3>
                            <p className="text-sm text-muted-foreground">
                                Presence successfully recorded at location.
                            </p>
                        </div>

                        <div className="w-full bg-accent/30 rounded-2xl p-4 border border-border/50 space-y-3">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Location ID</span>
                                <span className="font-mono">{locationId.substring(0, 12)}...</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Distance</span>
                                <span className="font-bold">{Math.round(verificationResult?.visit?.distance || 0)}m from target</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Accuracy</span>
                                <span className="text-green-400 font-medium">98.2% (Simulated)</span>
                            </div>
                        </div>

                        <button
                            onClick={reset}
                            className="w-full bg-secondary hover:bg-accent text-secondary-foreground py-3 rounded-xl font-medium transition-colors"
                        >
                            Next Scan
                        </button>
                    </div>
                )}

                {status === 'failed' && (
                    <div className="py-8 flex flex-col items-center space-y-6 text-center">
                        <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center border-4 border-red-500 animate-in shake-x duration-500">
                            <AlertCircle className="h-12 w-12 text-red-500" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-red-500 uppercase tracking-tighter">Invalid Access</h3>
                            <p className="text-sm text-muted-foreground px-4">
                                {verificationResult?.message || 'Verification failed. GPS coordinates outside authorized range.'}
                            </p>
                        </div>
                        
                        <div className="w-full bg-red-500/5 rounded-2xl p-4 border border-red-500/10 space-y-3">
                            <div className="flex justify-between text-xs text-red-400">
                                <span>Error Code</span>
                                <span className="font-mono">ERR_OUT_OF_BOUNDS</span>
                            </div>
                            <div className="text-xs text-muted-foreground text-left py-2 border-t border-red-500/10 mt-2">
                                Current coordinates: <br/>
                                <span className="font-mono">{coordinates?.lat.toFixed(4)}, {coordinates?.lng.toFixed(4)}</span>
                            </div>
                        </div>

                        <button
                            onClick={reset}
                            className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-center gap-6 text-muted-foreground opacity-50">
                <div className="flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-[10px] uppercase font-bold tracking-widest">Encrypted</span>
                </div>
                <div className="flex items-center gap-1">
                    <Lock className="h-4 w-4" />
                    <span className="text-[10px] uppercase font-bold tracking-widest">Anti-Spoof</span>
                </div>
            </div>
        </div>
    );
}
