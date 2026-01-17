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
        "relative group overflow-hidden bg-card border border-border rounded-2xl md:rounded-3xl p-4 md:p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {/* Decorative Glow */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-500"></div>

      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-secondary border border-border/50 shadow-inner">
          {icon}
        </div>
        <div className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{value}</div>
      </div>

      <div>
        <p className="text-xs md:text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-wider">{title}</p>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 w-0 group-hover:w-full transition-all duration-500"></div>
    </div>
  );
});


