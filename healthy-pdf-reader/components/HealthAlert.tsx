'use client';

import { AlertTriangle, Eye, Ruler, Droplets, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

export type AlertType = 'BLINK' | 'DISTANCE' | 'POSTURE' | 'BREAK' | 'HYDRATION';

interface HealthAlertProps {
    type: AlertType | null;
    onDismiss: () => void;
}

const ALERT_CONFIG = {
    BLINK: {
        icon: <Eye className="w-8 h-8" />,
        title: "Blink Check!",
        message: "Your blink rate is low. Take a moment to blink and look around.",
        color: "bg-blue-600"
    },
    DISTANCE: {
        icon: <Ruler className="w-8 h-8" />,
        title: "Adjust Your Distance",
        message: "Keep about 40–60 cm from the screen. Please adjust your position.",
        color: "bg-red-600"
    },
    POSTURE: {
        icon: <AlertTriangle className="w-8 h-8" />,
        title: "Check Posture",
        message: "Sit up straight to avoid back pain and neck strain.",
        color: "bg-yellow-600"
    },
    BREAK: {
        icon: <AlertTriangle className="w-8 h-8" />,
        title: "Time for a Break",
        message: "Follow the 20-20-20 rule. Look away for 20 seconds.",
        color: "bg-green-600"
    },
    HYDRATION: {
        icon: <Droplets className="w-8 h-8" />,
        title: "Drink Water",
        message: "Stay hydrated for better focus and eye health.",
        color: "bg-cyan-600"
    }
};

export default function HealthAlert({ type, onDismiss }: HealthAlertProps) {
    // Auto-dismiss after 8 seconds (longer for modals)
    useEffect(() => {
        if (type) {
            const timer = setTimeout(onDismiss, 8000);
            return () => clearTimeout(timer);
        }
    }, [type, onDismiss]);

    return (
        <AnimatePresence>
            {type && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onDismiss}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-md bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        <div className={`p-6 text-white flex flex-col items-center justify-center text-center gap-4 ${ALERT_CONFIG[type].color}`}>
                            <div className="p-4 bg-white/20 rounded-full backdrop-blur-md">
                                {ALERT_CONFIG[type].icon}
                            </div>
                            <h2 className="text-2xl font-bold">{ALERT_CONFIG[type].title}</h2>
                        </div>

                        <div className="p-8 text-center space-y-6">
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                {ALERT_CONFIG[type].message}
                            </p>

                            <button
                                onClick={onDismiss}
                                className="w-full py-3 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
                            >
                                Noted, thanks!
                            </button>
                        </div>

                        <button
                            onClick={onDismiss}
                            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
