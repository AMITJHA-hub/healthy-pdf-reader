'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useState, Suspense, useRef, useEffect } from 'react';
import WebcamMonitor from '@/components/WebcamMonitor';
import DistanceBar from '@/components/DistanceBar';
import HealthAlert, { AlertType } from '@/components/HealthAlert';
import { HealthProvider, useHealth } from '@/context/HealthContext';
import { ShieldCheck, Activity, Ruler, ChevronRight, Eye, ChevronLeft, LayoutTemplate, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc, increment, arrayUnion, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getLocalFile } from '@/lib/db';

// Dynamic import to avoid SSR issues with canvas/pdf
const PDFReader = dynamic(() => import('@/components/PDFReader'), {
    ssr: false,
    loading: () => <div className="text-center p-10">Initializing Reader...</div>
});

function ReaderContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const url = searchParams.get('url');
    const filename = searchParams.get('filename');
    const fileId = searchParams.get('fileId');
    const { user } = useAuth();

    const {
        setDistanceData,
        setBrightness,
        setFacePosition,
        setBaseline,
        distance,
        distanceStatus,
        baselineY,
        stressScore,
        setStressSignals,
        detectedEmotion
    } = useHealth();

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [alertType, setAlertType] = useState<AlertType | null>(null);
    const [blinkRate, setBlinkRate] = useState(0);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);

    // --- Load Local File Effect ---
    useEffect(() => {
        let objectUrl: string | null = null;
        
        const loadFile = async () => {
            if (url && url.startsWith('local://')) {
                const id = url.replace('local://', '');
                try {
                    const blob = await getLocalFile(id);
                    if (blob) {
                        objectUrl = URL.createObjectURL(blob);
                        setBlobUrl(objectUrl);
                    } else {
                        // Use warn instead of error to prevent Next.js dev overlay
                        console.warn("Local file not found in IndexedDB");
                        setFileError("File not found on this device. Please upload it again.");
                    }
                } catch (err) {
                    // Use warn instead of error to prevent Next.js dev overlay
                    console.warn("Error loading local file:", err);
                    setFileError("Error loading file. Please try again.");
                }
            } else if (url) {
                setBlobUrl(url); // Use remote URL directly
            } else {
                setFileError("No file URL provided.");
            }
        };
        loadFile();

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [url]);

    // Alert Throttling
    const lastAlertTimeRef = useRef<number>(0);
    const timeSinceStartRef = useRef<number>(Date.now());

    // --- Screen Time & Streak Tracking ---
    const sessionStartTimeRef = useRef<number>(Date.now());
    const hasIncrementedStreakRef = useRef(false);

    useEffect(() => {
        if (!user || !fileId) return;
        
        sessionStartTimeRef.current = Date.now();
        hasIncrementedStreakRef.current = false;

        const syncSessionStats = async () => {
            const now = Date.now();
            const elapsedSeconds = Math.floor((now - sessionStartTimeRef.current) / 1000);
            if (elapsedSeconds < 1) return; 

            sessionStartTimeRef.current = now; 

            try {
                const statsRef = doc(db, 'users', user.uid, 'stats', 'summary');
                const fileRef = doc(db, 'users', user.uid, 'files', fileId);
                
                const statsSnap = await getDoc(statsRef);
                let streakIncrement = 0;
                let resetStreak = false;

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (statsSnap.exists()) {
                    const data = statsSnap.data();
                    if (data.lastActive) {
                        const lastActiveDate = new Date(data.lastActive);
                        lastActiveDate.setHours(0, 0, 0, 0);
                        const diffDays = Math.round((today.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24));
                        
                        if (!hasIncrementedStreakRef.current) {
                            if (diffDays === 1) streakIncrement = 1;
                            else if (diffDays > 1) resetStreak = true;
                            hasIncrementedStreakRef.current = true;
                        }
                    } else if (!hasIncrementedStreakRef.current) {
                        streakIncrement = 1;
                        hasIncrementedStreakRef.current = true;
                    }
                } else if (!hasIncrementedStreakRef.current) {
                    streakIncrement = 1;
                    hasIncrementedStreakRef.current = true;
                }

                const updates: any = {
                    totalScreenTime: increment(elapsedSeconds),
                    lastActive: new Date().toISOString()
                };

                if (resetStreak) updates.streak = 1;
                else if (streakIncrement > 0) updates.streak = increment(streakIncrement);

                await updateDoc(statsRef, updates);
                await updateDoc(fileRef, { lastOpenedAt: new Date().toISOString() });
            } catch(e) { console.error("Stats sync failed:", e); }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                syncSessionStats();
            } else if (document.visibilityState === 'visible') {
                sessionStartTimeRef.current = Date.now();
            }
        };

        const handleBeforeUnload = () => syncSessionStats();

        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        // Initial Mount Update 
        updateDoc(doc(db, 'users', user.uid, 'files', fileId), { lastOpenedAt: new Date().toISOString() }).catch(console.error);

        return () => {
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            syncSessionStats(); // Final sync on unmount
        };
    }, [user, fileId]);

    // --- Page Tracking ---
    const [isTrackingReady, setIsTrackingReady] = useState(false);
    const currentPageRef = useRef<number>(1);
    const viewedPagesRef = useRef<Set<number>>(new Set());

    useEffect(() => {
        if (!user || !fileId) return;
        const fetchViewedPages = async () => {
            try {
                const snapshot = await getDoc(doc(db, 'users', user.uid, 'files', fileId));
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    if (data.viewedPages && Array.isArray(data.viewedPages)) {
                        viewedPagesRef.current = new Set(data.viewedPages);
                    }
                }
            } catch (error) {
                console.error("Error fetching viewed pages:", error);
            } finally {
                setIsTrackingReady(true); // Allow page tracking ONLY after load
            }
        };
        fetchViewedPages();
    }, [user, fileId]);

    const handlePageChange = (page: number) => {
        if (!user || !fileId || !isTrackingReady) return;
        currentPageRef.current = page;

        if (!viewedPagesRef.current.has(page)) {
            viewedPagesRef.current.add(page);
            
            updateDoc(doc(db, 'users', user.uid, 'files', fileId), {
                viewedPages: arrayUnion(page),
                pagesRead: increment(1),
                currentPage: page
            }).catch(console.error);

            updateDoc(doc(db, 'users', user.uid, 'stats', 'summary'), {
                totalPagesRead: increment(1)
            }).catch(console.error);
        } else {
            // Unviewed, but update resume pointer
            updateDoc(doc(db, 'users', user.uid, 'files', fileId), {
                currentPage: page
            }).catch(console.error);
        }
    };

    const handleTotalPages = (total: number) => {
        if (!user || !fileId) return;
        updateDoc(doc(db, 'users', user.uid, 'files', fileId), {
            totalPages: total
        }).catch(error => console.error("Error updating total pages:", error));
    };

    const handleBlinkRate = (bpm: number) => {
        setBlinkRate(bpm);
        const now = Date.now();
        if (now - timeSinceStartRef.current < 30000) return;
        if (bpm < 12 && bpm > 0) {
            if (now - lastAlertTimeRef.current > 120000) {
                setAlertType('BLINK');
                lastAlertTimeRef.current = now;
            }
        }
    };

    if (fileError) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground space-y-6">
                <div className="text-red-400 font-medium text-lg">{fileError}</div>
                <button 
                    onClick={() => router.push('/dashboard')}
                    className="px-6 py-2 bg-black/5 hover:bg-black/5 border border-border text-foreground rounded-lg transition-all"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    if (!blobUrl) {
        return <div className="h-screen flex items-center justify-center bg-background text-muted-foreground">Loading file...</div>;
    }

    return (
        <div className="h-screen w-screen flex relative bg-background overflow-hidden">

            {/* Health Alert Overlay */}
            <HealthAlert type={alertType} onDismiss={() => setAlertType(null)} />

            {/* Main PDF Area */}
            <div className={`flex-1 h-full relative transition-all duration-500 ease-in-out ${isSidebarOpen ? 'mr-0' : ''}`}>
                <PDFReader
                    url={blobUrl || url || ''}
                    onPageChange={handlePageChange}
                    onTotalPages={handleTotalPages}
                />

                {/* Floating sidebar toggle button (visible when sidebar closed) */}
                <AnimatePresence>
                    {!isSidebarOpen && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onClick={() => setIsSidebarOpen(true)}
                            className="absolute top-6 right-6 z-[60] p-3 bg-primary/20 backdrop-blur-lg border border-primary/30 rounded-full hover:bg-primary/30 transition-all shadow-lg text-primary group"
                            title="Open Health Monitor"
                        >
                            <Activity className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Right Sidebar Panel */}
            <motion.div
                initial={{ width: 320, opacity: 1 }}
                animate={{
                    width: isSidebarOpen ? 320 : 0,
                    opacity: isSidebarOpen ? 1 : 0,
                    x: isSidebarOpen ? 0 : 20
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="h-full bg-background backdrop-blur-2xl border-l border-border shadow-2xl z-50 flex flex-col relative overflow-hidden"
            >
                {/* Sidebar Header */}
                <div className="p-5 border-b border-border flex justify-between items-center bg-black/5">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                        <span className="font-bold text-sm tracking-wide text-muted-foreground">HEALTH MONITOR</span>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-2 hover:bg-black/5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                        title="Minimize Sidebar"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable Widget Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">

                    {/* Stress Widget */}
                    <div className="bg-black/5 rounded-2xl p-4 border border-border hover:border-primary/20 transition-colors group">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-3 h-3 text-cyan-400" /> Stress
                            </h3>
                            <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${stressScore < 50 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {Math.round(stressScore)}%
                            </span>
                        </div>
                        <div className="w-full h-2 bg-secondary/40 rounded-full overflow-hidden mb-2">
                            <motion.div
                                className={`h-full rounded-full ${stressScore < 50 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-orange-500 to-red-500'}`}
                                animate={{ width: `${stressScore}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        {detectedEmotion && (
                            <div className="text-center mt-2">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide mr-2">Detected:</span>
                                <span className="text-xs font-medium text-muted-foreground">{detectedEmotion}</span>
                            </div>
                        )}
                    </div>

                    {/* Blink Rate Widget */}
                    <div className="bg-black/5 rounded-2xl p-4 border border-border hover:border-blue-500/20 transition-colors">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Eye className="w-3 h-3 text-blue-400" /> Blinks
                        </h3>
                        <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-bold text-foreground">{blinkRate}</span>
                            <span className="text-xs text-muted-foreground">per min</span>
                        </div>
                    </div>

                    {/* Distance Widget */}
                    <div className="bg-black/5 rounded-2xl p-4 border border-border hover:border-indigo-500/20 transition-colors">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Ruler className="w-3 h-3 text-indigo-400" /> Distance
                        </h3>
                        <DistanceBar distance={distance} status={distanceStatus} />
                    </div>

                    {/* Posture Widget */}
                    <div className="bg-black/5 rounded-2xl p-4 border border-border">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                            <ShieldCheck className="w-3 h-3 text-teal-400" /> Posture
                        </h3>
                        <button
                            onClick={setBaseline}
                            className={`w-full py-2.5 rounded-xl border text-xs font-medium transition-all shadow-lg
                                ${baselineY
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse'
                                }`}
                        >
                            {baselineY ? 'Recalibrate' : 'Set Baseline'}
                        </button>
                    </div>

                </div>

                {/* Webcam Feed (Always visible at bottom of sidebar) */}
                <div className="p-4 bg-secondary/40 border-t border-border">
                    <div className="rounded-xl overflow-hidden border border-border shadow-lg relative h-32 bg-black">
                        <WebcamMonitor
                            onDistanceChange={setDistanceData}
                            onBrightnessChange={setBrightness}
                            onFacePositionChange={setFacePosition}
                            onStressSignals={setStressSignals}
                            onBlinkRateChange={handleBlinkRate}
                        />
                        <div className="absolute top-2 right-2 flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-red-500/50" />
                        </div>
                    </div>
                </div>

            </motion.div>
        </div>
    );
}

export default function ReadPage() {
    return (
        <HealthProvider>
            <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-background text-cyan-500">Loading Reader...</div>}>
                <ReaderContent />
            </Suspense>
        </HealthProvider>
    );
}
