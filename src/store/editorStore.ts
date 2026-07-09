import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Beacon,
  Callout,
  CalloutProduct,
  ImageMeta,
  DripfitConfig,
  DisplayOptions,
  Shape,
} from '../lib/schema';
import {
  DEFAULT_API_VERSION,
  DEFAULT_CARD_SHAPE,
  DEFAULT_CARD_DETAILS,
  MIN_LINE_LENGTH,
  makeBeacon,
  syncBeacon,
  parseDripfitConfig,
} from '../lib/schema';
import { normalizeImageUrl } from '../lib/imageUrl';

export type Tool = 'select' | 'place-point' | 'draw-region' | 'draw-line';

/** How a selected product's card (replacing the beacon in preview) shows its
 *  details: always visible, or hidden behind an info button. Applied globally.
 *  Derived from the dripfit-config `display` contract (schema.ts). */
export type ProductCardMode = DisplayOptions['details'];

/** The selected-product card's image shape in preview. Applied globally. */
export type ProductCardShape = DisplayOptions['shape'];

/** Lifecycle of loading a background image from a URL. */
export type ImageStatus = 'idle' | 'loading' | 'error';

export interface Point {
  x: number;
  y: number;
}

/** Shopify connection config embedded in the exported dripfit-config. */
export interface ShopifyConfig {
  storefrontApiKey: string;
  shopDomain: string;
  apiVersion: string;
}

export interface EditorState {
  mapId: string;
  /** Human-readable config name, exported and used by the Visualizer to tag
   *  purchased products for attribution. */
  title: string;
  image: ImageMeta | null;
  imageStatus: ImageStatus;
  imageError: string | null;
  callouts: Callout[];
  selectedCalloutId: string | null;
  tool: Tool;
  draftRegionPoints: Point[];
  /** First endpoint of a pointer line being drawn (draw-line tool); the second
   *  click commits the line. Null when no line is in progress. */
  draftLineStart: Point | null;

  // Shopify connection settings (persisted to sessionStorage).
  storefrontApiKey: string;
  shopDomain: string;
  apiVersion: string;

  // UI: whether the Configure modal is open (shared so the tour can react).
  configureOpen: boolean;
  // UI: preview beacons on the canvas. Off by default so they don't clutter
  // editing; toggled from the toolbar.
  beaconPreview: boolean;
  // UI (global): how a selected product's card displays in preview.
  productCardMode: ProductCardMode;
  productCardShape: ProductCardShape;

  setImage: (url: string, width: number, height: number) => void;
  setTitle: (title: string) => void;
  setConfigureOpen: (open: boolean) => void;
  setBeaconPreview: (on: boolean) => void;
  setProductCardMode: (mode: ProductCardMode) => void;
  setProductCardShape: (shape: ProductCardShape) => void;
  setShopifyConfig: (patch: Partial<ShopifyConfig>) => void;
  /** Load a public image URL: sets imageStatus 'loading', then resolves the
   *  image's natural dimensions and stores it (or sets 'error'). */
  loadImageFromUrl: (url: string) => void;
  setTool: (tool: Tool) => void;
  addPointCallout: (cx: number, cy: number) => string;
  /** Set the pending first endpoint for a pointer line (first draw-line click). */
  startLine: (x: number, y: number) => void;
  /** Commit a pointer line from the pending start to (x, y). No-ops (and clears
   *  the pending start) if the two points are closer than MIN_LINE_LENGTH. */
  commitLine: (x: number, y: number) => string | null;
  clearDraftLine: () => void;
  addRegionPoint: (x: number, y: number) => void;
  clearDraftRegion: () => void;
  commitDraftRegion: (label?: string) => string | null;
  updateCallout: (id: string, patch: Partial<Omit<Callout, 'id'>>) => void;
  updateCalloutShape: (id: string, shape: Shape) => void;
  /** Update a callout's beacon appearance/position. Coordinate is resynced from
   *  the shape (a position change moves it; size/color leave it in place). */
  updateCalloutBeacon: (
    id: string,
    patch: Partial<Pick<Beacon, 'position' | 'size' | 'color'>>,
  ) => void;
  setCalloutProducts: (id: string, products: CalloutProduct[]) => void;
  selectCallout: (id: string | null) => void;
  deleteCallout: (id: string) => void;
  /** Serialize the store to the dripfit-config shape. `products` is left empty — the
   *  UI export step bakes the snapshot from the active product source. */
  exportJson: () => DripfitConfig;
  loadFromJson: (json: unknown) => void;
  reset: () => void;
}

// --- sessionStorage persistence for Shopify config -------------------------

const SS_KEYS = {
  key: 'dripfit-storefront-key',
  domain: 'dripfit-shop-domain',
  version: 'dripfit-api-version',
} as const;

function loadShopifyConfig(): ShopifyConfig {
  try {
    return {
      storefrontApiKey: sessionStorage.getItem(SS_KEYS.key) ?? '',
      shopDomain: sessionStorage.getItem(SS_KEYS.domain) ?? '',
      apiVersion: sessionStorage.getItem(SS_KEYS.version) || DEFAULT_API_VERSION,
    };
  } catch {
    return { storefrontApiKey: '', shopDomain: '', apiVersion: DEFAULT_API_VERSION };
  }
}

function persistShopifyConfig(cfg: ShopifyConfig): void {
  try {
    sessionStorage.setItem(SS_KEYS.key, cfg.storefrontApiKey);
    sessionStorage.setItem(SS_KEYS.domain, cfg.shopDomain);
    sessionStorage.setItem(SS_KEYS.version, cfg.apiVersion);
  } catch {
    /* sessionStorage unavailable — config stays in-memory only */
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Deep-clone a shape so exported callouts can't mutate store state. */
function cloneShape(shape: Shape): Shape {
  switch (shape.type) {
    case 'circle':
      return { ...shape };
    case 'region':
      return { type: 'region', points: shape.points.map((p) => ({ ...p })) };
    case 'line':
      return {
        type: 'line',
        start: { ...shape.start },
        end: { ...shape.end },
        bulletEnd: shape.bulletEnd,
      };
  }
}

const DEFAULT_POINT_RADIUS = 0.02; // ratio of image width

export const useEditorStore = create<EditorState>()(
  devtools(
    (set, get) => ({
      mapId: uuid(),
      title: '',
      image: null,
      imageStatus: 'idle',
      imageError: null,
      callouts: [],
      selectedCalloutId: null,
      tool: 'select',
      draftRegionPoints: [],
      draftLineStart: null,
      configureOpen: false,
      beaconPreview: false,
      productCardMode: DEFAULT_CARD_DETAILS,
      productCardShape: DEFAULT_CARD_SHAPE,
      ...loadShopifyConfig(),

      setImage: (url, width, height) =>
        set(
          { image: { url, width, height }, imageStatus: 'idle', imageError: null },
          false,
          'setImage',
        ),

      setTitle: (title) => set({ title }, false, 'setTitle'),

      setConfigureOpen: (open) =>
        set({ configureOpen: open }, false, 'setConfigureOpen'),

      setBeaconPreview: (on) =>
        set({ beaconPreview: on }, false, 'setBeaconPreview'),

      setProductCardMode: (mode) =>
        set({ productCardMode: mode }, false, 'setProductCardMode'),

      setProductCardShape: (shape) =>
        set({ productCardShape: shape }, false, 'setProductCardShape'),

      setShopifyConfig: (patch) =>
        set(
          (state) => {
            const next: ShopifyConfig = {
              storefrontApiKey: patch.storefrontApiKey ?? state.storefrontApiKey,
              shopDomain: patch.shopDomain ?? state.shopDomain,
              apiVersion: patch.apiVersion ?? state.apiVersion,
            };
            persistShopifyConfig(next);
            return next;
          },
          false,
          'setShopifyConfig',
        ),

      loadImageFromUrl: (url) => {
        // Rewrite Dropbox / Google Drive share links to their direct-image form.
        const src = normalizeImageUrl(url);
        if (!src) return;
        set({ imageStatus: 'loading', imageError: null }, false, 'loadImage/start');

        const probe = new Image();
        probe.onload = () => {
          // Ignore a resolved load if a newer request superseded this one.
          if (get().imageStatus !== 'loading') return;
          set(
            {
              image: {
                url: src,
                width: probe.naturalWidth,
                height: probe.naturalHeight,
              },
              imageStatus: 'idle',
              imageError: null,
            },
            false,
            'loadImage/success',
          );
        };
        probe.onerror = () => {
          set(
            {
              imageStatus: 'error',
              imageError: 'Could not load an image from that URL.',
            },
            false,
            'loadImage/error',
          );
        };
        probe.src = src;
      },

      setTool: (tool) =>
        set(
          (state) => ({
            tool,
            // Leaving a drawing mode discards any in-progress draft.
            draftRegionPoints:
              tool === 'draw-region' ? state.draftRegionPoints : [],
            draftLineStart: tool === 'draw-line' ? state.draftLineStart : null,
          }),
          false,
          'setTool',
        ),

      addPointCallout: (cx, cy) => {
        const id = uuid();
        const shape: Shape = { type: 'circle', cx, cy, r: DEFAULT_POINT_RADIUS };
        const callout: Callout = {
          id,
          label: `Callout ${get().callouts.length + 1}`,
          shape,
          beacon: makeBeacon(shape),
          products: [],
        };
        set(
          (state) => ({
            callouts: [...state.callouts, callout],
            selectedCalloutId: id,
          }),
          false,
          'addPointCallout',
        );
        return id;
      },

      startLine: (x, y) =>
        set({ draftLineStart: { x, y } }, false, 'startLine'),

      clearDraftLine: () => set({ draftLineStart: null }, false, 'clearDraftLine'),

      commitLine: (x, y) => {
        const start = get().draftLineStart;
        if (!start) return null;
        // Guard against a zero-length line (two clicks in ~the same spot): it
        // would be invisible and un-clickable, with beacon and bullet coincident.
        if (Math.hypot(x - start.x, y - start.y) < MIN_LINE_LENGTH) {
          set({ draftLineStart: null }, false, 'commitLine/degenerate');
          return null;
        }
        const id = uuid();
        const shape: Shape = {
          type: 'line',
          start: { ...start },
          end: { x, y },
          bulletEnd: 'end',
        };
        const callout: Callout = {
          id,
          label: `Pointer Line ${get().callouts.length + 1}`,
          shape,
          beacon: makeBeacon(shape),
          products: [],
        };
        set(
          (state) => ({
            callouts: [...state.callouts, callout],
            draftLineStart: null,
            selectedCalloutId: id,
            tool: 'select',
          }),
          false,
          'commitLine',
        );
        return id;
      },

      addRegionPoint: (x, y) =>
        set(
          (state) => ({
            draftRegionPoints: [...state.draftRegionPoints, { x, y }],
          }),
          false,
          'addRegionPoint',
        ),

      clearDraftRegion: () =>
        set({ draftRegionPoints: [] }, false, 'clearDraftRegion'),

      commitDraftRegion: (label) => {
        const points = get().draftRegionPoints;
        if (points.length < 3) return null; // guard: regions need ≥3 points
        const id = uuid();
        const shape: Shape = {
          type: 'region',
          points: points.map((p) => ({ ...p })),
        };
        const callout: Callout = {
          id,
          label: label?.trim() || `Region ${get().callouts.length + 1}`,
          shape,
          beacon: makeBeacon(shape),
          products: [],
        };
        set(
          (state) => ({
            callouts: [...state.callouts, callout],
            draftRegionPoints: [],
            selectedCalloutId: id,
            tool: 'select',
          }),
          false,
          'commitDraftRegion',
        );
        return id;
      },

      updateCallout: (id, patch) =>
        set(
          (state) => ({
            callouts: state.callouts.map((c) =>
              c.id === id ? { ...c, ...patch } : c,
            ),
          }),
          false,
          'updateCallout',
        ),

      updateCalloutShape: (id, shape) =>
        set(
          (state) => ({
            callouts: state.callouts.map((c) =>
              // Keep the beacon's coordinate in sync with the shape (dragging or
              // reshaping moves the bounding box / circle centre).
              c.id === id
                ? { ...c, shape, beacon: syncBeacon(shape, c.beacon) }
                : c,
            ),
          }),
          false,
          'updateCalloutShape',
        ),

      updateCalloutBeacon: (id, patch) =>
        set(
          (state) => ({
            callouts: state.callouts.map((c) =>
              c.id === id
                ? { ...c, beacon: syncBeacon(c.shape, { ...c.beacon, ...patch }) }
                : c,
            ),
          }),
          false,
          'updateCalloutBeacon',
        ),

      setCalloutProducts: (id, products) =>
        set(
          (state) => ({
            callouts: state.callouts.map((c) =>
              c.id === id
                ? { ...c, products: products.map((p) => ({ ...p })) }
                : c,
            ),
          }),
          false,
          'setCalloutProducts',
        ),

      selectCallout: (id) =>
        set({ selectedCalloutId: id }, false, 'selectCallout'),

      deleteCallout: (id) =>
        set(
          (state) => ({
            callouts: state.callouts.filter((c) => c.id !== id),
            selectedCalloutId:
              state.selectedCalloutId === id ? null : state.selectedCalloutId,
          }),
          false,
          'deleteCallout',
        ),

      exportJson: () => {
        const {
          mapId,
          title,
          image,
          callouts,
          storefrontApiKey,
          shopDomain,
          apiVersion,
          productCardShape,
          productCardMode,
        } = get();
        return {
          title,
          posterUrl: image?.url ?? '',
          storefrontAPIKey: storefrontApiKey,
          shopDomain,
          apiVersion,
          display: { shape: productCardShape, details: productCardMode },
          data: {
            mapId,
            image: { width: image?.width ?? 0, height: image?.height ?? 0 },
            // Deep clone so callers can't mutate store state.
            callouts: callouts.map((c) => ({
              id: c.id,
              label: c.label,
              shape: cloneShape(c.shape),
              beacon: { ...c.beacon },
              products: c.products.map((p) => ({ ...p })),
            })),
            // Baked snapshot is filled in by the UI export step (async, from the
            // active product source). Empty here.
            products: {},
          },
        };
      },

      loadFromJson: (json) => {
        const doc = parseDripfitConfig(json);
        const cfg = {
          storefrontApiKey: doc.storefrontAPIKey,
          shopDomain: doc.shopDomain,
          apiVersion: doc.apiVersion || DEFAULT_API_VERSION,
        };
        persistShopifyConfig(cfg);
        set(
          {
            mapId: doc.data.mapId || uuid(),
            title: doc.title,
            image: doc.posterUrl
              ? {
                  url: doc.posterUrl,
                  width: doc.data.image.width,
                  height: doc.data.image.height,
                }
              : null,
            imageStatus: 'idle',
            imageError: null,
            callouts: doc.data.callouts,
            productCardShape: doc.display.shape,
            productCardMode: doc.display.details,
            selectedCalloutId: null,
            tool: 'select',
            draftRegionPoints: [],
            draftLineStart: null,
            ...cfg,
          },
          false,
          'loadFromJson',
        );
      },

      reset: () =>
        set(
          {
            mapId: uuid(),
            title: '',
            image: null,
            imageStatus: 'idle',
            imageError: null,
            callouts: [],
            selectedCalloutId: null,
            tool: 'select',
            draftRegionPoints: [],
            draftLineStart: null,
          },
          false,
          'reset',
        ),
    }),
    { name: 'dripfit-editor' },
  ),
);
