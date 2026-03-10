'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Webcam from 'react-webcam';
import { ArrowRight, Camera, RefreshCw, UserRound, Loader2 } from 'lucide-react';

interface ProfileForm {
  name: string;
  age: string;
  wearsGlasses: boolean;
  eyeConditions: string;
  photoDataUrl: string;
}

export default function Onboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const webcamRef = useRef<Webcam>(null);
  const [form, setForm] = useState<ProfileForm>({
    name: user?.displayName || '',
    age: '',
    wearsGlasses: false,
    eyeConditions: '',
    photoDataUrl: user?.photoURL || '',
  });
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.displayName) {
      setForm(prev => ({ ...prev, name: user.displayName! }));
    }
  }, [user]);

  const handleCapture = () => {
    if (!webcamRef.current) return;
    const shot = webcamRef.current.getScreenshot();
    if (!shot) {
      setError('Could not capture image. Please try again.');
      return;
    }
    setForm((prev) => ({ ...prev, photoDataUrl: shot }));
    setError('');
    setIsCameraActive(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');

    if (!form.name.trim() || !form.age.trim()) {
      setError('Name and age are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Save to Firestore
      await setDoc(doc(db, 'users', user.uid, 'profile', 'info'), {
        ...form,
        email: user.email,
        joinDate: new Date().toISOString()
      });

      // Initialize stats
      await setDoc(doc(db, 'users', user.uid, 'stats', 'summary'), {
        totalScreenTime: 0,
        totalPagesRead: 0,
        streak: 0,
        lastActive: new Date().toISOString()
      });

      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      setError('Unable to save your profile. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-white"><Loader2 className="animate-spin w-8 h-8" /></div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] p-6 text-white">
      <div className="w-full max-w-2xl grid md:grid-cols-[1.1fr_0.9fr] gap-6 bg-white/[0.03] border border-white/5 rounded-2xl p-8 shadow-xl backdrop-blur-sm">
        <div className="space-y-2">
          <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
            <UserRound className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Complete your profile</h1>
          <p className="text-zinc-400 text-sm">
            We use this info to personalize break reminders and posture guidance.
          </p>
        </div>

        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300" htmlFor="name">Full name</label>
                <input
                  id="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-11 px-4 rounded-lg bg-white/5 border border-white/10 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-white placeholder:text-zinc-600"
                  placeholder="Alex Doe"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300" htmlFor="age">Age</label>
                <input
                  id="age"
                  type="number"
                  min="1"
                  max="120"
                  required
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  className="w-full h-11 px-4 rounded-lg bg-white/5 border border-white/10 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-white placeholder:text-zinc-600"
                  placeholder="24"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300" htmlFor="photo">Profile photo</label>
              <div className="space-y-3">
                <div className="relative rounded-xl border border-white/10 bg-black/60 overflow-hidden min-h-[200px] flex items-center justify-center">
                  {form.photoDataUrl && !isCameraActive ? (
                    <img src={form.photoDataUrl} alt="Captured profile" className="w-full h-full object-cover" />
                  ) : isCameraActive ? (
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      screenshotFormat="image/jpeg"
                      className="w-full h-full object-cover"
                      videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
                      onUserMediaError={(e: any) => setCameraError(e?.message || 'Camera permission denied')}
                    />
                  ) : (
                    <div className="text-sm text-zinc-500 flex flex-col items-center gap-2 p-6">
                      <Camera className="w-6 h-6" />
                      <span>Used for posture calibration only.</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isCameraActive && (
                    <button
                      type="button"
                      onClick={() => { setIsCameraActive(true); setCameraError(''); }}
                      className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors flex items-center gap-2"
                    >
                      <Camera className="w-3 h-3" />
                      {form.photoDataUrl ? 'Retake' : 'Start camera'}
                    </button>
                  )}

                  {isCameraActive && (
                    <button
                      type="button"
                      onClick={handleCapture}
                      className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-2"
                    >
                      <Camera className="w-3 h-3" />
                      Capture
                    </button>
                  )}
                </div>
                {cameraError && <p className="text-xs text-red-400">{cameraError}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <input
                id="glasses"
                type="checkbox"
                checked={form.wearsGlasses}
                onChange={(e) => setForm({ ...form, wearsGlasses: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 bg-transparent text-blue-500 focus:ring-blue-500"
              />
              <label htmlFor="glasses" className="text-sm font-medium text-zinc-300">I wear spectacles or contact lenses</label>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : <>Complete Setup <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
