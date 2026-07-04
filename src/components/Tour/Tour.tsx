import { useEffect, useState } from 'react';
import Joyride, { STATUS, type CallBackProps, type Step } from 'react-joyride';
import { useEditorStore } from '../../store/editorStore';

// Onboarding phases, each remembered separately in localStorage:
//   1. "intro"     — before setup, point at the Configure button.
//   2. "configure" — while the Configure modal is open, walk its fields.
//   3. "tools"     — once an image is loaded, point at the POI and Region tools.
const INTRO_KEY = 'dripfit-tour-intro-seen';
const CONFIG_KEY = 'dripfit-tour-config-seen';
const TOOLS_KEY = 'dripfit-tour-tools-seen';

function markSeen(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* localStorage unavailable (private mode) — ignore */
  }
}

function hasSeen(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

const introSteps: Step[] = [
  {
    target: '[data-tour="configure"]',
    disableBeacon: true,
    placement: 'bottom',
    title: '👋 Start here — Configure',
    content:
      'Open Configure to get set up — load a background image, connect your Shopify store, or import an existing map.json.',
  },
];

const configureSteps: Step[] = [
  {
    target: '[data-tour="cfg-image"]',
    disableBeacon: true,
    placement: 'bottom',
    title: '1 · Background image',
    content:
      'Paste a public image URL here and press Enter (or click Load). Dropbox and Google Drive share links work — the file just needs to be publicly shared. This poster is what shoppers see behind the callouts.',
  },
  {
    target: '[data-tour="cfg-domain"]',
    disableBeacon: true,
    placement: 'bottom',
    title: '2 · Shop domain',
    content:
      'Your Shopify store domain, e.g. your-shop.myshopify.com. The storefront widget uses it to look up products live.',
  },
  {
    target: '[data-tour="cfg-token"]',
    disableBeacon: true,
    placement: 'bottom',
    title: '3 · Storefront API access token',
    content:
      'A public Storefront API access token. It’s safe to embed in the exported map.json and lets the widget fetch product details (title, image).',
  },
  {
    target: '[data-tour="cfg-import"]',
    disableBeacon: true,
    placement: 'top',
    title: '4 · Import a map.json',
    content:
      'Already have a map? Paste its JSON here (or use “From file”) to keep editing an existing map instead of starting fresh.',
  },
];

const toolsSteps: Step[] = [
  {
    target: '[data-tour="tool-place-point"]',
    disableBeacon: true,
    placement: 'bottom',
    title: 'Place a POI',
    content:
      'The POI tool drops a single point on the image — click wherever a product sits. Select the callout afterwards to label it and attach products.',
  },
  {
    target: '[data-tour="tool-draw-region"]',
    disableBeacon: true,
    placement: 'bottom',
    title: 'Draw a Region',
    content:
      'The Region tool outlines an area — click to add points, then double-click or press Enter to finish. Attach products to the region just like a POI.',
  },
];

type Phase = 'intro' | 'configure' | 'tools' | null;

/**
 * Onboarding tour. Intro points at Configure; opening Configure walks its fields;
 * once an image is loaded (and the modal closed), the tools tour runs. Each phase
 * shows once and is remembered via localStorage.
 */
export function Tour() {
  const image = useEditorStore((s) => s.image);
  const configureOpen = useEditorStore((s) => s.configureOpen);
  const [phase, setPhase] = useState<Phase>(null);

  // On mount, start the intro if nothing is set up yet.
  useEffect(() => {
    if (!hasSeen(INTRO_KEY) && !image && !configureOpen) setPhase('intro');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opening/closing Configure drives the configure phase.
  useEffect(() => {
    if (configureOpen) {
      markSeen(INTRO_KEY); // opening it fulfils the intro
      if (!hasSeen(CONFIG_KEY)) {
        setPhase(null); // clear intro first
        const t = setTimeout(() => setPhase('configure'), 250);
        return () => clearTimeout(t);
      }
      setPhase((p) => (p === 'intro' ? null : p));
    } else {
      // Closing ends the configure walkthrough (and remembers it).
      setPhase((p) => {
        if (p === 'configure') {
          markSeen(CONFIG_KEY);
          return null;
        }
        return p;
      });
    }
  }, [configureOpen]);

  // Once an image is loaded and the modal is closed, run the tools tour.
  useEffect(() => {
    if (!image || configureOpen) return;
    markSeen(INTRO_KEY);
    if (!hasSeen(TOOLS_KEY)) {
      const t = setTimeout(() => setPhase('tools'), 350);
      return () => clearTimeout(t);
    }
  }, [image, configureOpen]);

  const steps =
    phase === 'intro'
      ? introSteps
      : phase === 'configure'
        ? configureSteps
        : phase === 'tools'
          ? toolsSteps
          : [];

  const handleCallback = (data: CallBackProps) => {
    const done: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (done.includes(data.status)) {
      if (phase === 'intro') markSeen(INTRO_KEY);
      else if (phase === 'configure') markSeen(CONFIG_KEY);
      else if (phase === 'tools') markSeen(TOOLS_KEY);
      setPhase(null);
    }
  };

  return (
    <Joyride
      key={phase ?? 'idle'}
      steps={steps}
      run={phase !== null}
      continuous
      showSkipButton
      disableOverlayClose
      callback={handleCallback}
      locale={{ last: 'Got it', skip: 'Skip', next: 'Next', back: 'Back' }}
      styles={{
        options: {
          primaryColor: '#2563eb',
          textColor: '#1e293b',
          backgroundColor: '#ffffff',
          arrowColor: '#ffffff',
          // Above the modals (z-[12000]) so field tooltips sit on top.
          zIndex: 13000,
        },
      }}
    />
  );
}
