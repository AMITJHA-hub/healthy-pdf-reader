'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    User,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    userProfile: any | null;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Fetch user profile from Firestore
                const docRef = doc(db, 'users', currentUser.uid, 'profile', 'info');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setUserProfile(docSnap.data());
                } else {
                    setUserProfile(null);
                    // If validated user has no profile, they might need onboarding
                }
            } else {
                setUserProfile(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            console.log("Starting Popup...");
            const result = await signInWithPopup(auth, provider);
            console.log("Popup finished. User:", result.user.uid);

            // Check if profile exists, if not redirect to onboarding
            try {
                const docRef = doc(db, 'users', result.user.uid, 'profile', 'info');

                // Set a timeout for the fetch
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));

                const docSnap: any = await Promise.race([
                    getDoc(docRef),
                    timeout
                ]);

                if (docSnap.exists()) {
                    router.push('/dashboard');
                } else {
                    router.push('/onboarding');
                }
            } catch (fsError: any) {
                console.error("Firestore Error:", fsError);
                // If permission denied, likely rules not set. Allow proceed to onboarding/dashboard?
                // Actually, if rules deny read, they will likely deny write too.
                // But we must stop the spinner.

                if (fsError.code === 'permission-denied' || fsError.message.includes('permission')) {
                    alert("Warning: Firestore permissions denied. Please update your Firebase Security Rules to allow read/write in Test Mode.");
                }

                // Proceed anyway so user is not stuck
                router.push('/onboarding');
            }

        } catch (error) {
            console.error("Error signing in with Google", error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, userProfile, loading, signInWithGoogle, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
