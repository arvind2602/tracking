'use client';

import React, { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { MapPin, LogIn, LogOut, Loader2, Smartphone, ShieldCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { getDeviceId, getDeviceInfo } from '@/lib/device';

interface AttendanceStatus {
    checkInTime: string | null;
    checkOutTime: string | null;
    status: string;
    withinGeofence?: boolean;
    deviceMismatch?: boolean;
}

export function CheckInButton({ onUpdate }: { onUpdate?: () => void }) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<AttendanceStatus | null>(null);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

    const fetchStatus = async () => {
        try {
            const res = await axios.get('/attendance/history?startDate=' + new Date().toISOString().split('T')[0]);
            if (res.data && res.data.length > 0) {
                const today = res.data[0];
                setStatus({
                    checkInTime: today.checkIn,
                    checkOutTime: today.checkOut,
                    status: today.status,
                    withinGeofence: today.withinGeofence,
                    deviceMismatch: today.deviceMismatch
                });
            } else {
                setStatus(null);
            }
        } catch (error) {
            console.error('Failed to fetch attendance status', error);
        }
    };

    useEffect(() => {
        fetchStatus();

        // Get location early
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.error('Location error', err),
                { enableHighAccuracy: true }
            );
        }
    }, []);

    const handleAction = async (type: 'in' | 'out') => {
        if (!location) {
            toast.error('Location access required for attendance');
            return;
        }

        setLoading(true);
        const deviceId = getDeviceId();
        const deviceInfo = getDeviceInfo();

        try {
            const url = type === 'in' ? '/attendance/check-in' : '/attendance/check-out';
            const res = await axios.post(url, {
                latitude: location.lat,
                longitude: location.lng,
                deviceId,
                ...deviceInfo
            });

            if (res.data.success) {
                toast.success(res.data.message);
                if (res.data.deviceMismatch) {
                    toast.warning('New device detected. Admin has been notified.');
                }
                if (res.data.withinGeofence === false) {
                    toast.warning('Check-in recorded outside geofence area.');
                }
                fetchStatus();
                if (onUpdate) onUpdate();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || `Failed to ${type === 'in' ? 'check-in' : 'check-out'}`);
        } finally {
            setLoading(false);
        }
    };

    const isCheckedIn = status?.checkInTime && !status?.checkOutTime;
    const isCheckedOut = status?.checkOutTime;

    return (
        <div className="flex flex-col gap-4 p-6 bg-card border border-border rounded-3xl shadow-xl relative overflow-hidden group">
            {/* Decorative background */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors"></div>

            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                        Attendance Portal
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {isCheckedOut ? 'You have finished for today' : isCheckedIn ? 'You are currently on duty' : 'Capture your presence for today'}
                    </p>
                </div>
                <div className="p-2 bg-primary/10 rounded-xl">
                    <MapPin className="w-5 h-5 text-primary" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Check In</p>
                    <p className="text-lg font-bold text-foreground">
                        {status?.checkInTime ? new Date(status.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Check Out</p>
                    <p className="text-lg font-bold text-foreground">
                        {status?.checkOutTime ? new Date(status.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {!isCheckedOut ? (
                    <Button
                        size="lg"
                        onClick={() => handleAction(isCheckedIn ? 'out' : 'in')}
                        disabled={loading || !location}
                        className={`w-full py-8 text-lg font-bold rounded-2xl transition-all duration-300 shadow-lg ${isCheckedIn
                                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20'
                            }`}
                    >
                        {loading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : isCheckedIn ? (
                            <>
                                <LogOut className="w-6 h-6 mr-2" />
                                Clock Out
                            </>
                        ) : (
                            <>
                                <LogIn className="w-6 h-6 mr-2" />
                                Clock In
                            </>
                        )}
                    </Button>
                ) : (
                    <div className="w-full py-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center gap-3 text-emerald-600 dark:text-emerald-400 font-bold">
                        <ShieldCheck className="w-6 h-6" />
                        Duty Completed
                    </div>
                )}

                {!location && !isCheckedOut && (
                    <p className="text-[10px] text-center text-amber-500 font-medium">
                        Waiting for GPS signal... Please enable location.
                    </p>
                )}
            </div>

            {(status?.withinGeofence === false || status?.deviceMismatch) && (
                <div className="mt-2 space-y-2">
                    {status.withinGeofence === false && (
                        <div className="flex items-center gap-2 p-2 px-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            <MapPin className="w-3.5 h-3.5" />
                            Recorded outside allowed radius
                        </div>
                    )}
                    {status.deviceMismatch && (
                        <div className="flex items-center gap-2 p-2 px-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-600 dark:text-red-400 font-medium">
                            <Smartphone className="w-3.5 h-3.5" />
                            Unrecognized device flagged
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
