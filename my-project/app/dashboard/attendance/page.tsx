'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { CheckInButton } from '@/components/attendance/CheckInButton';
import { ShiftManager } from '@/components/attendance/ShiftManager';
import { HolidayManager } from '@/components/attendance/HolidayManager';
import { LeaveHistory } from '@/components/attendance/LeaveHistory';
import {
    Calendar,
    MapPin,
    Smartphone,
    AlertCircle,
    Filter,
    Download,
    Search,
    CheckCircle2,
    Timer,
    Users,
    User as UserIcon,
    Settings as SettingsIcon,
    LayoutGrid,
    PlaneTakeoff,
    Activity
} from 'lucide-react';
import { AttendanceFeedTable } from "@/components/dashboard/AttendanceTable";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { jwtDecode } from 'jwt-decode';

async function fetchAttendanceHistory() {
    const res = await axios.get('/attendance/history');
    return res.data;
}

async function fetchOrganizationAttendance() {
    const res = await axios.get('/attendance/organization');
    return res.data;
}

export default function AttendancePage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'personal' | 'organization' | 'leaves' | 'config'>('personal');
    const [userRole, setUserRole] = useState<string>('USER');

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            const decoded: any = jwtDecode(token);
            setUserRole(decoded.user.role);
        }
    }, []);

    const { data: history, isLoading: isHistoryLoading, refetch: refetchHistory } = useQuery({
        queryKey: ['attendanceHistory'],
        queryFn: fetchAttendanceHistory,
    });

    const { data: orgAttendance, isLoading: isOrgLoading } = useQuery({
        queryKey: ['orgAttendance', activeTab],
        queryFn: fetchOrganizationAttendance,
        enabled: userRole === 'ADMIN' && activeTab === 'organization'
    });

    const filteredHistory = history?.filter((record: any) =>
        record.date?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.status?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredOrg = orgAttendance?.filter((record: any) =>
        `${record.firstName} ${record.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.status?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isAdmin = userRole === 'ADMIN';

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        Attendance Portal
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium">
                        Monitor presence, location security, and work hour efficiency.
                    </p>
                </div>

                <div className="flex bg-muted p-1 rounded-xl border border-border">
                    <button
                        onClick={() => setActiveTab('personal')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                            activeTab === 'personal' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <UserIcon className="w-4 h-4" />
                        Personal
                    </button>
                    {isAdmin && (
                        <>
                            <button
                                onClick={() => setActiveTab('organization')}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                    activeTab === 'organization' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Users className="w-4 h-4" />
                                Org Feed
                            </button>
                            <button
                                onClick={() => setActiveTab('config')}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                    activeTab === 'config' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <SettingsIcon className="w-4 h-4" />
                                Rules
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setActiveTab('leaves')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                            activeTab === 'leaves' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <PlaneTakeoff className="w-4 h-4" />
                        Leaves
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Section: Contextual */}
                <div className="lg:col-span-1 space-y-6">
                    {activeTab === 'personal' ? (
                        <>
                            <CheckInButton onUpdate={refetchHistory} />
                            <div className="p-6 bg-blue-600/5 border border-blue-500/20 rounded-3xl space-y-4">
                                <h4 className="flex items-center gap-2 font-bold text-blue-500">
                                    <AlertCircle className="w-4 h-4" />
                                    Guidelines
                                </h4>
                                <ul className="space-y-2 text-xs text-muted-foreground font-medium list-disc pl-4">
                                    <li>Ensure location is enabled for accurate tracking.</li>
                                    <li>Primary device is required for official check-ins.</li>
                                    <li>Check-ins outside the office radius will be flagged.</li>
                                    <li>Grace period for shifts is 15 minutes.</li>
                                </ul>
                            </div>
                        </>
                    ) : activeTab === 'organization' ? (
                        <div className="p-6 bg-card border border-border rounded-3xl space-y-6 shadow-xl">
                            <h3 className="text-xl font-bold text-foreground">Admin Insights</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Present Today</p>
                                    <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
                                        {orgAttendance?.filter((r: any) => r.status === 'PRESENT').length || 0}
                                    </p>
                                </div>
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Late Check-ins</p>
                                    <p className="text-3xl font-black text-amber-700 dark:text-amber-300">
                                        {orgAttendance?.filter((r: any) => r.status === 'LATE').length || 0}
                                    </p>
                                </div>
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                                    <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">Device Flags</p>
                                    <p className="text-3xl font-black text-red-700 dark:text-red-300">
                                        {orgAttendance?.filter((r: any) => r.deviceMismatch).length || 0}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'config' ? (
                        <div className="p-6 bg-purple-600/5 border border-purple-500/20 rounded-3xl space-y-4 text-purple-900 dark:text-purple-300">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <LayoutGrid className="w-5 h-5" />
                                Policy Rules
                            </h3>
                            <p className="text-xs font-medium">Changes here affect the entire organization presence policy. Ensure all shifts are correctly timed for accurate late tracking.</p>
                        </div>
                    ) : activeTab === 'leaves' ? (
                        <div className="p-6 bg-amber-600/5 border border-amber-500/20 rounded-3xl space-y-4">
                            <h4 className="flex items-center gap-2 font-bold text-amber-500">
                                <PlaneTakeoff className="w-4 h-4" />
                                Leave Policy
                            </h4>
                            <ul className="space-y-2 text-xs text-muted-foreground font-medium list-disc pl-4">
                                <li>Submit leave at least 48 hours in advance.</li>
                                <li>Approvals are subject to project requirements.</li>
                                <li>Emergency leaves require manager notification.</li>
                                <li>Check leave balance in profile section.</li>
                            </ul>
                        </div>
                    ) : null}
                </div>

                {/* Right Section: Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {activeTab === 'config' ? (
                        <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-500">
                            <ShiftManager />
                            <HolidayManager />
                        </div>
                    ) : activeTab === 'leaves' ? (
                        <LeaveHistory isAdmin={isAdmin} />
                    ) : (
                        <>
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="relative w-full md:w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder={`Search ${activeTab === 'personal' ? 'history' : 'employees'}...`}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
                                        <Filter className="w-4 h-4" />
                                        Filter
                                    </button>
                                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                                        <Download className="w-4 h-4" />
                                        Export
                                    </button>
                                </div>
                            </div>

                            {activeTab === 'organization' ? (
                                <AttendanceFeedTable searchTerm={searchTerm} />
                            ) : (
                                <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-muted/50 border-b border-border">
                                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                        {activeTab === 'personal' ? 'Date' : 'Employee'}
                                                    </th>
                                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">In / Out</th>
                                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Work Hours</th>
                                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Flags</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {(activeTab === 'personal' ? isHistoryLoading : isOrgLoading) ? (
                                                    [...Array(5)].map((_, i) => (
                                                        <tr key={i}>
                                                            <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                                                            <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                                                            <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                                                            <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                                                            <td className="px-6 py-4"><Skeleton className="h-4 w-8" /></td>
                                                        </tr>
                                                    ))
                                                ) : (activeTab === 'personal' ? filteredHistory : filteredOrg)?.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                                                            No records found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    (activeTab === 'personal' ? filteredHistory : filteredOrg)?.map((record: any) => (
                                                        <tr key={record.id} className="hover:bg-muted/30 transition-colors group">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={cn(
                                                                        "p-2 rounded-lg",
                                                                        activeTab === 'personal' ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
                                                                    )}>
                                                                        {activeTab === 'personal' ? <Calendar className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-bold text-foreground">
                                                                            {activeTab === 'personal'
                                                                                ? format(new Date(record.date), 'MMM dd, yyyy')
                                                                                : `${record.firstName} ${record.lastName}`}
                                                                        </p>
                                                                        <p className="text-[10px] text-muted-foreground">
                                                                            {activeTab === 'personal'
                                                                                ? format(new Date(record.date), 'EEEE')
                                                                                : record.position}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-sm font-medium">
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                        <span className="text-foreground">{record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '--:--'}</span>
                                                                        <span className="text-muted-foreground text-[10px]">IN</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                                        <span className="text-foreground">{record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : '--:--'}</span>
                                                                        <span className="text-muted-foreground text-[10px]">OUT</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-2">
                                                                    <Timer className="w-4 h-4 text-muted-foreground" />
                                                                    <span className="text-sm font-bold text-foreground">{record.workHours || '0.00'}h</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <p className={cn(
                                                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                                                                    record.status === 'PRESENT' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                                                                    record.status === 'LATE' && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                                                    record.status === 'ABSENT' && "bg-red-500/10 text-red-600 dark:text-red-400"
                                                                )}>
                                                                    {record.status}
                                                                </p>
                                                                {record.lateBy > 0 && (
                                                                    <p className="text-[10px] text-amber-500 font-medium mt-1">Late by {record.lateBy} min</p>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-2">
                                                                    {record.deviceMismatch && (
                                                                        <Smartphone
                                                                            className="w-4 h-4 text-red-500"
                                                                            data-title="Device Mismatch"
                                                                        />
                                                                    )}
                                                                    {record.withinGeofence === false && (
                                                                        <MapPin
                                                                            className="w-4 h-4 text-amber-500"
                                                                            data-title="Outside Geofence"
                                                                        />
                                                                    )}
                                                                    {!record.deviceMismatch && record.withinGeofence !== false && (
                                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500/50" />
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
