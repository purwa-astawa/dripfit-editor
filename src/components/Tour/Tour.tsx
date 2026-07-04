import { useEffect, useState } from 'react';
import Joyride, { STATUS, type CallBackProps, type Step } from 'react-joyride';
import { useEditorStore } from '../../store/editorStore';

// Two onboarding phases, each remembered separately in localStorage:
//   1. "intro"  — before an image is loaded, point at the URL input.
//   2. "tools"  — once an image is loaded, point at the POI and Region tools.
const INTRO_KEY = 'dripfit-tour-intro-seen';
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
    target: '[data-tour="image-url"]',
    disableBeacon: true,
    placement: 'bottom',
    title: '👋 Start here',
    content:
      'Add a background image first. Paste a public image URL (Dropbox and Google Drive share links work) and click Load. Once it appears on the canvas you can start placing POI and region callouts.',
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

type Phase = 'intro' | 'tools' | null;

/**
 * Onboarding tour. Shows the "intro" step until an image is loaded, then—once a
 * background image is in place—runs the "tools" tour highlighting the POI and
 * Region tools. Each phase is shown once and remembered via localStorage.
 */
export function Tour() {
  const image = useEditorStore((s) => s.image);
  const [phase, setPhase] = useState<Phase>(null);

  // On mount, start the intro phase if no image is loaded yet.
  useEffect(() => {
    if (!image && !hasSeen(INTRO_KEY)) setPhase('intro');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When an image loads: the intro is fulfilled — close it and, if the tools
  // tour hasn't been shown, start it (after a beat so the now-enabled tool
  // buttons have rendered as valid targets).
  useEffect(() => {
    if (!image) return;
    markSeen(INTRO_KEY);
    setPhase(null);
    if (!hasSeen(TOOLS_KEY)) {
      const t = setTimeout(() => setPhase('tools'), 350);
      return () => clearTimeout(t);
    }
  }, [image]);

  const steps =
    phase === 'intro' ? introSteps : phase === 'tools' ? toolsSteps : [];

  const handleCallback = (data: CallBackProps) => {
    const done: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (done.includes(data.status)) {
      if (phase) markSeen(phase === 'intro' ? INTRO_KEY : TOOLS_KEY);
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
          zIndex: 10000,
        },
      }}
    />
  );
}
