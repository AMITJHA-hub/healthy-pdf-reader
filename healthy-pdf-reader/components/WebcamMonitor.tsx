'use client';

import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import * as tf from '@tensorflow/tfjs';

// Suppress benign TensorFlow/MediaPipe logs that appear as errors
const filterConsole = () => {
    // Only run in client
    if (typeof window === 'undefined') return;

    const originalError = console.error;
    console.error = (...args) => {
        if (typeof args[0] === 'string' && args[0].includes('TensorFlow Lite XNNPACK delegate')) {
            return;
        }
        originalError.apply(console, args);
    };
};

export default function WebcamMonitor({
    onDistanceChange,
    onBrightnessChange,
    onFacePositionChange,
    onStressSignals,
    onBlinkRateChange,
    onDetectedEmotion
}: {
    onDistanceChange?: (status: 'OK' | 'TOO_CLOSE' | 'TOO_FAR', distanceCm: number) => void,
    onBrightnessChange?: (brightness: number) => void,
    onFacePositionChange?: (y: number) => void,
    onStressSignals?: (signals: { squint: number; browDown: number; openness: number; gazeMovement: number }) => void,
    onBlinkRateChange?: (bpm: number) => void,
    onDetectedEmotion?: (emotion: string) => void
}) {
    const webcamRef = useRef<Webcam>(null);
    const [isReady, setIsReady] = useState(false);

    const landmarkerRef = useRef<FaceLandmarker | null>(null);
    const emotionModelRef = useRef<tf.LayersModel | null>(null);
    const rafId = useRef<number | null>(null);
    const lastVideoTimeRef = useRef(-1);
    const baselineWidthRef = useRef<number | null>(null);
    const kRef = useRef<number>(60 * 0.25); // fallback constant (60cm at normalized width ~0.25)
    const distanceEmaRef = useRef<number | null>(null);
    const frameCountRef = useRef(0);

    // Blink Detection Refs
    const blinkTimestampsRef = useRef<number[]>([]);
    const isEyeClosedRef = useRef(false);
    const lastBpmUpdateRef = useRef(0);

    useEffect(() => {
        filterConsole(); // Apply filter
        let mounted = true;

        async function initAI() {
            try {
                // 1. Load MediaPipe FaceLandmarker
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
                );

                if (!mounted) return;

                const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "CPU"
                    },
                    outputFaceBlendshapes: true, // ENABLED for eye stress detection
                    runningMode: "VIDEO",
                    numFaces: 1
                });

                // 2. Load Emotion Model (TF.js)
                // We do this in parallel or sequence, but inside try-catch to be safe
                try {
                    await tf.ready();
                    // Check if model file exists before trying to load (optional, or just catch error)
                    const model = await tf.loadLayersModel('/models/emotion_model/model.json');
                    if (mounted) emotionModelRef.current = model;
                    console.log("Emotion Model Loaded");
                } catch (e) {
                    console.warn("Emotion model not found yet. Detection will be disabled until model.json is present.", e);
                }

                if (mounted) {
                    landmarkerRef.current = faceLandmarker;
                    setIsReady(true);
                    console.log("MediaPipe Initialized Successfully");
                } else {
                    faceLandmarker.close();
                }
            } catch (error) {
                console.error("Failed to initialize AI:", error);
            }
        }

        initAI();

        return () => {
            mounted = false;
            if (landmarkerRef.current) {
                landmarkerRef.current.close();
                landmarkerRef.current = null;
            }
            if (rafId.current) cancelAnimationFrame(rafId.current);
        };
    }, []);

    // Analyze Loop
    useEffect(() => {
        if (!isReady) return;

        // Rough distance estimation using normalized face width and assumed camera FOV.
        const estimateDistanceCm = (normalizedWidth: number) => {
            if (normalizedWidth <= 0) return Infinity;

            // Auto-calibrate: first stable measurement becomes baseline for ~60 cm.
            if (!baselineWidthRef.current) {
                baselineWidthRef.current = normalizedWidth;
                kRef.current = 60 * normalizedWidth; // distance ≈ k / width
            }

            const rawDistance = kRef.current / normalizedWidth;

            // Smooth fluctuations with EMA to avoid flicker.
            if (distanceEmaRef.current === null) {
                distanceEmaRef.current = rawDistance;
            } else {
                distanceEmaRef.current = distanceEmaRef.current * 0.8 + rawDistance * 0.2;
            }

            return distanceEmaRef.current ?? rawDistance;
        };

        const loop = () => {
            if (!landmarkerRef.current || !webcamRef.current?.video) {
                rafId.current = requestAnimationFrame(loop);
                return;
            }

            const video = webcamRef.current.video;
            if (video.currentTime !== lastVideoTimeRef.current && video.readyState >= 2) {
                lastVideoTimeRef.current = video.currentTime;

                frameCountRef.current += 1;

                try {
                    const startTime = performance.now();
                    const results = landmarkerRef.current.detectForVideo(video, startTime);

                    // 1. Brightness (Simple sampling)
                    if (frameCountRef.current % 30 === 0) {
                        const canvas = document.createElement('canvas');
                        canvas.width = 50; canvas.height = 50;
                        const ctx = canvas.getContext('2d', { willReadFrequently: true });
                        if (ctx) {
                            ctx.drawImage(video, 0, 0, 50, 50);
                            const frame = ctx.getImageData(0, 0, 50, 50);
                            let sum = 0;
                            for (let i = 0; i < frame.data.length; i += 4) sum += frame.data[i];
                            const brightness = Math.floor(sum / (frame.data.length / 4));
                            if (onBrightnessChange) onBrightnessChange(brightness);
                        }
                    }

                    // 2. Face Logic
                    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                        const face = results.faceLandmarks[0];

                        // Distance Calculation (using face width)
                        // Landmarks 454 (left tragion) and 234 (right tragion)
                        const w = Math.sqrt(
                            Math.pow(face[454].x - face[234].x, 2) +
                            Math.pow(face[454].y - face[234].y, 2)
                        );
                        const distanceCm = estimateDistanceCm(w);

                        // Target range 40–60 cm.
                        const tooClose = distanceCm < 40;
                        const tooFar = distanceCm > 60;
                        let dist: 'OK' | 'TOO_CLOSE' | 'TOO_FAR' = 'OK';
                        if (tooClose) dist = 'TOO_CLOSE';
                        else if (tooFar) dist = 'TOO_FAR';

                        // Always report distance
                        if (onDistanceChange) onDistanceChange(dist, Math.round(distanceCm));

                        // 3. Posture / Head Height
                        // Use nose tip (landmark 1) y-coordinate
                        // In MediaPipe, y increases downwards (0 is top, 1 is bottom)
                        if (onFacePositionChange) {
                            onFacePositionChange(face[1].y);
                        }

                        // 4. Advanced Stress Signals & Blink Rate
                        if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
                            const shapes = results.faceBlendshapes[0].categories;
                            const score = (name: string) => shapes.find(s => s.categoryName === name)?.score || 0;

                            // 4a. Tension (Squint & Brow)
                            const squintLeft = score('eyeSquintLeft');
                            const squintRight = score('eyeSquintRight');
                            const browDownLeft = score('browDownLeft');
                            const browDownRight = score('browDownRight');
                            const avgSquint = (squintLeft + squintRight) / 2;
                            const avgBrow = (browDownLeft + browDownRight) / 2;

                            // 4b. Eye Openness & Blink Detection
                            const blinkLeft = score('eyeBlinkLeft');
                            const blinkRight = score('eyeBlinkRight');
                            const avgBlinkColor = (blinkLeft + blinkRight) / 2;
                            const avgOpenness = 1 - avgBlinkColor;

                            // Blink Event Logic
                            const BLINK_THRESHOLD = 0.5;
                            const now = Date.now();

                            if (avgBlinkColor > BLINK_THRESHOLD && !isEyeClosedRef.current) {
                                isEyeClosedRef.current = true;
                            } else if (avgBlinkColor <= BLINK_THRESHOLD && isEyeClosedRef.current) {
                                // Blink completed (Closed -> Open)
                                isEyeClosedRef.current = false;
                                blinkTimestampsRef.current.push(now);
                            }

                            // Update BPM every 500ms
                            if (now - lastBpmUpdateRef.current > 500) {
                                lastBpmUpdateRef.current = now;
                                // Filter blinks older than 60s
                                const oneMinuteAgo = now - 60000;
                                blinkTimestampsRef.current = blinkTimestampsRef.current.filter(t => t > oneMinuteAgo);
                                const bpm = blinkTimestampsRef.current.length;
                                if (onBlinkRateChange) onBlinkRateChange(bpm);
                            }

                            // 4c. Gaze Fixation / Micro-movements (Staring)
                            if (onStressSignals) {
                                let gazeVelocity = 1.0;
                                if (face.length >= 478) {
                                    const movement = score('eyeLookUpLeft') + score('eyeLookDownLeft') + score('eyeLookInLeft') + score('eyeLookOutLeft');
                                    gazeVelocity = movement;
                                }

                                onStressSignals({
                                    squint: avgSquint,
                                    browDown: avgBrow,
                                    openness: avgOpenness,
                                    gazeMovement: gazeVelocity
                                });
                            }
                        }

                        // 5. Emotion Detection (TF.js)
                        // Run every 30 frames (approx 1 sec) to save CPU
                        if (emotionModelRef.current && frameCountRef.current % 30 === 0 && onDetectedEmotion) {
                            tf.tidy(() => {
                                // Extract face bounding box from normalized landmarks
                                const xs = face.map(p => p.x);
                                const ys = face.map(p => p.y);
                                const minX = Math.min(...xs);
                                const maxX = Math.max(...xs);
                                const minY = Math.min(...ys);
                                const maxY = Math.max(...ys);

                                const vidW = video.videoWidth;
                                const vidH = video.videoHeight;

                                // Clamp coordinates [0, 1] -> [0, vidW/H]
                                const x = Math.max(0, Math.floor(minX * vidW));
                                const y = Math.max(0, Math.floor(minY * vidH));
                                const w = Math.min(vidW - x, Math.ceil((maxX - minX) * vidW));
                                const h = Math.min(vidH - y, Math.ceil((maxY - minY) * vidH));

                                // Only process if face is valid size
                                if (w > 20 && h > 20) {
                                    const pixels = tf.browser.fromPixels(video);
                                    const crops = pixels.slice([y, x, 0], [h, w, 3]); // crop face

                                    // Preprocessing: Resize 48x48 -> Grayscale -> Normalize 0-1
                                    const resized = tf.image.resizeBilinear(crops, [48, 48]);
                                    const gray = tf.image.rgbToGrayscale(resized); // (48,48,1)
                                    const normalized = gray.div(255.0).expandDims(0); // (1,48,48,1)

                                    if (emotionModelRef.current) {
                                        const output = emotionModelRef.current.predict(normalized) as tf.Tensor;
                                        const values = output.dataSync();
                                        const prediction = output.argMax(1).dataSync()[0];

                                        const emotions = ["Angry", "Disgusted", "Fearful", "Happy", "Neutral", "Sad", "Surprised"];
                                        const detected = emotions[prediction];

                                        // Debug Log 
                                        console.log("🧐 Emotion AI:", {
                                            detected,
                                            probs: Array.from(values).map(v => v.toFixed(2)),
                                            maxIndex: prediction
                                        });

                                        onDetectedEmotion(detected);
                                    }
                                }
                            });
                        }
                    }

                } catch (err) {
                    // console.error(err); // Squelch repetitive errors
                }
            }
            rafId.current = requestAnimationFrame(loop);
        };

        loop();

        return () => {
            if (rafId.current) cancelAnimationFrame(rafId.current);
        };
    }, [isReady, onDistanceChange, onBrightnessChange, onFacePositionChange, onStressSignals, onBlinkRateChange, onDetectedEmotion]);

    return (
        <div className="relative rounded-lg overflow-hidden shadow-lg border border-white/10 bg-black group">
            <Webcam
                ref={webcamRef}
                audio={false}
                mirrored={true}
                className="w-[200px] h-[150px] object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                videoConstraints={{ width: 320, height: 240, facingMode: "user" }}
            />

            {/* Status Dot */}
            <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${isReady ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-yellow-500'}`} />

            {!isReady && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-xs text-white p-4 text-center">
                    Starting AI...
                </div>
            )}
        </div>
    );
}
