import { useEffect, useState } from 'react';
import { Download, MoreVertical, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { BRAND_NAME, BrandMark } from './Brand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __deferredPwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

const DISMISS_KEY = 'tradebot.pwaPromptDismissedAt';

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function detectPlatform(): { isIOS: boolean; isMobile: boolean } {
  if (typeof navigator === 'undefined') return { isIOS: false, isMobile: false };
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobileUa = isIOS || isAndroid || /Mobile|Tablet/i.test(ua);
  return { isIOS, isMobile: isMobileUa };
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => (typeof window !== 'undefined' ? window.__deferredPwaPrompt || null : null)
  );
  const [visible, setVisible] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(() => isStandaloneMode());
  const { isIOS, isMobile } = detectPlatform();

  useEffect(() => {
    if (isStandaloneMode()) {
      setInstalled(true);
      return;
    }

    // Automated headless browser tests should not have clicks intercepted by the floating sheet
    if (navigator.webdriver) return;

    const dismissedAt = Number(sessionStorage.getItem(DISMISS_KEY) || 0);
    const recentlyDismissed = dismissedAt > 0 && Date.now() - dismissedAt < 6 * 3600 * 1000;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__deferredPwaPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
      if (!recentlyDismissed) {
        setVisible(true);
      }
    };

    const onAppInstalled = () => {
      window.__deferredPwaPrompt = null;
      setDeferredPrompt(null);
      setInstalled(true);
      setVisible(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    // If the prompt was already captured before React mounted, or if the user is on a phone,
    // pop up the install banner after a short delay.
    const isPhoneScreen = window.matchMedia?.('(max-width: 768px)').matches;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!recentlyDismissed && (window.__deferredPwaPrompt || isMobile || isPhoneScreen)) {
      timer = setTimeout(() => {
        if (!isStandaloneMode()) {
          if (window.__deferredPwaPrompt) {
            setDeferredPrompt(window.__deferredPwaPrompt);
          }
          setVisible(true);
        }
      }, 900);
    }

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [isMobile]);

  if (installed || !visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setShowGuide(false);
  };

  const handleInstall = async () => {
    const promptEvent = deferredPrompt || window.__deferredPwaPrompt;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        window.__deferredPwaPrompt = null;
        setDeferredPrompt(null);
        if (choice.outcome === 'accepted') {
          setVisible(false);
        }
      } catch {
        setShowGuide(true);
      }
      return;
    }
    setShowGuide(true);
  };

  return (
    <div
      role="dialog"
      aria-label={`Install ${BRAND_NAME}`}
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 pointer-events-none flex justify-center"
    >
      <div className="pointer-events-auto w-full max-w-[420px] fade-up rounded-2xl border border-white/15 bg-[#071c19] text-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
        <div className="flex items-start gap-3.5">
          <BrandMark size={44} className="mt-0.5" />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#0e9f77]/25 border border-[#34d399]/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#5eead4]">
                  <Smartphone className="w-3 h-3" /> Mobile App
                </span>
                <h3 className="text-[15px] font-bold tracking-tight text-white mt-1">
                  Install {BRAND_NAME}
                </h3>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Close install prompt"
                className="p-1 -mr-1 -mt-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[12.5px] text-white/70 leading-snug mt-1">
              Add the app to your phone home screen for instant 1-tap access and live MT5 trade
              updates.
            </p>

            {!showGuide ? (
              <div className="mt-3.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInstall}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#14c08f] to-[#0b8a67] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_16px_-4px_rgba(20,192,143,0.65)] hover:brightness-105 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Install App
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-[12.5px] font-semibold text-white/75 hover:bg-white/10 cursor-pointer"
                >
                  Not now
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-[12px] text-white/85 space-y-2">
                {isIOS ? (
                  <>
                    <p className="font-semibold text-[#5eead4]">Install on iPhone / iPad:</p>
                    <ol className="space-y-1.5 text-white/80">
                      <li className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
                          1
                        </span>
                        <span>
                          Tap the <strong className="text-white">Share</strong> button{' '}
                          <Share className="inline w-3.5 h-3.5 text-[#5eead4] -mt-0.5" /> in Safari.
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
                          2
                        </span>
                        <span>
                          Scroll down and tap{' '}
                          <strong className="text-white">Add to Home Screen</strong>{' '}
                          <PlusSquare className="inline w-3.5 h-3.5 text-[#5eead4] -mt-0.5" />.
                        </span>
                      </li>
                    </ol>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-[#5eead4]">Install on Android:</p>
                    <ol className="space-y-1.5 text-white/80">
                      <li className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
                          1
                        </span>
                        <span>
                          Tap the browser menu{' '}
                          <MoreVertical className="inline w-3.5 h-3.5 text-[#5eead4] -mt-0.5" /> in
                          the top corner.
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
                          2
                        </span>
                        <span>
                          Tap <strong className="text-white">Install app</strong> or{' '}
                          <strong className="text-white">Add to Home screen</strong>.
                        </span>
                      </li>
                    </ol>
                  </>
                )}
                <button
                  type="button"
                  onClick={dismiss}
                  className="w-full mt-1 rounded-lg bg-white/10 py-1.5 text-[12px] font-semibold text-white hover:bg-white/15 cursor-pointer"
                >
                  Got it
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

