"use client";

import { X, AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "destructive" | "default";
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "destructive",
}: ConfirmationModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] transition-all duration-300">
            <div
                ref={modalRef}
                className="bg-card/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl w-full max-w-md border border-white/10 z-[10000] relative animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-white/5"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="flex flex-col items-center text-center p-2">
                    <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>

                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-3">
                        {title}
                    </h2>

                    <p className="text-muted-foreground mb-8 leading-relaxed">
                        {description}
                    </p>

                    <div className="flex gap-4 w-full">
                        <Button
                            variant="outline"
                            className="flex-1 rounded-full border-white/10 hover:bg-white/5 hover:text-white"
                            onClick={onClose}
                        >
                            {cancelText}
                        </Button>
                        <Button
                            variant={variant}
                            className={`flex-1 rounded-full shadow-lg ${variant === "destructive"
                                    ? "bg-red-600 hover:bg-red-700 shadow-red-500/20"
                                    : "bg-primary hover:bg-primary/90 shadow-primary/20"
                                }`}
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                        >
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
