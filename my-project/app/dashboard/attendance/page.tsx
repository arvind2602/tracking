"use client";

import React, { useState, useEffect } from "react";
import axios from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import AttendanceHistory from "@/components/attendance/AttendanceHistory";
import { AlertCircle, CheckCircle, MapPin, Loader } from "lucide-react";
import { jwtDecode } from "jwt-decode";

export default function AttendancePage() {
    const [status, setStatus] = useState<"LOADING" | "CHECKED_IN" | "CHECKED_OUT">("LOADING");
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [checkoutReason, setCheckoutReason] = useState("");
    const [checkoutType, setCheckoutType] = useState("LUNCH");
    const [refreshHistory, setRefreshHistory] = useState(0);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);


    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                setUserRole(decoded.user.role);
            } catch (e) {
                console.error(e);
            }
        }
        // 1. Get Location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                (error) => {
                    console.error("Location error:", error);
                    setLocationError("Please enable location services to check in.");
                }
            );
        } else {
            setLocationError("Geolocation is not supported by this browser.");
        }

        // 2. Check current status (using history for now implies fetching latest log)
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const res = await axios.get("/attendance/history?scope=personal");
            // Check if latest log is still active (checkOut is null or undefined)
            if (res.data.length > 0 && !res.data[0].checkOut) {
                setStatus("CHECKED_IN");
            } else {
                setStatus("CHECKED_OUT");
            }
        } catch (err) {
            console.error(err);
            setStatus("CHECKED_OUT"); // Default
        }
    };

    const getDeviceId = () => {
        let deviceId = localStorage.getItem("attendance_device_id");
        if (!deviceId) {
            deviceId = crypto.randomUUID();
            localStorage.setItem("attendance_device_id", deviceId);
        }
        return deviceId;
    };

    const handleCheckIn = async () => {
        if (!location) {
            setMessage({ type: "error", text: "Location is required to check in." });
            return;
        }
        try {
            const deviceId = getDeviceId();
            const res = await axios.post("/attendance/checkin", {
                latitude: location.lat,
                longitude: location.lng,
                deviceId: deviceId,
                deviceType: navigator.userAgent
            });

            if (res.data.alert) {
                setMessage({ type: "success", text: `Checked in! Warning: ${res.data.alert}` });
            } else {
                setMessage({ type: "success", text: "Checked in successfully!" });
            }

            setStatus("CHECKED_IN");
            setRefreshHistory((prev) => prev + 1);
        } catch (error: any) {
            setMessage({
                type: "error",
                text: error.response?.data?.message || "Failed to check in.",
            });
        }
    };

    const handleCheckOut = async () => {
        try {
            await axios.post("/attendance/checkout", {
                reason: checkoutReason,
                type: checkoutType,
                latitude: location?.lat, // Optional
                longitude: location?.lng // Optional
            });
            setMessage({ type: "success", text: "Checked out successfully!" });
            setStatus("CHECKED_OUT");
            setShowCheckoutModal(false);
            setRefreshHistory((prev) => prev + 1);
        } catch (error: any) {
            setMessage({
                type: "error",
                text: error.response?.data?.message || "Failed to check out.",
            });
        }
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
                {status === "LOADING" && (
                    <div className="flex items-center space-x-2 text-gray-400 animate-pulse">
                        <Loader className="h-5 w-5 animate-spin" />
                        <span className="font-medium">Checking status...</span>
                    </div>
                )}
                {status === "CHECKED_IN" && (
                    <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Currently Checked In</span>
                    </div>
                )}
            </div>

            {locationError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-md flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    {locationError}
                </div>
            )}

            {message && (
                <div className={`p-4 rounded-md flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Actions</CardTitle>
                        <CardDescription>Scan QR at door (simulated) and click below</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {status === "LOADING" && (
                            <Button size="lg" className="w-full h-24 text-xl bg-slate-300 cursor-wait" disabled>
                                <Loader className="mr-2 h-5 w-5 animate-spin" />
                                Loading…
                            </Button>
                        )}
                        {status === "CHECKED_OUT" && (
                            <Button
                                size="lg"
                                className="w-full h-24 text-xl bg-slate-900 hover:bg-slate-800"
                                onClick={handleCheckIn}
                                disabled={!!locationError}
                            >
                                Check In
                            </Button>
                        )}
                        {status === "CHECKED_IN" && (
                            <Button
                                variant="destructive"
                                size="lg"
                                className="w-full h-24 text-xl"
                                onClick={() => setShowCheckoutModal(true)}
                            >
                                Check Out / Break
                            </Button>
                        )}

                        <div className="text-sm text-muted-foreground flex items-center gap-1 justify-center">
                            <MapPin className="h-4 w-4" />
                            {location ? "Location acquired" : "Locating..."}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Safety & Devices</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 mb-2">
                            Your device ID is tracked for security. Check-ins are only allowed within 10m of the office.
                        </p>
                        <div className="text-xs text-gray-400 font-mono break-all">
                            Device ID: {typeof window !== 'undefined' ? localStorage.getItem('attendance_device_id') || 'Generating...' : '...'}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <AttendanceHistory refreshTrigger={refreshHistory} userRole={userRole} />

            <Dialog open={showCheckoutModal} onOpenChange={setShowCheckoutModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Check Out / Take Break</DialogTitle>
                        <DialogDescription>
                            Please specify the reason for checking out.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Type</label>
                            <Select onValueChange={setCheckoutType} defaultValue={checkoutType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LUNCH">Lunch Break</SelectItem>
                                    <SelectItem value="BREAK">Short Break</SelectItem>
                                    <SelectItem value="WASHROOM">Washroom</SelectItem>
                                    <SelectItem value="PERSONAL_EMERGENCY">Personal Emergency</SelectItem>
                                    <SelectItem value="HOME">Going Home</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Additional Reason (Optional)</label>
                            <Input
                                placeholder="e.g., Doctors appointment"
                                value={checkoutReason}
                                onChange={(e) => setCheckoutReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCheckoutModal(false)}>Cancel</Button>
                        <Button onClick={handleCheckOut}>Confirm Check Out</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
