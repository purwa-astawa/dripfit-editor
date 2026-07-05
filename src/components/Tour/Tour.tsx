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
      'Open Configure to get set up — load a background image, connect your Shopify store, or import an existing dripfit-config.',
  },
];

const configureSteps: Step[] = [
  {
    target: '[data-tour="cfg-title"]',
    disableBeacon: true,
    placement: 'bottom',
    title: '1 · Title',
    content:
      'Give this dripfit-config a name, e.g. “Summer 2026 Lookbook”. The storefront widget tags every product purchased through it with this title, so you can attribute sales back to this config.',
  },
  {
    target: '[data-tour="cfg-image"]',
    disableBeacon: true,
    placement: 'bottom',
    title: '2 · Background image',
    content:
      'Paste a public image URL here and press Enter (or click Load). Dropbox and Google Drive share links work — the file just needs to be publicly shared. This poster is what shoppers see behind the callouts.',
  },
  {
    target: '[data-tour="cfg-domain"]',
    disableBeacon: true,
    placement: 'bottom',
    title: '3 · Shop domain',
    content:
      'Your Shopify store domain, e.g. your-shop.myshopify.com. The storefront widget uses it to look up products live.',
  },
  {
    target: '[data-tour="cfg-token"]',
    disableBeacon: true,
    placement: 'bottom',
    title: '4 · Storefront API access token',
    content:
      'A public Storefront API access token. It’s safe to embed in the exported dripfit-config and lets the widget fetch product details (title, image).',
  },
  {
    target: '[data-tour="cfg-import"]',
    disableBeacon: true,
    placement: 'top',
    title: '5 · Import a dripfit-config',
    content:
      'Already have a dripfit-config? Paste its JSON here (or use “From file”) to keep editing an existing one instead of starting fresh.',
  },
];

const toolsSteps: Step[] = [
  {
    target: '[data-tour="tools"]',
    disableBeacon: true,
    placement: 'bottom',
    title: 'Mark where shoppers interact',
    content:
      'Both tools define clickable spots shoppers tap in the storefront. POI drops a single point — one clickable spot (e.g. a product on the model). Region outlines a whole area that’s interactive — click to add points, then double-click or press Enter to finish. Either way, select it afterwards to label it and attach products.',
  },
  {
    target: '[data-tour="callouts"]',
    disableBeacon: true,
    placement: 'left',
    title: 'Your callouts',
    content:
      'Each point or region you place is a callout — a spot shoppers tap in the storefront to see its products. Every callout you add is listed here; select one to rename it, style its beacon, and attach products.',
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
