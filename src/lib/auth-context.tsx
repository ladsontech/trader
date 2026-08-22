import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  /**
   * True once we have actually seen this user's profile document from the
   * server. Routing decisions must wait for this — redirecting on a profile we
   * have not read yet is how a paid user gets bounced back to the paywall.
   */
  profileLoaded: boolean;
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
  profileLoaded: false,
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
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  /**
   * Reads the profile.
   *
   * The one rule here: a failure must NEVER downgrade what we already know.
   * The previous version replaced userData with an unsubscribed stub inside
   * its catch block, so a single dropped request turned a paying customer
   * into a free one and the router threw them back to the paywall. A read
   * that fails simply leaves the last good profile in place.
   */
  const refreshUserData = async (currentUser?: User) => {
    const target = currentUser ?? userRef.current;
    if (!target) return;

    const ref = doc(db, 'tradebot_users', target.uid);

    try {
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setUserData(snap.data() as TradeBotUser);
        setProfileLoaded(true);
        return;
      }

      // Genuinely new account — create the empty profile once.
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

      try {
        // `create` semantics, not merge: if a document somehow already exists,
        // this must fail rather than blank out a real subscription.
        await setDoc(ref, seed);
        setUserData(seed);
        setProfileLoaded(true);
      } catch (seedError) {
        // Almost always "already exists" losing a race with another tab, or
        // the rules rejecting the write. Re-read rather than assume anything.
        console.warn('Could not seed the TradeBot profile, re-reading:', seedError);
        const retry = await getDoc(ref);
        if (retry.exists()) {
          setUserData(retry.data() as TradeBotUser);
          setProfileLoaded(true);
        }
      }
    } catch (error) {
      // Offline, rules hiccup, cold start — keep the last known profile.
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
    let unsubDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      unsubDoc?.();
      unsubDoc = null;
      setUser(currentUser);
      userRef.current = currentUser;

      if (!currentUser) {
        setUserData(null);
        setProfileLoaded(false);
        setLoading(false);
        return;
      }

      await refreshUserData(currentUser);

      // Live updates: the moment the webhook activates a subscription or a
      // broker connects, the UI moves on by itself.
      unsubDoc = onSnapshot(
        doc(db, 'tradebot_users', currentUser.uid),
        (snap) => {
          if (snap.exists()) {
            setUserData(snap.data() as TradeBotUser);
            setProfileLoaded(true);
          }
          // A snapshot that reports "does not exist" is ignored on purpose.
          // It happens during offline replay and would otherwise wipe state.
        },
        (error) => {
          // Listener death must not change what the app believes.
          console.error('Profile listener stopped (keeping last known):', error);
        }
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

    // `active` alone is enough while we have an expiry in the future. If the
    // expiry field is missing entirely but the status says active, trust the
    // status — the server is the only thing that can write it, and locking a
    // paid user out over a missing field is the worse failure.
    const isSubscribed =
      userData?.subscriptionStatus === 'active' &&
      (expiresAt === 0 || expiresAt > Date.now());

    return {
      user,
      userData,
      loading,
      profileLoaded,
      isSubscribed,
      isBrokerConnected: userData?.brokerConnected === true,
      hasSeenOnboarding: Boolean(userData?.onboardedAt),
      refreshUserData,
      markOnboarded,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userData, loading, profileLoaded]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
