'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, BookOpen, Clock, Activity, Zap, ChevronRight, Play, Star, FileText, Trophy, Target, Check, Trash2, StopCircle, RotateCcw, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { collection, onSnapshot, addDoc, query, orderBy, where, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { saveLocalFile, deleteLocalFile } from '@/lib/db';

// --- Variants ---
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

// --- Components ---

const BookUpload = ({ onUpload, progress }: { onUpload: (file: File) => void, progress: number }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            onUpload(file);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type === 'application/pdf') {
            onUpload(file);
        }
    };

    return (
        <motion.div
            variants={itemVariants}
            className="group relative h-80 w-full cursor-pointer"
            onClick={() => progress === 0 && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
        >
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />

            <div className={`h-full border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center transition-all duration-300 overflow-hidden relative
                ${isDragging
                    ? 'border-primary bg-primary/10 shadow-[0_0_30px_rgba(59,130,246,0.3)] scale-[1.02]'
                    : 'border-white/10 bg-white/[0.02] hover:border-primary/50 hover:bg-white/[0.04]'
                }`}
            >
                {progress > 0 && progress < 100 ? (
                    <div className="flex flex-col items-center gap-6 relative z-10">
                        <div className="relative">
                            <div className="w-20 h-20 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center font-mono text-primary font-bold">
                                {Math.round(progress)}%
                            </div>
                        </div>
                        <div className="text-sm text-muted-foreground animate-pulse">Uploading to Secure Storage...</div>
                    </div>
                ) : (
                    <>
                        {/* Background Glow */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-accent/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                        <div className={`w-20 h-20 mb-6 rounded-2xl flex items-center justify-center shadow-2xl z-10 transition-all duration-300
                            ${isDragging ? 'bg-primary text-white scale-110 rotate-12' : 'bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 group-hover:scale-110 group-hover:-rotate-3'}`}
                        >
                            <Upload className={`w-8 h-8 transition-colors ${isDragging ? 'text-white' : 'text-zinc-400 group-hover:text-primary'}`} />
                        </div>

                        <div className="text-center z-10 space-y-2">
                            <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                                {isDragging ? 'Drop to Open Book' : 'Upload PDF'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Drag & drop or click to browse
                            </p>
                        </div>
                    </>
                )}
            </div>
        </motion.div>
    );
};

const LibraryCard = ({ file, onClick, onDelete }: { file: any, onClick: () => void, onDelete: (e: React.MouseEvent) => void }) => {
    const isExpired = new Date(file.expiryTimestamp) < new Date();
    const daysLeft = Math.ceil((new Date(file.expiryTimestamp).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const progress = Math.round((file.pagesRead / (file.totalPages || 1)) * 100);

    if (isExpired) return null;

    return (
        <motion.div
            layout
            variants={itemVariants}
            initial="hidden"
            animate="show"
            whileHover={{ scale: 1.02, y: -2 }}
            onClick={onClick}
            className="group relative flex flex-col sm:flex-row items-center gap-5 p-4 rounded-[1.5rem] bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-primary/20 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)] transition-all cursor-pointer overflow-hidden"
        >
            {/* Progress Bar Background */}
            <div className="absolute bottom-0 left-0 h-[2px] w-full bg-white/5">
                <motion.div
                    className="h-full bg-gradient-to-r from-primary to-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                />
            </div>

            {/* Thumbnail Icon */}
            <div className="relative w-full sm:w-20 h-24 sm:h-20 rounded-2xl border border-white/5 flex items-center justify-center shrink-0 z-10 bg-gradient-to-br from-white/5 to-white/[0.01] group-hover:from-primary/20 group-hover:to-accent/20 transition-colors">
                <FileText className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
            </div>

            {/* Content */}
            <div className="flex-1 text-center sm:text-left w-full z-10 min-w-0 space-y-1">
                <h3 className="font-bold text-lg text-foreground truncate px-1 group-hover:text-primary transition-colors">{file.fileName}</h3>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-medium text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" /> {daysLeft}d left
                    </span>
                    <span className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-full">
                        {progress}% Read
                    </span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mr-2 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                <button 
                    onClick={onDelete}
                    className="p-3 rounded-full bg-white/5 text-muted-foreground hover:bg-red-500/20 hover:text-red-400 transition-colors"
                    title="Delete File"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
                <div className="p-3 rounded-full bg-white/5 text-muted-foreground group-hover:bg-primary group-hover:text-white transition-colors">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
            </div>
        </motion.div>
    );
};

const StatsCard = ({ icon: Icon, label, value, subValue, colorClass, action }: any) => (
    <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.02, y: -4 }}
        className="relative overflow-hidden p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 hover:border-white/10 hover:bg-white/[0.05] transition-all group"
    >
        <div className={`absolute top-0 right-0 p-32 bg-${colorClass}-500/5 blur-[80px] rounded-full -mr-16 -mt-16 pointer-events-none transition-opacity opacity-50 group-hover:opacity-100`} />

        <div className="relative z-10 flex justify-between items-start mb-6">
            <div className={`p-3.5 rounded-2xl bg-white/5 text-${colorClass}-400 ring-1 ring-white/10 group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6" />
            </div>
            {action}
        </div>

        <div className="relative z-10">
            <h3 className="text-4xl font-bold text-foreground tracking-tight mb-1 flex items-baseline gap-2">
                {value}
                {subValue && <span className="text-lg text-muted-foreground font-medium">{subValue}</span>}
            </h3>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
    </motion.div>
);

export default function Dashboard() {
    const router = useRouter();
    const { user, userProfile, logout } = useAuth();
    const [greeting, setGreeting] = useState('');
    const [stats, setStats] = useState<any>({ totalScreenTime: 0, totalPagesRead: 0, streak: 0 });
    const [files, setFiles] = useState<any[]>([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploadingProfile, setIsUploadingProfile] = useState(false);
    const profileInputRef = useRef<HTMLInputElement>(null);

    // --- Effects ---
    useEffect(() => {
        const hour = new Date().getHours();
        setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
    }, []);

    useEffect(() => {
        if (!user) return;

        // 1. Listen to Stats
        const statsUnsub = onSnapshot(doc(db, 'users', user.uid, 'stats', 'summary'), (doc) => {
            if (doc.exists()) {
                setStats(doc.data());
            }
        });

        // 2. Listen to Files
        const q = query(collection(db, 'users', user.uid, 'files'), orderBy('uploadTimestamp', 'desc'));
        const filesUnsub = onSnapshot(q, (snapshot) => {
            const filesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setFiles(filesData);
        });

        return () => {
            statsUnsub();
            filesUnsub();
        };

    }, [user]);


    const handleUpload = async (file: File) => {
        if (!user) return;
        setUploadProgress(10);

        try {
            // Local Storage Logic
            const fileId = `${Date.now()}_${file.name}`;
            setUploadProgress(30);

            await saveLocalFile(fileId, file);
            setUploadProgress(60);

            // Save Metadata to Firestore
            const fileUrl = `local://${fileId}`;
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 10);

            await addDoc(collection(db, 'users', user.uid, 'files'), {
                userId: user.uid,
                fileName: file.name,
                fileUrl: fileUrl,
                uploadTimestamp: new Date().toISOString(),
                expiryTimestamp: expiryDate.toISOString(),
                currentPage: 1,
                totalPages: 100,
                pagesRead: 0,
                lastOpenedAt: new Date().toISOString()
            });

            setUploadProgress(100);
            setTimeout(() => setUploadProgress(0), 500);

        } catch (error: any) {
            console.error("Upload failed", error);
            setUploadProgress(0);
            alert("Upload failed: " + error.message);
        }
    };

    const handleResetStats = async () => {
        if (!user || !confirm("Are you sure you want to reset your reading stats to zero?")) return;

        try {
            await updateDoc(doc(db, 'users', user.uid, 'stats', 'summary'), {
                totalPagesRead: 0,
                totalScreenTime: 0
            });
            alert("Stats reset successfully!");
        } catch (err) {
            console.error(err);
            alert("Failed to reset stats.");
        }
    };

    const handleDeleteFile = async (file: any, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user || !confirm(`Are you sure you want to delete "${file.fileName}"?`)) return;
        
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'files', file.id));
            if (file.fileUrl.startsWith('local://')) {
                const localId = file.fileUrl.replace('local://', '');
                await deleteLocalFile(localId);
            }
        } catch (error) {
            console.error("Error deleting file", error);
            alert("Failed to delete file.");
        }
    };

    const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsUploadingProfile(true);
        try {
            const storageRef = ref(storage, `users/${user.uid}/profile_${Date.now()}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            
            await setDoc(doc(db, 'users', user.uid, 'profile', 'info'), {
                photoDataUrl: url,
            }, { merge: true });
            
            // Allow a moment for the context to refresh
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            console.error("Error uploading profile picture:", error);
            alert("Failed to update profile picture");
        } finally {
            setIsUploadingProfile(false);
        }
    };

    const handleOpenFile = (file: any) => {
        router.push(`/read?url=${encodeURIComponent(file.fileUrl)}&fileId=${file.id}&filename=${encodeURIComponent(file.fileName)}`);
    };

    if (!user) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-8 h-8 border-4 border-primary rounded-full animate-spin border-t-transparent" />
        </div>
    );

    const displayName = userProfile?.name || user.displayName || 'Reader';
    const photoUrl = userProfile?.photoDataUrl || user.photoURL;

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 overflow-x-hidden relative">
            {/* Ambient Background Noise/Gradients */}
            <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay z-0" />
            <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[150px] rounded-full pointer-events-none z-0" />
            <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent/10 blur-[150px] rounded-full pointer-events-none z-0" />

            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 px-6 py-4 border-b border-white/5 bg-background/50 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3 font-bold text-xl tracking-tight">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">OptiRead</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs font-medium text-muted-foreground">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Online
                        </div>
                        <div className="relative group cursor-pointer" onClick={() => profileInputRef.current?.click()} title="Change Profile Picture">
                            {photoUrl ? (
                                <img src={photoUrl} alt={displayName} className="w-10 h-10 rounded-full border-2 border-white/10 p-0.5 object-cover shadow-lg group-hover:opacity-75 transition-opacity" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-secondary border border-white/10 flex items-center justify-center group-hover:bg-secondary/80 transition-colors">
                                    <span className="text-sm font-semibold text-white/50">{displayName.charAt(0)}</span>
                                </div>
                            )}
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                ref={profileInputRef}
                                onChange={handleProfilePicChange}
                            />
                            {isUploadingProfile && (
                                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={logout}
                            className="p-2 ml-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-muted-foreground transition-colors"
                            title="Log Out"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="relative z-10 max-w-7xl mx-auto pt-32 pb-20 px-6 md:px-10 space-y-16">

                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="flex flex-col md:flex-row justify-between items-end gap-8"
                >
                    <div className="space-y-4 max-w-2xl">
                        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white leading-tight">
                            {greeting}, <br />
                            <span className="text-gradient">{displayName.split(' ')[0]}</span>.
                        </h1>
                        <p className="text-xl text-muted-foreground font-light leading-relaxed">
                            Your personal AI-assisted reading sanctuary. <br className="hidden sm:block" />
                            Track your focus, stress, and progress in real-time.
                        </p>
                    </div>

                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="p-5 pr-8 rounded-[2rem] bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl flex items-center gap-4 shadow-2xl"
                    >
                        <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl shadow-lg shadow-orange-500/20 text-white">
                            <Trophy className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Current Streak</div>
                            <div className="text-3xl font-bold text-white flex items-baseline gap-1">
                                {stats.streak || 0} <span className="text-base font-medium text-white/50">days</span>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Main Content Grid */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8"
                >
                    {/* Left Column: Stats & Upload (4 cols) */}
                    <div className="lg:col-span-4 space-y-8">
                        {/* Stats Row */}
                        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                            <StatsCard
                                icon={BookOpen}
                                label="Total Pages Read"
                                value={stats.totalPagesRead || 0}
                                colorClass="blue"
                                action={
                                    <button
                                        onClick={handleResetStats}
                                        className="p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-muted-foreground transition-colors"
                                        title="Reset Stats"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                }
                            />
                            <StatsCard
                                icon={Clock}
                                label="Screen Time"
                                value={Math.round((stats.totalScreenTime || 0) / 60)}
                                subValue="mins"
                                colorClass="violet"
                            />
                        </div>

                        {/* Upload Card */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2 text-white/80 px-2">
                                <Play className="w-4 h-4 text-primary" /> Quick Start
                            </h2>
                            <BookUpload onUpload={handleUpload} progress={uploadProgress} />
                        </div>
                    </div>

                    {/* Right Column: Library (8 cols) */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="flex justify-between items-center px-2">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <span className="p-2 rounded-xl bg-primary/10 text-primary"><BookOpen className="w-5 h-5" /></span>
                                Your Library
                            </h2>
                            <div className="text-sm font-medium text-muted-foreground px-3 py-1 bg-white/5 rounded-full border border-white/5">
                                {files.length} Books
                            </div>
                        </div>

                        <div className="space-y-3 min-h-[400px]">
                            <AnimatePresence mode="popLayout">
                                {files.map((file) => (
                                    <LibraryCard
                                        key={file.id}
                                        file={file}
                                        onClick={() => handleOpenFile(file)}
                                        onDelete={(e) => handleDeleteFile(file, e)}
                                    />
                                ))}
                            </AnimatePresence>

                            {files.length === 0 && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-64 flex flex-col items-center justify-center text-center p-8 rounded-[2rem] border-2 border-dashed border-white/5 bg-white/[0.01]"
                                >
                                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                        <BookOpen className="w-8 h-8 text-white/20" />
                                    </div>
                                    <p className="text-lg font-medium text-white/60">Your library is empty</p>
                                    <p className="text-sm text-white/30">Upload a PDF to get started</p>
                                </motion.div>
                            )}
                        </div>
                    </div>

                </motion.div>
            </main>
        </div>
    );
}
