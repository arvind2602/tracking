import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const SummaryCard = memo(function SummaryCard({ title, value, icon, onClick, className }: SummaryCardProps) {
  return (
    <div
      className={cn(
        "relative group overflow-hidden backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:shadow-2xl hover:shadow-blue-500/10",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {/* Decorative Glow */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500"></div>

      <div className="flex items-center justify-between mb-4">
        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 shadow-inner">
          {icon}
        </div>
        <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors uppercase tracking-wider">{title}</p>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 w-0 group-hover:w-full transition-all duration-500"></div>
    </div>
  );
});

