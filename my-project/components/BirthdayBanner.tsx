'use client';

import React, { useEffect, useState, useMemo } from 'react';
import axios from '@/lib/axios';
import { X, Gift, Award, TrendingUp, TrendingDown, Briefcase, ChevronLeft, ChevronRight, Loader2, AlertTriangle, UserMinus } from 'lucide-react';

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    dob: string | null;
    joiningDate: string | null;
    image: string | null;
    role: string;
    yesterdayPoints: number;
    yesterdayTaskCount: number;
}

interface BannerEvent {
    id: string;
    type: 'birthday' | 'anniversary' | 'top-performer' | 'worst-performer' | 'suspicious' | 'no-tasks';
    message: React.ReactNode;
    icon: React.ElementType;
    colorClass: string;
}

export function BirthdayBanner() {
    const [events, setEvents] = useState<BannerEvent[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showBannerSetting, setShowBannerSetting] = useState(true);

    useEffect(() => {
        const fetchSettingsAndEmployees = async () => {
            setLoading(true);
            try {
                // Fetch Org Settings first
                const settingsResponse = await axios.get('/organization/settings');
                const showBanner = settingsResponse.data.showBanner;
                setShowBannerSetting(showBanner);

                if (!showBanner) {
                    setLoading(false);
                    return;
                }

                const response = await axios.get('/auth/organization');
                const employees: Employee[] = response.data;
                const newEvents: BannerEvent[] = [];
                const today = new Date();
                const currentYear = today.getFullYear();
                today.setHours(0, 0, 0, 0);

                console.log("Banner: Fetched", employees.length, "employees");

                // --- 1. Birthdays (Nearest Upcoming Only) ---
                let minBdayDiff = Infinity;
                let nextBdayEmployees: Employee[] = [];

                employees.forEach(emp => {
                    if (!emp.dob) return;
                    const dob = new Date(emp.dob);
                    const thisYear = new Date(currentYear, dob.getMonth(), dob.getDate());
                    const nextYear = new Date(currentYear + 1, dob.getMonth(), dob.getDate());
                    let next = thisYear;
                    if (thisYear < today) next = nextYear;

                    const diffDays = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays < minBdayDiff) {
                        minBdayDiff = diffDays;
                        nextBdayEmployees = [emp];
                    } else if (diffDays === minBdayDiff) {
                        nextBdayEmployees.push(emp);
                    }
                });

                if (nextBdayEmployees.length > 0) {
                    const names = nextBdayEmployees.map(e => `${e.firstName} ${e.lastName}`).join(', ');
                    newEvents.push({
                        id: 'birthday-event',
                        type: 'birthday',
                        message: minBdayDiff === 0
                            ? <span>Happy Birthday <span className="font-bold text-yellow-200">{names}</span>! 🎂 Have a fantastic day!</span>
                            : <span>Upcoming Birthday: <span className="font-bold text-yellow-200">{names}</span> in <span className="font-bold">{minBdayDiff} days</span>! 🎈</span>,
                        icon: Gift,
                        colorClass: 'from-pink-600 via-purple-600 to-indigo-600'
                    });
                }

                // --- 2. Work Anniversaries (Today Only) ---
                const anniversaryEmployees = employees.filter(emp => {
                    if (!emp.joiningDate) return false;
                    const join = new Date(emp.joiningDate);
                    if (join.getFullYear() === currentYear) return false;
                    return join.getMonth() === today.getMonth() && join.getDate() === today.getDate();
                });

                if (anniversaryEmployees.length > 0) {
                    const names = anniversaryEmployees.map(e => {
                        const years = currentYear - new Date(e.joiningDate!).getFullYear();
                        return `${e.firstName} (${years} Year${years > 1 ? 's' : ''})`;
                    }).join(', ');

                    newEvents.push({
                        id: 'anniversary-event',
                        type: 'anniversary',
                        message: <span>Happy Work Anniversary <span className="font-bold text-white">{names}</span>! 🎉 Thank you for your dedication!</span>,
                        icon: Briefcase,
                        colorClass: 'from-blue-600 via-cyan-600 to-teal-600'
                    });
                }

                // --- 3. Performance (Yesterday) ---
                const eligibleForPerformance = employees.filter(e => e.role !== 'ADMIN');
                console.log("Banner: Eligible for performance", eligibleForPerformance.length);

                if (eligibleForPerformance.length > 0) {
                    // Separate suspicious vs normal
                    const suspicious = eligibleForPerformance.filter(e => Number(e.yesterdayPoints || 0) > 10);
                    const validPerformance = eligibleForPerformance.filter(e => Number(e.yesterdayPoints || 0) <= 10);

                    // Add Suspicious Activity Banners
                    suspicious.forEach(emp => {
                        newEvents.push({
                            id: `suspicious-${emp.id}`,
                            type: 'suspicious',
                            message: <span>⚠️ Suspicious Activity: <span className="font-bold text-red-200">{emp.firstName} {emp.lastName}</span> completed <span className="font-bold text-white">{emp.yesterdayPoints} points</span> in a single day!</span>,
                            icon: AlertTriangle,
                            colorClass: 'from-red-600 via-red-500 to-red-900'
                        });
                    });

                    // Top Performer (Highest points <= 10)
                    const sortedValid = [...validPerformance].sort((a, b) => Number(b.yesterdayPoints || 0) - Number(a.yesterdayPoints || 0));
                    const topPerformer = sortedValid[0];
                    const topPoints = Number(topPerformer?.yesterdayPoints || 0);

                    if (topPerformer && topPoints > 0) {
                        newEvents.push({
                            id: 'top-performer-event',
                            type: 'top-performer',
                            message: <span>🏆 Star Performer Yesterday: <span className="font-bold text-yellow-300">{topPerformer.firstName} {topPerformer.lastName}</span> with <span className="font-bold">{topPoints} points</span>!</span>,
                            icon: TrendingUp,
                            colorClass: 'from-orange-500 via-red-500 to-pink-500'
                        });
                    }

                    // Worst Performer (Lowest points from all eligible)
                    const sortedAll = [...eligibleForPerformance].sort((a, b) => Number(a.yesterdayPoints || 0) - Number(b.yesterdayPoints || 0));
                    const worstPerformer = sortedAll[0];
                    const worstPoints = Number(worstPerformer?.yesterdayPoints || 0);

                    // Only show worst if they aren't also the top performer or valid top performer
                    if (worstPerformer && worstPerformer.id !== topPerformer?.id && !suspicious.find(s => s.id === worstPerformer.id)) {
                        newEvents.push({
                            id: 'worst-performer-event',
                            type: 'worst-performer',
                            message: <span>Needs Improvement: <span className="font-bold text-gray-200">{worstPerformer.firstName} {worstPerformer.lastName}</span> (Lowest points yesterday: {worstPoints})</span>,
                            icon: TrendingDown,
                            colorClass: 'from-slate-700 via-slate-800 to-slate-900'
                        });
                    }

                    // --- 4. No Tasks Added ---
                    const noTasksEmployees = eligibleForPerformance.filter(e => Number(e.yesterdayTaskCount || 0) === 0);
                    if (noTasksEmployees.length > 0) {
                        const names = noTasksEmployees.map(e => `${e.firstName} ${e.lastName}`).join(', ');
                        newEvents.push({
                            id: 'no-tasks-event',
                            type: 'no-tasks',
                            message: <span>Work Not Assigned: <span className="font-bold text-blue-200">{names}</span> had no tasks yesterday.</span>,
                            icon: UserMinus,
                            colorClass: 'from-gray-600 via-gray-700 to-gray-800'
                        });
                    }
                }

                console.log("Banner: Total Events Created:", newEvents.length);
                setEvents(newEvents);
            } catch (error) {
                console.error('Failed to fetch banner data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSettingsAndEmployees();
    }, []);

    // Rotation Logic
    useEffect(() => {
        if (events.length <= 1 || isPaused) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % events.length);
        }, 2500);

        return () => clearInterval(timer);
    }, [events.length, isPaused]);

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev + 1) % events.length);
    };

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev - 1 + events.length) % events.length);
    };

    if (!isVisible || !showBannerSetting) return null;
    if (loading) return null; // Or a subtle loader if preferred
    if (events.length === 0) return null;

    const currentEvent = events[currentIndex % events.length];
    const Icon = currentEvent.icon;

    return (
        <div
            className={`bg-gradient-to-r ${currentEvent.colorClass} text-white relative overflow-hidden transition-all duration-700 ease-in-out shadow-md group`}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Animated Background Pattern */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
            </div>

            <div className="container mx-auto px-2 md:px-4 py-3 flex items-center justify-between relative z-10 min-h-[50px] gap-2">

                {/* Carousel Controls (Left) */}
                {events.length > 1 && (
                    <button
                        onClick={prevSlide}
                        className="p-1 hover:bg-white/20 rounded-full shrink-0 text-white/75 hover:text-white transition-colors"
                        aria-label="Previous"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                )}

                <div className="flex-1 flex items-center justify-center md:justify-start gap-2 md:gap-3 overflow-hidden">
                    <div className="hidden sm:flex p-2 bg-white/20 rounded-full backdrop-blur-sm shrink-0">
                        <Icon className="h-5 w-5" />
                    </div>
                    <div
                        key={currentEvent.id}
                        className="text-xs md:text-sm font-medium animate-in slide-in-from-bottom-2 fade-in duration-500 text-center md:text-left"
                    >
                        {/* Mobile Icon Inline if needed, or just rely on text */}
                        <span className="sm:hidden inline-flex items-center justify-center p-1 bg-white/20 rounded-full backdrop-blur-sm mr-2 align-middle">
                            <Icon className="h-3 w-3" />
                        </span>
                        {currentEvent.message}
                    </div>
                </div>

                {/* Indicators (Desktop Only) */}
                {events.length > 1 && (
                    <div className="hidden lg:flex gap-1.5 mx-4">
                        {events.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-white w-4' : 'bg-white/40 hover:bg-white/60'}`}
                            />
                        ))}
                    </div>
                )}

                {/* Carousel Controls (Right) & Close */}
                <div className="flex items-center gap-1 md:gap-2 shrink-0">
                    {events.length > 1 && (
                        <button
                            onClick={nextSlide}
                            className="p-1 hover:bg-white/20 rounded-full text-white/75 hover:text-white transition-colors"
                            aria-label="Next"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    )}
                    <button
                        onClick={() => setIsVisible(false)}
                        className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-full ml-1"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
