'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Trophy, Target, Calendar, MessageSquare, CheckCircle2, Star, TrendingUp } from 'lucide-react';
import { getProxiedImageUrl } from '@/lib/imageProxy';
import Image from 'next/image';

interface Tip {
    type: string;
    message: string;
    icon: string;
}

interface StarPerformer {
    name: string;
    points: number;
    image?: string;
}

interface MyStats {
    avgPointsPerDay: number;
    activeDays: number;
    completedTasks: number;
    totalAssigned: number;
    completionRate: number;
    commentRate: number;
    tips: Tip[];
    randomPlatformTip?: Tip;
}

interface LoginPopupData {
    starPerformer: StarPerformer | null;
    myStats: MyStats;
}

interface Props {
    popupData: LoginPopupData;
    onClose: () => void;
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
    target: Target,
    calendar: Calendar,
    message: MessageSquare,
    check: CheckCircle2,
    star: Star,
};

const tipColors: Record<string, string> = {
    points: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    consistency: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    comments: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    completion: 'text-red-400 bg-red-500/10 border-red-500/20',
    great: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

/**
 * LoginPerformancePopup — shown once per session after employee logs in.
 * Displays the org's star performer for last month and personalized tips.
 */
export function LoginPerformancePopup({ popupData, onClose }: Props) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Animate in
        const t = setTimeout(() => setVisible(true), 50);
        return () => clearTimeout(t);
    }, []);

    const handleClose = useCallback(() => {
        setVisible(false);
        // Wait for exit animation before calling onClose
        setTimeout(onClose, 300);
    }, [onClose]);

    const { starPerformer, myStats } = popupData;

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ${visible ? 'bg-black/70 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-none'
                }`}
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
            <div
                className={`relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
                    }`}
            >
                {/* Glow accent */}
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-10 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Close"
                >
                    <X className="h-4 w-4" />
                </button>

                {/* Header */}
                <div className="relative px-6 pt-6 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-5 w-5 text-blue-400" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                            Monthly Performance Review
                        </span>
                    </div>
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                        Welcome back! Here&apos;s your summary.
                    </h2>
                </div>

                {/* Star Performer Banner */}
                {starPerformer && (
                    <div className="mx-6 mb-4 relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-orange-500/20 border border-amber-500/30 p-4 flex items-center gap-4">
                        <div className="relative flex-shrink-0">
                            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-amber-500/50 bg-amber-500/10 shadow-lg">
                                {starPerformer.image ? (
                                    <Image
                                        src={getProxiedImageUrl(starPerformer.image)}
                                        alt={starPerformer.name}
                                        width={56}
                                        height={56}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-amber-500/20 text-amber-500 font-bold text-xl uppercase">
                                        {starPerformer.name.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-md border border-amber-100/20">
                                <Trophy className="h-3.5 w-3.5 text-white" />
                            </div>
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider mb-0.5">
                                ⭐ Star Performer — Last Month
                            </p>
                            <p className="text-base font-bold text-foreground truncate">{starPerformer.name}</p>
                            <p className="text-xs text-amber-400 font-medium">{starPerformer.points} points earned</p>
                        </div>
                    </div>
                )}

                {/* Tips Section */}
                <div className="px-6 pb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        💡 Tips to improve your performance
                    </p>
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                        {myStats.tips.map((tip, i) => {
                            const IconComponent = iconMap[tip.icon] || Target;
                            const colorClass = tipColors[tip.type] || tipColors.great;
                            return (
                                <div
                                    key={i}
                                    className={`flex items-start gap-3 p-3 rounded-xl border ${colorClass} transition-all duration-200 animate-in fade-in slide-in-from-bottom-2`}
                                    style={{ animationDelay: `${i * 80}ms` }}
                                >
                                    <IconComponent className="h-4 w-4 shrink-0 mt-0.5" />
                                    <p className="text-sm leading-relaxed">{tip.message}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Random Platform Tip Section */}
                {myStats.randomPlatformTip && (
                    <div className="mx-6 mb-2 mt-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: '400ms' }}>
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <Star className="h-4 w-4 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                PRO TIP
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {myStats.randomPlatformTip.message}
                            </p>
                        </div>
                    </div>
                )}

                {/* Stats Bar */}
                <div className="mx-6 mt-4 mb-4 grid grid-cols-3 gap-2">
                    {[
                        { label: 'Avg pts/day', value: myStats.avgPointsPerDay, suffix: '', good: myStats.avgPointsPerDay >= 8 },
                        { label: 'Completion', value: myStats.completionRate, suffix: '%', good: myStats.completionRate >= 70 },
                        { label: 'Tasks done', value: myStats.completedTasks, suffix: '', good: true },
                    ].map((stat) => (
                        <div key={stat.label} className="bg-muted/50 border border-border rounded-xl p-2.5 text-center">
                            <p className={`text-lg font-bold ${stat.good ? 'text-emerald-400' : 'text-orange-400'}`}>
                                {stat.value}{stat.suffix}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div className="px-6 pb-6">
                    <button
                        onClick={handleClose}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                    >
                        Got it, let&apos;s go! 🚀
                    </button>
                </div>
            </div>
        </div>
    );
}
