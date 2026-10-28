import React, { useSyncExternalStore } from 'react';
export interface TradeBotUser { [k: string]: unknown }

/*
 * Static screens: ?screen=…            (signed in, paid, broker connected)
 *                 ?setup=plan|broker   (stuck at that setup step)
 * Click-through:  ?screen=flow          starts signed in and unpaid; the mock
 *                 API moves the state forward like the real functions do.
 */
const params = new URLSearchParams(location.search);
const setup = params.get('setup') ?? (params.get('screen') === 'flow' ? 'plan' : null);

type State = { isSubscribed: boolean; isBrokerConnected: boolean; userData: Record<string, unknown> };
let state: State = {
  isSubscribed: setup !== 'plan',
  isBrokerConnected: !setup,
  userData: {
    phoneDigits: '0770123456',
    subscriptionPlan: setup === 'plan' ? null : 'premium',
    subscriptionStatus: setup === 'plan' ? 'none' : 'active',
    subscriptionExpiresAt: Date.now() + 311 * 864e5,
    broker: setup ? null : 'Exness', brokerId: setup ? null : 'exness', brokerConnected: !setup,
    brokerAccountId: '128••04', brokerServer: 'Exness-Real9',
    brokerCurrency: 'USD', botEnabled: !setup,
    lastBotRunAt: Date.now() - 7 * 60000, onboardedAt: Date.now() - 864e5,
  },
};
const listeners = new Set<() => void>();
export function updateMockState(patch: Partial<State> & { userData?: Record<string, unknown> }) {
  state = { ...state, ...patch, userData: { ...state.userData, ...(patch.userData ?? {}) } };
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
export const scenario = state;

export function AuthProvider({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export const useAuth = () => {
  const s = useSyncExternalStore(subscribe, () => state);
  return {
    user: { uid: 'u1', email: '0770123456@investio.app' },
    userData: s.userData,
    loading: false,
    profileLoaded: true,
    isSubscribed: s.isSubscribed,
    isBrokerConnected: s.isBrokerConnected,
    hasSeenOnboarding: true,
    isAdmin: false,
    country: 'UG' as const,
    currency: 'UGX' as const,
    setCountry: () => {},
    setCurrency: () => {},
    refreshUserData: async () => {},
    markOnboarded: async () => {},
  };
};
