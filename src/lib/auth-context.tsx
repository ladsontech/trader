import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

export interface TradeBotUser {
  phoneDigits?: string;
  country?: 'UG' | 'KE';
  currency?: 'UGX' | 'KES';
  /** Written by Cloud Functions only. The client cannot grant itself a plan. */
  subscriptionPlan?: 'standard' | 'premium' | null;
  subscriptionStatus?: 'active' | 'expired' | 'none';
  subscriptionExpiresAt?: number;
  subscriptionActivatedAt?: number;
  broker?: string | null;
  brokerId?: string | null;
  brokerConnected?: boolean;
  brokerAccountId?: string | null;
  brokerServer?: string | null;
  brokerCurrency?: string | null;
  botEnabled?: boolean;
  onboardedAt?: number;
  lastBotRunAt?: number;
  lastEquity?: number;
  lastBalance?: number;
  createdAt?: unknown;
}

interface AuthContextValue {
  user: User | null;
  userData: TradeBotUser | null;
  loading: boolean;
  profileLoaded: boolean;
  isSubscribed: boolean;
  isBrokerConnected: boolean;
  hasSeenOnboarding: boolean;
  country: 'UG' | 'KE';
  currency: 'UGX' | 'KES';
  setCountry: (country: 'UG' | 'KE') => void;
  setCurrency: (currency: 'UGX' | 'KES') => void;
  refreshUserData: (currentUser?: User) => Promise<void>;
  markOnboarded: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userData: null,
  loading: true,
  profileLoaded: false,
  isSubscribed: false,
  isBrokerConnected: false,
  hasSeenOnboarding: false,
  country: 'UG',
  currency: 'UGX',
  setCountry: () => {},
  setCurrency: () => {},
  refreshUserData: async () => {},
  markOnboarded: async () => {},
});

function normalizePhone(value: string, country: 'UG' | 'KE' = 'UG'): string {
  const digits = value.replace(/\D/g, '');
  const isKenya = country === 'KE' || digits.startsWith('254');

  if (isKenya) {
    if (digits.startsWith('254') && digits.length === 12) return `0${digits.slice(3)}`;
    if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('1'))) return `0${digits}`;
    return digits;
  }

  if (digits.startsWith('256') && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.length === 9 && digits.startsWith('7')) return `0${digits}`;
  return digits;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<TradeBotUser | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<'UG' | 'KE'>('UG');
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const country: 'UG' | 'KE' = userData?.country || selectedCountry;
  const currency: 'UGX' | 'KES' = userData?.currency || (country === 'KE' ? 'KES' : 'UGX');

  const setCountry = (c: 'UG' | 'KE') => {
    setSelectedCountry(c);
    if (user) {
      updateDoc(doc(db, 'tradebot_users', user.uid), {
        country: c,
        currency: c === 'KE' ? 'KES' : 'UGX',
      }).catch((e) => console.warn('Could not update country preference:', e));
    }
  };

  const setCurrency = (curr: 'UGX' | 'KES') => {
    const newCountry: 'UG' | 'KE' = curr === 'KES' ? 'KE' : 'UG';
    setSelectedCountry(newCountry);
    if (user) {
      updateDoc(doc(db, 'tradebot_users', user.uid), {
        country: newCountry,
        currency: curr,
      }).catch((e) => console.warn('Could not update currency preference:', e));
    }
  };

  const refreshUserData = async (currentUser?: User) => {
    const target = currentUser ?? userRef.current;
    if (!target) return;

    const ref = doc(db, 'tradebot_users', target.uid);

    try {
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data() as TradeBotUser;
        setUserData(data);
        if (data.country) setSelectedCountry(data.country);
        setProfileLoaded(true);
        return;
      }

      const emailPrefix = target.email?.split('@')[0] || '';
      const isKe = emailPrefix.startsWith('254') || emailPrefix.startsWith('+254');
      const detectedCountry: 'UG' | 'KE' = isKe ? 'KE' : 'UG';

      const seed: TradeBotUser = {
        phoneDigits: normalizePhone(emailPrefix, detectedCountry),
        country: detectedCountry,
        currency: detectedCountry === 'KE' ? 'KES' : 'UGX',
        subscriptionStatus: 'none',
        brokerConnected: false,
        botEnabled: false,
        createdAt: new Date(),
      };

      try {
        await setDoc(ref, seed);
        setUserData(seed);
        setSelectedCountry(detectedCountry);
        setProfileLoaded(true);
      } catch (seedError) {
        console.warn('Could not seed the TradeBot profile, re-reading:', seedError);
        const retry = await getDoc(ref);
        if (retry.exists()) {
          const retriedData = retry.data() as TradeBotUser;
          setUserData(retriedData);
          if (retriedData.country) setSelectedCountry(retriedData.country);
          setProfileLoaded(true);
        }
      }
    } catch (error) {
      console.error('Could not refresh the TradeBot profile (keeping last known):', error);
    }
  };

  const markOnboarded = async () => {
    const target = userRef.current;
    if (!target) return;
    const stamp = Date.now();
    setUserData((prev) => (prev ? { ...prev, onboardedAt: stamp } : prev));
    try {
      await updateDoc(doc(db, 'tradebot_users', target.uid), { onboardedAt: stamp });
    } catch (error) {
      console.error('Could not save onboarding progress:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        await refreshUserData(nextUser);
      } else {
        setUserData(null);
        setProfileLoaded(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'tradebot_users', user.uid);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const fresh = snap.data() as TradeBotUser;
        setUserData(fresh);
        if (fresh.country) setSelectedCountry(fresh.country);
        setProfileLoaded(true);
      },
      (error) => {
        console.warn('TradeBot profile snapshot error:', error);
      }
    );
    return () => unsubscribe();
  }, [user]);

  const isSubscribed = useMemo(() => {
    if (!userData) return false;
    if (userData.subscriptionStatus === 'active') {
      const expires = Number(userData.subscriptionExpiresAt) || 0;
      return expires > Date.now();
    }
    return false;
  }, [userData]);

  const isBrokerConnected = Boolean(userData?.brokerConnected);
  const hasSeenOnboarding = Boolean(userData?.onboardedAt);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      userData,
      loading,
      profileLoaded,
      isSubscribed,
      isBrokerConnected,
      hasSeenOnboarding,
      country,
      currency,
      setCountry,
      setCurrency,
      refreshUserData,
      markOnboarded,
    }),
    [
      user,
      userData,
      loading,
      profileLoaded,
      isSubscribed,
      isBrokerConnected,
      hasSeenOnboarding,
      country,
      currency,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
