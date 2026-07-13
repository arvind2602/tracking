'use client';

import React, { useState, useEffect } from 'react';
import { LeaveHistory } from '@/components/attendance/LeaveHistory';
import {
    PlaneTakeoff,
} from 'lucide-react';
import { jwtDecode } from 'jwt-decode';

export default function AttendancePage() {
    const [userRole, setUserRole] = useState<string>('USER');

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                const role = decoded?.user?.role;
                if (role) {
                    setUserRole(role);
                }
            } catch (error) {
                console.error('Invalid token', error);
            }
        }
    }, []);

    const isAdmin = userRole === 'ADMIN';

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <PlaneTakeoff className="w-8 h-8 text-primary" />
                        Leave Management
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium">
                        Submit and track leave requests, and manage employee absences.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Left Section: Policy Information */}
                <div className="lg:col-span-1 space-y-6">
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
                </div>

                {/* Right Section: Main Leave History */}
                <div className="lg:col-span-3 space-y-6">
                    <LeaveHistory isAdmin={isAdmin} />
                </div>
            </div>
        </div>
    );
}
