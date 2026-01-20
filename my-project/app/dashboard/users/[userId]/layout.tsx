"use client";

import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Code } from "lucide-react";
import React, { useEffect, useState } from 'react';
import axios from "@/lib/axios";
import Breadcrumbs from "@/components/ui/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";

export default function UserLayout({ children, params }: { children: React.ReactNode; params: { userId: string } }) {
    const router = useRouter();
    const pathname = usePathname();
    const { userId } = React.use(params);
    const [user, setUser] = useState<{ firstName: string; lastName: string } | null>(null);
    const [loading, setLoading] = useState(true);

    // Determine current tab based on the last segment of the path
    const currentTab = pathname?.split('/').pop() || 'profile';

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await axios.get(`/auth/${userId}`);
                setUser(response.data);
            } catch (error) {
                console.error("Failed to fetch user for layout:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, [userId]);

    const breadcrumbItems = [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Users", href: "/dashboard/users" },
        { label: user ? `${user.firstName} ${user.lastName}` : "User", href: `/dashboard/users/${userId}/profile` },
    ];

    const getPageHeader = () => {
        if (currentTab === 'tasks') {
            return {
                title: 'User Tasks',
                description: "Manage and track user's assigned tasks and progress."
            };
        }
        return {
            title: 'User Profile',
            description: "View user's personal information and professional details."
        };
    };

    const header = getPageHeader();

    return (
        <div className="space-y-6">
            {loading ? (
                <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
            ) : (
                <>
                    <Breadcrumbs items={breadcrumbItems} />
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                                {header.title}
                            </h1>
                            <p className="text-muted-foreground mt-1">{header.description}</p>
                        </div>
                    </div>
                </>
            )}

            <Tabs value={currentTab} onValueChange={(val) => router.push(`/dashboard/users/${userId}/${val}`)} className="w-full">
                <TabsList className="bg-secondary border border-border rounded-xl p-1 w-full max-w-sm">
                    <TabsTrigger
                        value="profile"
                        className="flex-1 gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-300"
                    >
                        <User className="h-4 w-4" />
                        Profile
                    </TabsTrigger>
                    <TabsTrigger
                        value="tasks"
                        className="flex-1 gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-300"
                    >
                        <Code className="h-4 w-4" />
                        Tasks
                    </TabsTrigger>
                </TabsList>
            </Tabs>
            {children}
        </div>
    )
}
