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
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);

    // Header auto-hide timeout
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        const resetTimer = () => {
            setIsHeaderVisible(true);
            clearTimeout(timeout);
            timeout = setTimeout(() => setIsHeaderVisible(false), 3000);
        };

        window.addEventListener('mousemove', resetTimer);
        resetTimer();

        return () => {
            window.removeEventListener('mousemove', resetTimer);
            clearTimeout(timeout);
        };
    }, []);

    // --- Load Local File Effect ---
    useEffect(() => {
        const loadFile = async () => {
            if (url && url.startsWith('local://')) {
                const id = url.replace('local://', '');
                try {
                    const blob = await getLocalFile(id);
                    if (blob) {
                        const objectUrl = URL.createObjectURL(blob);
                        setBlobUrl(objectUrl);
                    } else {
                        console.error("Local file not found in IndexedDB");
                        alert("File not found on this device. Please upload it again.");
                    }
                } catch (err) {
                    console.error("Error loading local file:", err);
                }
            } else if (url) {
                setBlobUrl(url); // Use remote URL directly
            }
        };
        loadFile();

        return () => {
            if (blobUrl && blobUrl.startsWith('blob:')) {
                URL.revokeObjectURL(blobUrl);
            }
        };
    }, [url]);

    // Alert Throttling
    const lastAlertTimeRef = useRef<number>(0);
    const timeSinceStartRef = useRef<number>(Date.now());

    useEffect(() => {
        if (!user || !fileId) return;
        const initSession = async () => {
            updateDoc(doc(db, 'users', user.uid, 'files', fileId), {
                lastOpenedAt: new Date().toISOString()
            }).catch(console.error);
        };
        initSession();

        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                updateDoc(doc(db, 'users', user.uid, 'stats', 'summary'), {
                    totalScreenTime: increment(10),
                    lastActive: new Date().toISOString()
                }).catch(e => { });
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [user, fileId]);

    // Page Tracking
    const currentPageRef = useRef<number>(1);
    const viewedPagesRef = useRef<Set<number>>(new Set());

    useEffect(() => {
        if (!user || !fileId) return;
        const fetchViewedPages = async () => {
            try {
                const docRef = doc(db, 'users', user.uid, 'files', fileId);
                const snapshot = await getDoc(docRef);
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    if (data.viewedPages && Array.isArray(data.viewedPages)) {
                        viewedPagesRef.current = new Set(data.viewedPages);
                    }
                }
            } catch (error) {
                console.error("Error fetching viewed pages", error);
            }
        };
        fetchViewedPages();
    }, [user, fileId]);

    const handlePageChange = (page: number) => {
        if (!user || !fileId) return;
        currentPageRef.current = page;

        if (!viewedPagesRef.current.has(page)) {
            viewedPagesRef.current.add(page);
            setTimeout(() => {
                if (currentPageRef.current === page) {
                    confirmPageView(page);
                }
            }, 300);
        }

        updateDoc(doc(db, 'users', user.uid, 'files', fileId), {
            currentPage: page
        }).catch(console.error);
    };

    const confirmPageView = (page: number) => {
        if (!user || !fileId) return;
        updateDoc(doc(db, 'users', user.uid, 'files', fileId), {
            viewedPages: arrayUnion(page),
            pagesRead: increment(1)
        }).catch(console.error);
        updateDoc(doc(db, 'users', user.uid, 'stats', 'summary'), {
            totalPagesRead: increment(1)
        }).catch(console.error);
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

    if (!blobUrl && !url) {
        return <div className="h-screen flex items-center justify-center text-muted-foreground">Loading file...</div>;
    }

    return (
        <div className="h-screen w-screen flex relative bg-[#090e1a] overflow-hidden">

            {/* Health Alert Overlay */}
            <HealthAlert type={alertType} onDismiss={() => setAlertType(null)} />

            {/* Top Navigation Bar (Auto-hiding) */}
            <motion.header
                initial={{ y: -100 }}
                animate={{ y: isHeaderVisible ? 0 : -100 }}
                transition={{ duration: 0.3 }}
                className="absolute top-0 left-0 right-0 z-[60] p-4 flex justify-between items-start pointer-events-none"
            >
                <div className="pointer-events-auto">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="group flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white/80 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-lg"
                    >
                        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium text-sm">Dashboard</span>
                    </button>
                    {filename && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-2 ml-1 text-xs text-white/50 px-2 truncate max-w-[200px]"
                        >
                            {decodeURIComponent(filename)}
                        </motion.div>
                    )}
                </div>
            </motion.header>

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
                className="h-full bg-[#0B0F19]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl z-50 flex flex-col relative overflow-hidden"
            >
                {/* Sidebar Header */}
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                        <span className="font-bold text-sm tracking-wide text-white/90">HEALTH MONITOR</span>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-white transition-colors"
                        title="Minimize Sidebar"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable Widget Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">

                    {/* Stress Widget */}
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:border-primary/20 transition-colors group">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-3 h-3 text-cyan-400" /> Stress
                            </h3>
                            <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${stressScore < 50 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {Math.round(stressScore)}%
                            </span>
                        </div>
                        <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden mb-2">
                            <motion.div
                                className={`h-full rounded-full ${stressScore < 50 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-orange-500 to-red-500'}`}
                                animate={{ width: `${stressScore}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        {detectedEmotion && (
                            <div className="text-center mt-2">
                                <span className="text-[10px] text-white/40 uppercase tracking-wide mr-2">Detected:</span>
                                <span className="text-xs font-medium text-white/80">{detectedEmotion}</span>
                            </div>
                        )}
                    </div>

                    {/* Blink Rate Widget */}
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:border-blue-500/20 transition-colors">
                        <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Eye className="w-3 h-3 text-blue-400" /> Blinks
                        </h3>
                        <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-bold text-white">{blinkRate}</span>
                            <span className="text-xs text-muted-foreground">per min</span>
                        </div>
                    </div>

                    {/* Distance Widget */}
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:border-indigo-500/20 transition-colors">
                        <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Ruler className="w-3 h-3 text-indigo-400" /> Distance
                        </h3>
                        <DistanceBar distance={distance} status={distanceStatus} />
                    </div>

                    {/* Posture Widget */}
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                        <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
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
                <div className="p-4 bg-black/40 border-t border-white/5">
                    <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg relative h-32 bg-black">
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
            <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-[#090e1a] text-cyan-500">Loading Reader...</div>}>
                <ReaderContent />
            </Suspense>
        </HealthProvider>
    );
}
