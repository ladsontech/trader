import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

export interface TradeBotUser {
  phoneDigits?: string;
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
  /** Subscription is active AND not past its expiry. */
  isSubscribed: boolean;
  isBrokerConnected: boolean;
  hasSeenOnboarding: boolean;
  refreshUserData: (currentUser?: User) => Promise<void>;
  markOnboarded: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userData: null,
  loading: true,
  isSubscribed: false,
  isBrokerConnected: false,
  hasSeenOnboarding: false,
  refreshUserData: async () => {},
  markOnboarded: async () => {},
});

function normalizeUgandanPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('256') && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.length === 9 && digits.startsWith('7')) return `0${digits}`;
  return digits;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<TradeBotUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserData = async (currentUser?: User) => {
    const target = currentUser ?? user;
    if (!target) return;
    try {
      const userRef = doc(db, 'tradebot_users', target.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setUserData(snap.data() as TradeBotUser);
        return;
      }
      // Deliberately omits subscriptionPlan: the Firestore rule refuses a
      // profile that arrives with that field set, so the browser can never
      // create itself a plan.
      const seed: TradeBotUser = {
        phoneDigits: normalizeUgandanPhone(target.email?.split('@')[0] || ''),
        subscriptionStatus: 'none',
        brokerConnected: false,
        botEnabled: false,
        createdAt: new Date(),
      };
      await setDoc(userRef, seed, { merge: true });
      setUserData(seed);
    } catch (error) {
      console.error('Could not load your TradeBot profile:', error);
      setUserData({
        subscriptionPlan: null,
        subscriptionStatus: 'none',
        brokerConnected: false,
        botEnabled: false,
      });
    }
  };

  const markOnboarded = async () => {
    if (!user) return;
    const stamp = Date.now();
    setUserData((prev) => (prev ? { ...prev, onboardedAt: stamp } : prev));
    try {
      await updateDoc(doc(db, 'tradebot_users', user.uid), { onboardedAt: stamp });
    } catch (error) {
      console.error('Could not save onboarding progress:', error);
    }
  };

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      unsubDoc?.();
      unsubDoc = null;
      setUser(currentUser);

      if (!currentUser) {
        setUserData(null);
        setLoading(false);
        return;
      }

      await refreshUserData(currentUser);

      // Live updates: the moment the webhook activates a subscription or a
      // broker connects, the UI moves on by itself.
      unsubDoc = onSnapshot(
        doc(db, 'tradebot_users', currentUser.uid),
        (snap) => {
          if (snap.exists()) setUserData(snap.data() as TradeBotUser);
        },
        (error) => console.error('Profile listener stopped:', error)
      );

      setLoading(false);
    });

    return () => {
      unsubAuth();
      unsubDoc?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const expiresAt = Number(userData?.subscriptionExpiresAt || 0);
    const isSubscribed =
      userData?.subscriptionStatus === 'active' && expiresAt > Date.now();

    return {
      user,
      userData,
      loading,
      isSubscribed,
      isBrokerConnected: userData?.brokerConnected === true,
      hasSeenOnboarding: Boolean(userData?.onboardedAt),
      refreshUserData,
      markOnboarded,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userData, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
