// Preview stand-in for 'firebase/firestore' (no network).
export const doc = (..._a: unknown[]) => ({});
export const collection = (..._a: unknown[]) => ({});
export const onSnapshot = (..._a: unknown[]) => () => {};
export const getDoc = async () => ({ exists: () => false, data: () => undefined });
export const setDoc = async () => {};
export const updateDoc = async () => {};
