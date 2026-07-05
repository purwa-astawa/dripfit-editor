import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { HelpModal } from './HelpModal';

/** Floating help affordance pinned to the bottom-right, opening the Help & FAQ
 *  modal. */
export function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Help"
        title="Help & FAQ"
        className="fixed bottom-4 right-4 z-[11000] flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700"
      >
        <HelpCircle size={22} />
      </button>
      <HelpModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
