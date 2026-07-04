import { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';

// Treat a device as a "phone" when its shorter viewport side is below this many
// CSS pixels — catches phones in both portrait and landscape while letting
// tablets (short side ≥ 600px, e.g. iPad) and laptops/desktops through.
const PHONE_MAX_MIN_SIDE = 600;

function isPhoneViewport(): boolean {
  return Math.min(window.innerWidth, window.innerHeight) < PHONE_MAX_MIN_SIDE;
}

/**
 * Full-screen advisory shown on phone-sized screens. The image mapper needs the
 * room of a tablet/laptop/desktop for precise callout placement, so we warn but
 * still let the user continue.
 */
export function MobileWarning() {
  const [isPhone, setIsPhone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const update = () => setIsPhone(isPhoneViewport());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  if (!isPhone || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[11000] flex flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <Monitor size={48} strokeWidth={1.5} className="text-blue-600" />
      <h1 className="text-lg font-semibold text-slate-800">
        Best viewed on a bigger screen
      </h1>
      <p className="max-w-xs text-sm leading-relaxed text-slate-500">
        DripFit Lab’s image mapper is designed for a tablet, laptop, or desktop —
        placing and dragging callouts needs a larger screen than a phone. For the
        best experience, open this on a tablet or computer.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Continue anyway
      </button>
    </div>
  );
}
