'use client';

import { useState, useEffect, useRef } from 'react';
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
    MapPin,
    X,
    Camera
} from 'lucide-react';
import { toast } from 'sonner';

import { Html5Qrcode } from 'html5-qrcode';

export default function RealQRScanner() {
    const [status, setStatus] = useState<'idle' | 'scanning' | 'verifying' | 'success' | 'failed'>('idle');
    const [verificationResult, setVerificationResult] = useState<any>(null);
    const [locationId, setLocationId] = useState('');
    const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | null>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [scanStatus, setScanStatus] = useState<string>('Searching...');
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

    const startScanner = async () => {
        if (status === 'scanning') {
            try {
                // Short delay to ensure DOM element is ready
                await new Promise(r => setTimeout(r, 100));
                
                const scanner = new Html5Qrcode("reader");
                html5QrCodeRef.current = scanner;
                
                const config = { 
                    fps: 20, // Increased frequency for faster capture
                    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                        const edgeSize = Math.floor(minEdge * 0.75); // Scan 75% of the visible area
                        return { width: edgeSize, height: edgeSize };
                    },
                    aspectRatio: 1.0,
                    experimentalFeatures: {
                        useBarCodeDetectorIfSupported: true // Use native hardware acceleration
                    }
                };

                await scanner.start(
                    { facingMode: "environment" },
                    config,
                    onScanSuccess,
                    () => {} 
                );
                setCameraReady(true);
            } catch (err: any) {
                console.error("Scanner start fail", err);
                toast.error("Camera denied or not found");
                setStatus('failed');
            }
        }
    };

    useEffect(() => {
        if (status === 'scanning' && !cameraReady) {
            startScanner();
            // Pre-request location
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => setCoordinates({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    (err) => console.warn('Pre-scan location request failed', err),
                    { enableHighAccuracy: true, timeout: 5000 }
                );
            }
        }

        return () => {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().catch(e => console.error(e));
            }
        };
    }, [status]);

    function onScanSuccess(decodedText: string) {
        setScanStatus("QR Detected!");
        
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().then(() => {
                processScan(decodedText);
            }).catch(() => processScan(decodedText));
        } else {
            processScan(decodedText);
        }
    }

    const processScan = (decodedText: string) => {
        let locId = '';
        try {
            const data = JSON.parse(decodedText);
            locId = data.location_id;
        } catch {
            locId = decodedText.trim();
        }

        if (locId) {
            setLocationId(locId);
            setStatus('verifying');
            verifyPresence(locId);
        } else {
            toast.error("Unrecognized QR Code format");
        }
    };

    const handleValidScan = (locId: string) => {
        setLocationId(locId);
        setStatus('verifying');
        verifyPresence(locId);
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
                        device_id: 'REAL_DEVICE_' + Math.random().toString(36).substring(7),
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
                let msg = "GPS Access Denied";
                if (err.code === err.PERMISSION_DENIED) {
                    msg = "Location permission denied. Please allow location access in your browser settings and try again.";
                } else if (err.code === err.TIMEOUT) {
                    msg = "Location request timed out. Please ensure GPS is enabled and try again.";
                }
                setVerificationResult({ message: msg });
                toast.error(msg);
                setStatus('failed');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const reset = () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(e => console.error(e));
        }
        
        setStatus('idle');
        setScanStatus('Searching...');
        setCameraReady(false);
        setVerificationResult(null);
        setLocationId('');
    };

    return (
        <div className="max-w-md mx-auto py-12 px-4 space-y-8 animate-in slide-in-from-bottom-8 duration-500 font-mono">
            <div className="text-center space-y-2">
                <div className="inline-flex p-3 bg-primary/10 rounded-2xl mb-4">
                    <Camera className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Active QR Scanner</h1>
                <p className="text-muted-foreground">Scan physical location codes</p>
            </div>

            <div className="bg-card border border-border rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden transition-all duration-300">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/5 rounded-full -ml-12 -mb-12 blur-2xl"></div>

                {status === 'idle' && (
                    <div className="space-y-6 py-6 text-center">
                        <div className="relative mx-auto w-48 h-48 flex items-center justify-center bg-accent/30 rounded-3xl border-2 border-dashed border-border group overflow-hidden">
                            <QrCode className="h-24 w-24 text-muted-foreground opacity-30 group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent flex items-end justify-center pb-4">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">System Ready</span>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-xs text-muted-foreground px-6 leading-relaxed">
                                Point your camera at a Vighnotech QR code. We'll verify your location automatically.
                            </p>
                            <button
                                onClick={() => setStatus('scanning')}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-4 rounded-2xl font-bold uppercase tracking-wider shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                            >
                                <Camera className="h-5 w-5" />
                                Start Scanner
                            </button>
                        </div>
                    </div>
                )}

                {status === 'scanning' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary animate-pulse flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${scanStatus === 'QR Detected!' ? 'bg-green-500' : 'bg-primary'}`}></div>
                                {scanStatus}
                            </span>
                            <button onClick={reset} className="p-2 hover:bg-accent rounded-full transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div id="reader" className="overflow-hidden rounded-3xl border-2 border-primary/50 shadow-inner bg-black min-h-[300px]"></div>
                        <p className="text-center text-[10px] text-muted-foreground py-2 uppercase tracking-widest">
                            Align QR code within the frame
                        </p>
                    </div>
                )}

                {status === 'verifying' && (
                    <div className="py-12 flex flex-col items-center space-y-6 text-center">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Navigation className="h-8 w-8 text-primary animate-pulse" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold uppercase tracking-wider">
                                Validating...
                            </h3>
                            <p className="text-xs text-muted-foreground animate-pulse font-mono">
                                Lat/Lng Check: ACTIVE
                            </p>
                        </div>
                    </div>
                )}

                {status === 'success' && (
                    <div className="py-8 flex flex-col items-center space-y-6 text-center animate-in zoom-in-95 duration-300">
                        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center border-4 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                            <CheckCircle2 className="h-12 w-12 text-green-500" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-2xl font-bold text-green-500 uppercase tracking-tight">Verified</h3>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                Presence Logged Securely
                            </p>
                        </div>

                        <div className="w-full bg-accent/20 rounded-2xl p-5 border border-border/50 space-y-3 font-mono">
                            <div className="flex justify-between text-[10px]">
                                <span className="text-muted-foreground uppercase">Point ID</span>
                                <span className="font-bold">{locationId.substring(0, 8)}...</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-muted-foreground uppercase">Accuracy</span>
                                <span className="text-green-400 font-bold">Within {Math.round(verificationResult?.visit?.distance || 0)}m</span>
                            </div>
                        </div>

                        <button
                            onClick={reset}
                            className="w-full bg-secondary hover:bg-accent text-secondary-foreground py-4 rounded-2xl font-bold uppercase tracking-wider border border-border transition-all"
                        >
                            Next Scan
                        </button>
                    </div>
                )}

                {status === 'failed' && (
                    <div className="py-8 flex flex-col items-center space-y-6 text-center animate-in shake-x duration-500">
                        <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center border-4 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                            <AlertCircle className="h-12 w-12 text-red-500" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-2xl font-bold text-red-500 uppercase tracking-tight">Denied</h3>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                Location Mismatch
                            </p>
                        </div>
                        
                        <div className="w-full bg-red-500/5 rounded-2xl p-5 border border-red-500/20 space-y-3 font-mono text-left">
                            <div className="text-[10px] text-red-400 leading-relaxed uppercase">
                                {verificationResult?.message || 'Access denied due to GPS deviation.'}
                            </div>
                            <div className="pt-2 border-t border-red-500/10 mt-2">
                                <span className="text-[8px] text-muted-foreground uppercase block mb-1">Live Coordinates</span>
                                <span className="text-[10px] text-red-400 font-bold">
                                    {coordinates?.lat.toFixed(6)}, {coordinates?.lng.toFixed(6)}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={reset}
                            className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-bold uppercase tracking-wider shadow-xl shadow-red-500/20 active:scale-95 transition-all"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-center gap-6 text-muted-foreground/40">
                <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-[8px] uppercase font-bold tracking-wider">Verified Link</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Lock className="h-4 w-4" />
                    <span className="text-[8px] uppercase font-bold tracking-wider">AES-256</span>
                </div>
            </div>

            {/* Global Style Override for the library UI */}
            <style jsx global>{`
                #reader {
                    border: none !important;
                }
                #reader button {
                    background-color: #3b82f6 !important;
                    color: white !important;
                    border: none !important;
                    border-radius: 12px !important;
                    padding: 8px 16px !important;
                    font-size: 12px !important;
                    font-weight: bold !important;
                    margin-top: 10px !important;
                    cursor: pointer !important;
                    font-family: inherit !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.1em !important;
                }
                #reader img {
                    display: none !important;
                }
                #reader__scan_region {
                    background: #000 !important;
                }
                #reader__scan_region > div {
                    border: 2px solid rgba(59, 130, 246, 0.5) !important;
                    border-radius: 24px !important;
                    box-shadow: 0 0 0 4000px rgba(0, 0, 0, 0.5) !important;
                }
                /* Custom Scanning Line */
                #reader__scan_region::after {
                    content: "";
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 2px;
                    background: #3b82f6;
                    box-shadow: 0 0 15px #3b82f6, 0 0 30px #3b82f6;
                    animation: scan-line 2s linear infinite;
                    z-index: 10;
                    opacity: 0.8;
                }
                @keyframes scan-line {
                    0% { top: 20%; }
                    50% { top: 80%; }
                    100% { top: 20%; }
                }
                #reader video {
                    object-fit: cover !important;
                    width: 100% !important;
                    height: 100% !important;
                }
            `}</style>
        </div>
    );
}
