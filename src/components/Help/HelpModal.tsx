import { useState } from 'react';
import {
  X,
  KeyRound,
  Image as ImageIcon,
  Mail,
  ChevronDown,
} from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface AccordionItemProps {
  icon: typeof KeyRound;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionItem({
  icon: Icon,
  title,
  isOpen,
  onToggle,
  children,
}: AccordionItemProps) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-100"
      >
        <Icon size={15} className="flex-none text-slate-500" />
        <span className="flex-1">{title}</span>
        <ChevronDown
          size={16}
          className={[
            'flex-none text-slate-400 transition-transform',
            isOpen ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>
      {isOpen && (
        <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-700">
          {children}
        </div>
      )}
    </div>
  );
}

/** Help & FAQ — how to get a Storefront token, the per-product `dripfit`
 *  metafield image override, and a contact link. The two how-tos are collapsed
 *  into an accordion to keep the modal scannable. */
export function HelpModal({ open, onClose }: Props) {
  // Which accordion section is expanded (null = all collapsed).
  const [expanded, setExpanded] = useState<'token' | 'image' | null>(null);

  if (!open) return null;

  const toggle = (key: 'token' | 'image') =>
    setExpanded((cur) => (cur === key ? null : key));

  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Help &amp; FAQ</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto p-4 text-sm text-slate-700">
          {/* 1 · Storefront token */}
          <AccordionItem
            icon={KeyRound}
            title="How do I get a public Storefront API access token?"
            isOpen={expanded === 'token'}
            onToggle={() => toggle('token')}
          >
            <p>
              The token is a <strong>public</strong> Storefront API key — safe to
              embed in your exported dripfit-config. You create it by setting up a{' '}
              <strong>Headless</strong> storefront in your Shopify admin:
            </p>
            <ol className="ml-5 list-decimal space-y-1.5">
              <li>
                Install the{' '}
                <a
                  href="https://apps.shopify.com/headless"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-700"
                >
                  Headless sales channel
                </a>{' '}
                app from the Shopify App Store.
              </li>
              <li>
                In your admin, open <strong>Sales channels → Headless</strong> and
                click <strong>Create storefront</strong>.
              </li>
              <li>
                Open that storefront and find the <strong>Storefront API</strong>{' '}
                section. Copy the <strong>Public access token</strong> (a
                32-character hex string).
              </li>
              <li>
                Make sure the storefront has the{' '}
                <em>“Read products, variants, and collections”</em> Storefront API
                permission enabled so the widget can fetch product details.
              </li>
              <li>
                Paste that token into{' '}
                <strong>Configure → Storefront API access token</strong>.
              </li>
            </ol>
            <p className="text-slate-500">
              Prefer a custom app? You can instead go to{' '}
              <strong>
                Settings → Apps and sales channels → Develop apps → Create an app
              </strong>
              , enable the Storefront API scopes, install it, then reveal the
              Storefront API access token. See Shopify’s{' '}
              <a
                href="https://shopify.dev/docs/api/usage/authentication#access-tokens-for-the-storefront-api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-700"
              >
                authentication docs
              </a>{' '}
              for details.
            </p>
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Use the <strong>public Storefront</strong> token — never an Admin API
              token or app secret. Only the public token is safe to ship in the
              config.
            </p>
          </AccordionItem>

          {/* 2 · dripfit metafield image override */}
          <AccordionItem
            icon={ImageIcon}
            title="Can I show a different image than the product’s featured image?"
            isOpen={expanded === 'image'}
            onToggle={() => toggle('image')}
          >
            <p>
              Yes. Add a <strong>product metafield</strong> named{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                dripfit
              </code>{' '}
              to the product, and the Visualizer will use that image for the
              selected-product card instead of the store’s featured image.
            </p>
            <ol className="ml-5 list-decimal space-y-1.5">
              <li>
                In Shopify admin go to{' '}
                <strong>Settings → Custom data → Products</strong> and{' '}
                <strong>Add definition</strong>.
              </li>
              <li>
                Name it <strong>dripfit</strong> (namespace/key{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                  dripfit
                </code>
                ), choose the <strong>File</strong> (image) or <strong>URL</strong>{' '}
                type, and save.
              </li>
              <li>
                Open the product, scroll to <strong>Metafields</strong>, and set
                the <strong>dripfit</strong> image you want shown in the widget.
              </li>
            </ol>
            <p className="text-slate-500">
              If a product has no <code className="font-mono">dripfit</code>{' '}
              metafield, the widget falls back to its normal featured image.
            </p>
          </AccordionItem>

          {/* 3 · Contact — always visible */}
          <section className="flex flex-col gap-2 border-t border-slate-200 pt-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <Mail size={15} /> Still have questions?
            </h3>
            <p>
              Email us at{' '}
              <a
                href="mailto:info@garusin.com"
                className="font-medium text-blue-600 underline hover:text-blue-700"
              >
                info@garusin.com
              </a>{' '}
              and we’ll help you out.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
