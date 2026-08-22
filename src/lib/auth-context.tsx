import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export interface TradeBotUser {
  phone?: string;
  phoneDigits?: string;
  subscriptionPlan?: 'standard' | 'premium' | null;
  subscriptionStatus?: 'active' | 'expired' | 'none';
  subscriptionExpiresAt?: number;
  broker?: string;
  brokerId?: string;
  brokerConnected?: boolean;
  brokerAccountId?: string;
  brokerServer?: string;
  totalPnl?: number;
  totalTrades?: number;
  winRate?: number;
  createdAt?: any;
}

interface AuthContextType {
  user: User | null;
  userData: TradeBotUser | null;
  loading: boolean;
  refreshUserData: (currentUser?: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  refreshUserData: async () => {},
});

function normalizeUgandanPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('256') && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }
  if (digits.length === 9 && digits.startsWith('7')) {
    return `0${digits}`;
  }
  return digits;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<TradeBotUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserData = async (currentUser: User = user!) => {
    if (!currentUser) return;
    try {
      const userRef = doc(db, 'tradebot_users', currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setUserData(snap.data() as TradeBotUser);
      } else {
        // Auto-create tradebot user doc
        const phoneDigits = normalizeUgandanPhone(
          currentUser.email?.split('@')[0] || currentUser.uid
        );
        const defaultData: TradeBotUser = {
          phoneDigits,
          subscriptionPlan: null,
          subscriptionStatus: 'none',
          brokerConnected: false,
          totalPnl: 0,
          totalTrades: 0,
          winRate: 0,
          createdAt: new Date(),
        };
        await setDoc(userRef, defaultData);
        setUserData(defaultData);
      }
    } catch (err) {
      console.error('Failed to load/create tradebot user data:', err);
      setUserData({
        subscriptionPlan: null,
        subscriptionStatus: 'none',
        brokerConnected: false,
        totalPnl: 0,
        totalTrades: 0,
        winRate: 0,
      });
    }
  };

  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      setUser(currentUser);

      if (currentUser) {
        await refreshUserData(currentUser);

        // Real-time subscription
        try {
          const userRef = doc(db, 'tradebot_users', currentUser.uid);
          unsubSnapshot = onSnapshot(
            userRef,
            (snap) => {
              if (snap.exists()) {
                setUserData(snap.data() as TradeBotUser);
              }
            },
            (error) => {
              console.error('TradeBot user listener error:', error);
            }
          );
        } catch (err) {
          console.error('Failed to set up tradebot user listener:', err);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        refreshUserData,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
