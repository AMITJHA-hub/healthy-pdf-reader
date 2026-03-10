'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface HealthContextType {
    distance: number;
    distanceStatus: 'OK' | 'TOO_CLOSE' | 'TOO_FAR';
    brightness: number;
    baselineY: number | null;
    currentY: number;
    isPostureBad: boolean;
    isInBreak: boolean;
    stressScore: number; // 0-100
    detectedEmotion: string | null; // NEW: Emotion from AI
    setDistanceData: (status: 'OK' | 'TOO_CLOSE' | 'TOO_FAR', val: number) => void;
    setBrightness: (val: number) => void;
    setFacePosition: (y: number) => void;
    setBaseline: () => void;
    setStressSignals: (signals: { squint: number; browDown: number; openness: number; gazeMovement: number }) => void;
    setDetectedEmotion: (emotion: string) => void;
}

const HealthContext = createContext<HealthContextType | undefined>(undefined);

export function HealthProvider({ children }: { children: React.ReactNode }) {
    const [distance, setDistance] = useState(50);
    const [distanceStatus, setDistanceStatus] = useState<'OK' | 'TOO_CLOSE' | 'TOO_FAR'>('OK');
    const [brightness, setBrightnessState] = useState(100);

    // Posture
    const [baselineY, setBaselineY] = useState<number | null>(null);
    const [currentY, setCurrentY] = useState(0);
    const [isPostureBad, setIsPostureBad] = useState(false);

    // Stress & Emotion
    const [stressScore, setStressScore] = useState(0);
    const [detectedEmotion, setDetectedEmotion] = useState<string | null>(null);

    // Break System
    const [isInBreak, setIsInBreak] = useState(false);
    const badPostureStartTimeRef = useRef<number | null>(null);

    // "AI" Heuristics State
    const sessionStartTimeRef = useRef(Date.now());
    const badPostureCountRef = useRef(0);
    const lastBreakTimeRef = useRef(Date.now());

    // 1. Posture Logic (Frame-rate)
    useEffect(() => {
        if (baselineY === null) return;

        const threshold = 0.05;
        const diff = currentY - baselineY;

        if (diff > threshold) {
            // Bad posture detected
            if (!badPostureStartTimeRef.current) {
                badPostureStartTimeRef.current = Date.now();
            } else {
                // If bad for > 2 seconds, flag it
                if (Date.now() - badPostureStartTimeRef.current > 2000) {
                    if (!isPostureBad) setIsPostureBad(true);
                }
            }
        } else {
            // Good posture
            badPostureStartTimeRef.current = null;
            if (isPostureBad) setIsPostureBad(false);
        }
    }, [currentY, baselineY, isPostureBad]);

    // 2. Logic Loop (1s Interval) - Updates Stress & Checks Breaks
    useEffect(() => {
        const logicLoop = () => {
            // Update Stress based on current posture state
            setStressScore(prev => {
                if (isPostureBad) {
                    badPostureCountRef.current += 1; // Increment 'fatigue' counter
                    return Math.min(100, prev + 5); // +5% per second (20s to max)
                } else {
                    return Math.max(0, prev - 2); // -2% per second recovery
                }
            });

            // Check for Breaks
            const now = Date.now();
            const timeSinceLastBreak = (now - lastBreakTimeRef.current) / 1000 / 60; // minutes

            // Condition 1: Time based (every 20 mins)
            if (timeSinceLastBreak > 20) {
                triggerBreak("Time for a 20-20-20 break!");
            }
            // Condition 2: Stress based (High stress sustained)
            else if (badPostureCountRef.current > 60 && timeSinceLastBreak > 5) {
                // > 60 seconds of total bad posture since last break
                triggerBreak("High accumulated stress detected. Take a moment.");
                badPostureCountRef.current = 0;
            }
        };

        const interval = setInterval(logicLoop, 1000);
        return () => clearInterval(interval);
    }, [isPostureBad]); // Dependency on isPostureBad ensures we use fresh state in loop

    const triggerBreak = (reason: string) => {
        console.log("Break Triggered:", reason);
        setIsInBreak(true);
        setTimeout(() => {
            setIsInBreak(false);
            lastBreakTimeRef.current = Date.now();
            setStressScore(0); // Reset stress after break
            badPostureCountRef.current = 0;
        }, 20000);
    };

    // Data for Stress Model
    const [eyeStress, setEyeStress] = useState({ squint: 0, browDown: 0, openness: 1, gazeMovement: 0 });
    // Rolling buffer for gaze variance (staring detection)
    const gazeHistoryRef = useRef<number[]>([]);

    const setStressSignals = (signals: { squint: number; browDown: number; openness: number; gazeMovement: number }) => {
        setEyeStress(signals);
    };

    const setDistanceData = (status: 'OK' | 'TOO_CLOSE' | 'TOO_FAR', val: number) => {
        setDistanceStatus(status);
        setDistance(val);
    };

    const setBrightness = (val: number) => setBrightnessState(val);

    const setFacePosition = (y: number) => {
        setCurrentY(y);
    };

    const setBaseline = () => {
        setBaselineY(currentY);
        console.log("Baseline set at:", currentY);
    };

    // 2. Logic Loop (1s Interval) - Advanced Progressive Stress Model
    useEffect(() => {
        const logicLoop = () => {
            setStressScore(prevScore => {
                // --- INPUTS ---
                // 1. Eye Tension (Squint & Brow) - Immediate strain
                const tensionLoad = (eyeStress.squint * 30) + (eyeStress.browDown * 20); // Max ~50

                // 2. Eye Openness / Fatigue - If eyes are drooping (openness < 0.8), stress increases
                // Baseline openness is usually ~0.9-1.0. Drooping to 0.7 is tired.
                const fatigueLoad = Math.max(0, (0.85 - eyeStress.openness) * 40); // Max ~20 if eyes half closed

                // 3. Staring / Fixation (Low Gaze Movement)
                // Add current movement to history (keep last 5 secs)
                gazeHistoryRef.current.push(eyeStress.gazeMovement);
                if (gazeHistoryRef.current.length > 5) gazeHistoryRef.current.shift();

                // Calculate average movement over last 5 ticks
                const avgMovement = gazeHistoryRef.current.reduce((a, b) => a + b, 0) / gazeHistoryRef.current.length;

                // If avg movement is very low (< 0.05), user is staring
                const fixationLoad = avgMovement < 0.05 ? 5 : 0; // Constant low burn for staring

                // 4. Posture (Accelerator)
                // Posture no longer adds raw stress directly, but MULTIPLIES the rate of accumulation
                const postureMultiplier = isPostureBad ? 2.5 : 1.0;
                const distanceMultiplier = distanceStatus === 'TOO_CLOSE' ? 1.5 : 1.0;

                // 5. Emotion Accelerator (NEW)
                // Sad/Fear/Angry/Disgusted increase stress accumulation
                let emotionMultiplier = 1.0;
                if (['Angry', 'Disgusted', 'Fearful', 'Sad'].includes(detectedEmotion || '')) {
                    emotionMultiplier = 1.5;
                } else if (detectedEmotion === 'Happy') {
                    emotionMultiplier = 0.5; // Happy reduces stress build-up
                }

                // --- CALCULATION ---
                // Base metabolic burn rate (just for reading) = 0.5 per sec
                const baseBurn = 0.5;

                // Total Stress Input Ratio
                const totalStressInput = (baseBurn + tensionLoad + fatigueLoad + fixationLoad) * postureMultiplier * distanceMultiplier * emotionMultiplier;

                // Recovery: If inputs are very low (relaxed face, looking around), we recover.
                // Relaxed: No tension, eyes open, moving eyes.
                const isRelaxed = tensionLoad < 5 && fatigueLoad === 0 && avgMovement > 0.2 && !isPostureBad && detectedEmotion !== 'Sad';

                let delta = 0;
                if (isRelaxed) {
                    delta = -2.0; // Recover 2% per second
                } else {
                    // Accumulate stress. 
                    // To prevent it being instant, we scale it down. This happens every second.
                    // We want 0-100 to take maybe 10 mins of 'normal' reading, 
                    // or 1 min of 'intense' strain.
                    // Normal read: input ~1.0 -> 0.1% per sec -> 1000s (~16 mins)
                    // High strain: input ~50 -> 5% per sec -> 20s
                    // We dampen the input.
                    delta = totalStressInput * 0.15;
                }

                return Math.max(0, Math.min(100, prevScore + delta));
            });

            // Check for Breaks (based on output Score)
            // Note: logicLoop interval is 1s, so this checks every second
            // logic for break triggering is inside the effect in original code, valid to keep or move.
            // But we need to use the STATE for 100% check, which is async. 
            // We rely on the dedicated useEffect below for the 100% trigger.
            // We can add soft triggers here if needed.
        };

        const interval = setInterval(logicLoop, 1000);
        return () => clearInterval(interval);
    }, [isPostureBad, eyeStress, distanceStatus, detectedEmotion]); // Added detectedEmotion to dependencies

    // Monitor Stress Score for 100% Popup
    useEffect(() => {
        if (stressScore >= 100 && !isInBreak) {
            triggerBreak("CRITICAL STRESS! Take a break immediately.");
        }
    }, [stressScore, isInBreak]);

    return (
        <HealthContext.Provider value={{
            distance,
            distanceStatus,
            brightness,
            baselineY,
            currentY,
            isPostureBad,
            isInBreak,
            stressScore,
            detectedEmotion,
            setDistanceData,
            setBrightness,
            setFacePosition,
            setBaseline,
            setStressSignals,
            setDetectedEmotion
        }}>
            {children}

            {/* Posture Popup Overlay */}
            {isPostureBad && !isInBreak && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-bounce">
                    <div className="bg-red-600/90 backdrop-blur text-white px-6 py-2 rounded-full shadow-lg font-bold flex items-center gap-2 text-sm">
                        <span>⚠️</span> Adjust Posture
                    </div>
                </div>
            )}

            {/* Break Overlay */}
            {isInBreak && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center text-white backdrop-blur-md">
                    <h2 className="text-4xl font-bold mb-4">Time for a Break</h2>
                    <p className="text-xl opacity-80 mb-8">AI detected fatigue. Relax your eyes for 20 seconds.</p>
                    <div className="w-16 h-16 rounded-full border-4 border-t-transparent border-white animate-spin"></div>
                </div>
            )}

        </HealthContext.Provider>
    );
}

export const useHealth = () => {
    const context = useContext(HealthContext);
    if (!context) throw new Error("useHealth must be used within a HealthProvider");
    return context;
};
