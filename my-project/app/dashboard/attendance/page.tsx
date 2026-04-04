'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
    Activity,
    X,
    Clock
} from 'lucide-react';
import { AttendanceFeedTable, LiveWorkHours } from "@/components/dashboard/AttendanceTable";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { format, subDays, isAfter, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-hot-toast';

async function fetchAttendanceHistory() {
    const res = await axios.get('/attendance/history');
    return res.data;
}

async function fetchOrganizationAttendance(params?: any) {
    const res = await axios.get('/attendance/organization', { params });
    return res.data;
}

export default function AttendancePage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'personal' | 'organization' | 'leaves' | 'config'>('personal');
    const [userRole, setUserRole] = useState<string>('USER');

    // Filters State
    const [statusFilter, setStatusFilter] = useState('all');
    const [userFilter, setUserFilter] = useState('all');
    const [dateRangeFilter, setDateRangeFilter] = useState('all');
    const [flagsFilter, setFlagsFilter] = useState('all');

    const today = format(new Date(), 'yyyy-MM-dd');

    // Robust server-side filter params
    const apiParams = useMemo(() => ({
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        employeeId: userFilter !== 'all' ? userFilter : undefined,
        startDate: dateRangeFilter === '7days' ? format(subDays(new Date(), 7), 'yyyy-MM-dd') : 
                  dateRangeFilter === '30days' ? format(subDays(new Date(), 30), 'yyyy-MM-dd') : undefined,
        endDate: (dateRangeFilter === '7days' || dateRangeFilter === '30days') ? format(new Date(), 'yyyy-MM-dd') : undefined,
        date: dateRangeFilter === 'today' ? today : 
              dateRangeFilter === 'yesterday' ? format(subDays(new Date(), 1), 'yyyy-MM-dd') : undefined,
        deviceMismatch: flagsFilter === 'mismatch' ? true : undefined,
        withinGeofence: flagsFilter === 'outside' ? false : undefined,
    }), [searchTerm, statusFilter, userFilter, dateRangeFilter, flagsFilter, today]);

    // Fetch all employees for robust filtering
    const isAdmin = userRole === 'ADMIN';
    
    const { data: allEmployees } = useQuery({
        queryKey: ['orgEmployees'],
        queryFn: async () => {
            const res = await axios.get('/auth/organization/employees');
            return res.data;
        },
        enabled: isAdmin
    });

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
        queryKey: ['orgAttendance', apiParams],
        queryFn: () => fetchOrganizationAttendance(apiParams),
        enabled: isAdmin && (activeTab === 'organization' || activeTab === 'personal')
    });

    const filteredHistory = history?.filter((record: any) =>
        record.date?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.status?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredOrg = orgAttendance; // Managed by server

    const handleExport = () => {
        const dataToExport = activeTab === 'personal' ? history : orgAttendance;
        if (!dataToExport || dataToExport.length === 0) {
            toast.error('No data available to export');
            return;
        }

        const headers = activeTab === 'personal' 
            ? ['Date', 'Check In', 'Check Out', 'Work Hours', 'Status', 'Late By (min)']
            : ['Employee', 'Email', 'Position', 'Date', 'Check In', 'Check Out', 'Work Hours', 'Status', 'Within Geofence', 'Device Mismatch'];

        const rows = dataToExport.map((r: any) => {
            if (activeTab === 'personal') {
                return [
                    format(new Date(r.date), 'yyyy-MM-dd'),
                    r.checkIn ? format(new Date(r.checkIn), 'HH:mm:ss') : 'N/A',
                    r.checkOut ? format(new Date(r.checkOut), 'HH:mm:ss') : 'N/A',
                    r.workHours || 0,
                    r.status,
                    r.lateBy || 0
                ];
            } else {
                return [
                    `${r.firstName} ${r.lastName}`,
                    r.email,
                    r.position,
                    format(new Date(r.date), 'yyyy-MM-dd'),
                    r.checkIn ? format(new Date(r.checkIn), 'HH:mm:ss') : 'N/A',
                    r.checkOut ? format(new Date(r.checkOut), 'HH:mm:ss') : 'N/A',
                    r.workHours || 0,
                    r.status,
                    r.withinGeofence ? 'Yes' : 'No',
                    r.deviceMismatch ? 'Yes' : 'No'
                ];
            }
        });

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `attendance_${activeTab}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported ${dataToExport.length} records`);
    };

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

            {activeTab === 'organization' ? (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
                    {/* Organization Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard
                            title="Present Today"
                            value={orgAttendance?.filter((r: any) => 
                                r.status === 'PRESENT' && format(new Date(r.date), 'yyyy-MM-dd') === today
                            ).length || 0}
                            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                            className="bg-emerald-500/5 border-emerald-500/20"
                        />
                        <SummaryCard
                            title="Late Check-ins"
                            value={orgAttendance?.filter((r: any) => 
                                r.status === 'LATE' && format(new Date(r.date), 'yyyy-MM-dd') === today
                            ).length || 0}
                            icon={<Timer className="h-5 w-5 text-amber-500" />}
                            className="bg-amber-500/5 border-amber-500/20"
                        />
                        <SummaryCard
                            title="Device Flags"
                            value={orgAttendance?.filter((r: any) => r.deviceMismatch).length || 0}
                            icon={<Smartphone className="h-5 w-5 text-rose-500" />}
                            className="bg-rose-500/5 border-rose-500/20"
                        />
                        <SummaryCard
                            title="Missed Checkouts"
                            value={orgAttendance?.filter((r: any) => 
                                !r.checkOut && format(new Date(r.date), 'yyyy-MM-dd') !== today
                            ).length || 0}
                            icon={<AlertCircle className="h-5 w-5 text-blue-500" />}
                            className="bg-blue-500/5 border-blue-500/20"
                        />
                    </div>

                    {/* Filters & Search */}
                    <div className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search employees, positions, or status..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm transition-all"
                                />
                            </div>
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <button 
                                    onClick={() => {
                                        setSearchTerm('');
                                        setStatusFilter('all');
                                        setUserFilter('all');
                                        setDateRangeFilter('all');
                                        setFlagsFilter('all');
                                    }}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-card border border-border rounded-2xl text-sm font-bold hover:bg-muted transition-all shadow-sm text-muted-foreground"
                                >
                                    <X className="w-4 h-4" />
                                    Reset
                                </button>
                                <button 
                                    onClick={handleExport}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                                >
                                    <Download className="w-4 h-4" />
                                    Export CSV
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <SearchableSelect
                                value={statusFilter}
                                onValueChange={setStatusFilter}
                                options={[
                                    { value: "all", label: "All Statuses" },
                                    { value: "PRESENT", label: "Present" },
                                    { value: "LATE", label: "Late" },
                                    { value: "ABSENT", label: "Absent" },
                                    { value: "MISSED", label: "Missed Checkouts" },
                                ]}
                                placeholder="Status"
                                className="w-full md:w-[200px]"
                            />
                            <SearchableSelect
                                value={userFilter}
                                onValueChange={setUserFilter}
                                options={[
                                    { value: "all", label: "All Employees" },
                                    ...(allEmployees ? allEmployees.map((emp: any) => ({
                                        value: String(emp.id),
                                        label: `${emp.firstName} ${emp.lastName}`
                                    })) : [])
                                ]}
                                placeholder="Employee"
                                className="w-full md:w-[200px]"
                            />
                            <SearchableSelect
                                value={dateRangeFilter}
                                onValueChange={setDateRangeFilter}
                                options={[
                                    { value: "all", label: "All Time" },
                                    { value: "today", label: "Today" },
                                    { value: "yesterday", label: "Yesterday" },
                                    { value: "7days", label: "Last 7 Days" },
                                    { value: "30days", label: "Last 30 Days" },
                                ]}
                                placeholder="Date Range"
                                className="w-full md:w-[200px]"
                            />
                            <SearchableSelect
                                value={flagsFilter}
                                onValueChange={setFlagsFilter}
                                options={[
                                    { value: "all", label: "All Signals" },
                                    { value: "mismatch", label: "Device Errors" },
                                    { value: "outside", label: "Location Errors" },
                                    { value: "clean", label: "No Flags" },
                                ]}
                                placeholder="Security Flags"
                                className="w-full md:w-[200px]"
                            />
                        </div>
                    </div>

                    {/* Main Table */}
                    <AttendanceFeedTable 
                        data={orgAttendance} 
                        isLoading={isOrgLoading}
                    />
                </div>
            ) : (
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
                                        <button 
                                            onClick={handleExport}
                                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                                        >
                                            <Download className="w-4 h-4" />
                                            Export
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs md:text-sm border-collapse">
                                            <thead className="bg-secondary text-foreground italic px-6 py-4 uppercase tracking-wider text-[10px] font-bold">
                                                <tr className="border-b border-border">
                                                    <th className="px-6 py-4 text-muted-foreground">
                                                        {activeTab === 'personal' ? 'Date' : 'Employee'}
                                                    </th>
                                                    <th className="px-6 py-4 text-center text-muted-foreground whitespace-nowrap">Check-In / Out</th>
                                                    <th className="px-6 py-4 text-center text-muted-foreground">Work Hours</th>
                                                    <th className="px-6 py-4 text-center text-muted-foreground">Status</th>
                                                    <th className="px-6 py-4 text-right text-muted-foreground">Flags</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border bg-background">
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
                                                ) : filteredHistory?.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                                                            No records found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredHistory?.map((record: any) => {
                                                        const isMissedCheckout = !record.checkOut && format(new Date(record.date), 'yyyy-MM-dd') !== today;
                                                        return (
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
                                                                            <span className={cn(
                                                                                "text-foreground",
                                                                                isMissedCheckout && "text-amber-500 font-bold"
                                                                            )}>
                                                                                {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : 
                                                                                 (isMissedCheckout ? 'NA' : '--:--')}
                                                                            </span>
                                                                            <span className="text-muted-foreground text-[10px]">OUT</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <Clock className={cn("w-4 h-4", !record.checkOut ? (isMissedCheckout ? "text-amber-500" : "text-emerald-500") : "text-muted-foreground")} />
                                                                        <span className={cn(
                                                                            "text-sm font-bold text-foreground",
                                                                            isMissedCheckout && "text-amber-500"
                                                                        )}>
                                                                            {isMissedCheckout ? (
                                                                                "NA"
                                                                            ) : (
                                                                                <LiveWorkHours 
                                                                                    checkIn={record.checkIn} 
                                                                                    checkOut={record.checkOut} 
                                                                                    initialWorkHours={record.workHours} 
                                                                                />
                                                                            )}
                                                                        </span>
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
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
