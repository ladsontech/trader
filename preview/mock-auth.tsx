import React from 'react';
export interface TradeBotUser { [k: string]: unknown }
export const scenario = {
  user: { uid: 'u1', email: '0770123456@investio.app' },
  userData: {
    phoneDigits: '0770123456',
    subscriptionPlan: 'premium',
    subscriptionStatus: 'active',
    subscriptionExpiresAt: Date.now() + 23 * 864e5,
    broker: 'Exness', brokerId: 'exness', brokerConnected: true,
    brokerAccountId: '128••04', brokerServer: 'Exness-Real9',
    brokerCurrency: 'USD', botEnabled: true,
    lastBotRunAt: Date.now() - 7 * 60000, onboardedAt: Date.now() - 864e5,
  } as Record<string, unknown>,
  isSubscribed: true,
  isBrokerConnected: true,
};
export function AuthProvider({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export const useAuth = () => ({
  user: scenario.user,
  userData: scenario.userData,
  loading: false,
  isSubscribed: scenario.isSubscribed,
  isBrokerConnected: scenario.isBrokerConnected,
  hasSeenOnboarding: true,
  refreshUserData: async () => {},
  markOnboarded: async () => {},
});
