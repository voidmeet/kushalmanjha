"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function KiteIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("w-6 h-6", className)}
            {...props}
        >
            <path d="M12 2L2 12l10 10 10-10L12 2z" />
            <path d="M12 2v20" />
            <path d="M2 12h20" />
        </svg>
    );
}

export function ThreadSpoolIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("w-6 h-6", className)}
            {...props}
        >
            <path d="M7 4h10v16H7z" />
            <path d="M7 6h10" />
            <path d="M7 10h10" />
            <path d="M7 14h10" />
            <path d="M7 18h10" />
            <path d="M5 4h2" />
            <path d="M17 4h2" />
            <path d="M5 20h2" />
            <path d="M17 20h2" />
        </svg>
    );
}

export function BackgroundPattern({ className }: { className?: string }) {
    return (
        <div className={cn("absolute inset-0 -z-10 overflow-hidden opacity-[0.03] pointer-events-none", className)}>
            <div className="absolute top-10 left-10 transform -rotate-12">
                <KiteIcon className="w-24 h-24 text-primary" />
            </div>
            <div className="absolute top-1/4 right-20 transform rotate-45">
                <ThreadSpoolIcon className="w-16 h-16 text-primary" />
            </div>
            <div className="absolute bottom-20 left-1/3 transform rotate-12">
                <KiteIcon className="w-32 h-32 text-primary" />
            </div>
            <div className="absolute bottom-10 right-10 transform -rotate-6">
                <ThreadSpoolIcon className="w-20 h-20 text-primary" />
            </div>
            <div className="absolute top-1/2 left-10 transform rotate-90">
                <KiteIcon className="w-12 h-12 text-primary" />
            </div>
            <div className="absolute top-10 right-1/3 transform -rotate-45">
                <KiteIcon className="w-16 h-16 text-primary" />
            </div>
        </div>
    );
}
