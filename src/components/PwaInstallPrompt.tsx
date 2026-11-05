import { useEffect, useState } from 'react';
import { Download, MoreVertical, PlusSquare, Share, X } from 'lucide-react';
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
      <div className="pointer-events-auto w-full max-w-[420px] fade-up rounded-2xl border border-line bg-surface text-ink p-4 shadow-[0_12px_40px_rgba(11,14,17,0.16)]">
        <div className="flex items-start gap-3.5">
          <BrandMark size={42} className="mt-0.5" />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[14.5px] font-bold tracking-tight text-ink">
                  Install {BRAND_NAME}
                </h3>
                <p className="text-[12px] text-ink-soft leading-snug mt-0.5">
                  Add to your phone home screen for fast 1-tap access and live MT5 tracking.
                </p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Close install prompt"
                className="p-1 -mr-1 -mt-1 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-2 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!showGuide ? (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInstall}
                  className="btn btn-primary flex-1 py-2 text-[12.5px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Install App
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="btn btn-ghost py-2 px-3 text-[12.5px]"
                >
                  Later
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-[12px] text-ink-soft space-y-2">
                {isIOS ? (
                  <>
                    <p className="font-semibold text-ink">Install on iPhone / iPad:</p>
                    <ol className="space-y-1.5">
                      <li className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface border border-line text-[11px] font-bold text-ink">
                          1
                        </span>
                        <span>
                          Tap <strong className="text-ink">Share</strong>{' '}
                          <Share className="inline w-3.5 h-3.5 text-ink -mt-0.5" /> in Safari.
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface border border-line text-[11px] font-bold text-ink">
                          2
                        </span>
                        <span>
                          Tap <strong className="text-ink">Add to Home Screen</strong>{' '}
                          <PlusSquare className="inline w-3.5 h-3.5 text-ink -mt-0.5" />.
                        </span>
                      </li>
                    </ol>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-ink">Install on Android:</p>
                    <ol className="space-y-1.5">
                      <li className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface border border-line text-[11px] font-bold text-ink">
                          1
                        </span>
                        <span>
                          Tap the browser menu{' '}
                          <MoreVertical className="inline w-3.5 h-3.5 text-ink -mt-0.5" /> in the
                          top corner.
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface border border-line text-[11px] font-bold text-ink">
                          2
                        </span>
                        <span>
                          Tap <strong className="text-ink">Install app</strong> or{' '}
                          <strong className="text-ink">Add to Home screen</strong>.
                        </span>
                      </li>
                    </ol>
                  </>
                )}
                <button
                  type="button"
                  onClick={dismiss}
                  className="btn btn-ghost w-full py-1.5 text-[12px]"
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
