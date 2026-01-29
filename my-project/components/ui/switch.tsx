"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
    ({ className, checked, onCheckedChange, ...props }, ref) => {
        return (
            <div className="relative inline-flex items-center">
                <input
                    type="checkbox"
                    className="sr-only peer"
                    ref={ref}
                    checked={checked}
                    onChange={(e) => onCheckedChange?.(e.target.checked)}
                    {...props}
                />
                <div
                    onClick={() => {
                        // Let the absolute positioning handle the toggle
                    }}
                    className={cn(
                        "w-11 h-6 bg-sidebar-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 transition-colors cursor-pointer",
                        className
                    )}
                ></div>
                <label className="absolute inset-0 cursor-pointer" onClick={() => onCheckedChange?.(!checked)} />
            </div>
        )
    }
)
Switch.displayName = "Switch"

export { Switch }
