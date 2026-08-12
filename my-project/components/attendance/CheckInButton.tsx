'use client';

import React, { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
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

const MOTIVATIONAL_MESSAGES = [
    "Main character energy! 💅 Shift completed successfully bestie.",
    "You slayed that shift fr fr 🔥 Time to touch some grass!",
    "Another day, another W. Get that rest bestie 👑",
    "Shift done! System pad diya bhai aaj toh 🔥",
    "Bro cooked and left no crumbs today 🍳 Enjoy your evening!",
    "10/10 shift execution! No cap, you're the GOAT 🐐",
    "Shift successfully completed! Aukaat anusar aaram karein 🛌",
    "W rizz on completing your hours. See ya tomorrow! 👋",
    "Shift over! Time to go delulu in your dreams ☁️✨",
    "Big brain energy today 🧠 Now go clock out and chill!",
    "Valid shift bestie! Time to log off and secure the peace ✌️",
    "Bro understood the assignment 💯 Shift completed!",
    "Vibe check: Passed ✅ Great job today, time to bounce!"
];

const EARLY_CLOCKOUT_MESSAGES = [
    "Bro is really leaving early? 💀 Secure the bag, complete your shift yaar!",
    "Not you clocking out early... the math ain't mathing bestie 😭 Moye moye fr",
    "It's giving 'I want to go home' but your hours said no 💅 stay on the grind!",
    "Ayo, leaving early is a major L. Finish your shift and take the W 🧢",
    "Early clock out? In this economy? 📉 Complete your hours and get that bread bro!",
    "Bhai kya kar raha hai tu? Finish the shift first 😭",
    "Bro thought he could escape early without getting caught 💀 Delulu is the solulu I guess",
    "Clocking out early? Manager subah se kalesh kar dega yaar 🤡",
    "You're leaving early? Big red flag 🚩 Complete your hours pookie 🎀",
    "Leaving early is giving peak jobless behavior 💀 stay back and finish the shift!",
    "Bro thought he could escape early without getting caught 💀 Delulu is the solulu I guess"
];

const CHECKIN_MESSAGES = [
    "Sunday shift? The grind never stops 🔥 Let's get this bread!",
    "Monday motivation: Let's secure the bag bestie 💼",
    "Tuesday vibes! Time to lock in and cook 🍳",
    "Mid-week check! W rizz on that work ethic 💯",
    "Thursday grind! Almost to the weekend, let's slay today 💅",
    "Friday energy! One last push before the weekend 🙌",
    "Weekend warrior! You're the GOAT for this shift 🐐"
];

export function CheckInButton({ onUpdate }: { onUpdate?: () => void }) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<AttendanceStatus | null>(null);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isRequestingLocation, setIsRequestingLocation] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<'in' | 'out' | null>(null);
    const [completedTimeStr, setCompletedTimeStr] = useState<string>('');
    const [isEarlyClockOut, setIsEarlyClockOut] = useState(false);
    const [popupMessage, setPopupMessage] = useState<string>('');

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

    const requestLocation = () => {
        if (!window.isSecureContext) {
            setLocationError('Location access requires a secure (HTTPS) connection. Please contact your administrator.');
            return;
        }

        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser');
            return;
        }

        setIsRequestingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocationError(null);
                setIsRequestingLocation(false);
            },
            (err) => {
                let msg = 'Failed to get location';
                if (err.code === err.PERMISSION_DENIED) {
                    msg = 'Location access denied. Please click "Allow" when prompted or enable location in your browser settings.';
                } else if (err.code === err.POSITION_UNAVAILABLE) {
                    msg = 'Location information is unavailable. Ensure GPS is turned on.';
                } else if (err.code === err.TIMEOUT) {
                    msg = 'Location request timed out. Please try again.';
                }
                setLocationError(msg);
                setIsRequestingLocation(false);
                console.error('Location error', err);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    useEffect(() => {
        fetchStatus();
        requestLocation();
    }, []);

    const handleAction = async (type: 'in' | 'out') => {
        if (!location) {
            toast.error('Location access required for attendance');
            return;
        }

        if (type === 'out' && status?.checkInTime) {
            const checkInDate = new Date(status.checkInTime);
            const now = new Date();
            const diffMs = now.getTime() - checkInDate.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours < 9) {
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                setCompletedTimeStr(`${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`);
                setIsEarlyClockOut(true);
                setPopupMessage(EARLY_CLOCKOUT_MESSAGES[new Date().getDay()]);
            } else {
                setIsEarlyClockOut(false);
                setPopupMessage(MOTIVATIONAL_MESSAGES[new Date().getDay()]);
            }

            setPendingAction(type);
            setIsConfirmModalOpen(true);
            return;
        }

        if (type === 'in') {
            setIsEarlyClockOut(false);
            setPopupMessage(CHECKIN_MESSAGES[new Date().getDay()]);
            setPendingAction(type);
            setIsConfirmModalOpen(true);
            return;
        }

        executeAction(type);
    };

    const executeAction = async (type: 'in' | 'out') => {
        setLoading(true);
        const deviceId = getDeviceId();
        const deviceInfo = getDeviceInfo();

        try {
            const url = type === 'in' ? '/attendance/check-in' : '/attendance/check-out';
            const res = await axios.post(url, {
                latitude: location!.lat,
                longitude: location!.lng,
                deviceId,
                deviceTime: new Date().toISOString(),
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
            setIsConfirmModalOpen(false);
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
                    <div className="space-y-2">
                        {locationError ? (
                            <div className="flex flex-col gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <p className="text-[10px] text-center text-red-500 font-medium">
                                    {locationError}
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={requestLocation}
                                    className="h-7 text-[10px] uppercase font-bold tracking-tight border-red-500/30 hover:bg-red-500/10"
                                >
                                    Try Again
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <p className="text-[10px] text-center text-amber-500 font-medium animate-pulse">
                                    {isRequestingLocation ? 'Requesting GPS Access...' : 'Waiting for GPS signal...'}
                                </p>
                                {!isRequestingLocation && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={requestLocation}
                                        className="h-7 text-[10px] uppercase font-bold tracking-tight"
                                    >
                                        Enable Location
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
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

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={() => executeAction(pendingAction!)}
                title={pendingAction === 'out' ? (isEarlyClockOut ? "Leaving Early? 👀" : "Shift Complete! 🎉") : "Ready to Hustle? 🚀"}
                description={
                    <div className="space-y-4">
                        {pendingAction === 'out' && isEarlyClockOut && (
                            <p className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                                You have only completed <span className="font-bold text-base">{completedTimeStr}</span> of your 9-hour shift.
                            </p>
                        )}
                        <p className="text-base text-foreground font-medium">
                            {popupMessage}
                        </p>
                    </div>
                }
                confirmText={pendingAction === 'out' ? "Yes, Clock Out" : "Let's Go!"}
                cancelText="Cancel"
                variant={pendingAction === 'out' && isEarlyClockOut ? "destructive" : "default"}
            />
        </div>
    );
}
