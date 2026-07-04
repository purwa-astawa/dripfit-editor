import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Callout, ImageMeta, Shape } from '../lib/schema';
import { parseMapDocument } from '../lib/schema';
import { normalizeImageUrl } from '../lib/imageUrl';

export type Tool = 'select' | 'place-point' | 'draw-region';

/** Lifecycle of loading a background image from a URL. */
export type ImageStatus = 'idle' | 'loading' | 'error';

export interface Point {
  x: number;
  y: number;
}

export interface EditorState {
  mapId: string;
  image: ImageMeta | null;
  imageStatus: ImageStatus;
  imageError: string | null;
  callouts: Callout[];
  selectedCalloutId: string | null;
  tool: Tool;
  draftRegionPoints: Point[];

  setImage: (url: string, width: number, height: number) => void;
  /** Load a public image URL: sets imageStatus 'loading', then resolves the
   *  image's natural dimensions and stores it (or sets 'error'). */
  loadImageFromUrl: (url: string) => void;
  setTool: (tool: Tool) => void;
  addPointCallout: (cx: number, cy: number) => string;
  addRegionPoint: (x: number, y: number) => void;
  clearDraftRegion: () => void;
  commitDraftRegion: (label?: string) => string | null;
  updateCallout: (id: string, patch: Partial<Omit<Callout, 'id'>>) => void;
  updateCalloutShape: (id: string, shape: Shape) => void;
  setCalloutProducts: (id: string, productIds: string[]) => void;
  selectCallout: (id: string | null) => void;
  deleteCallout: (id: string) => void;
  exportJson: () => object;
  loadFromJson: (json: unknown) => void;
  reset: () => void;
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

const DEFAULT_POINT_RADIUS = 0.02; // ratio of image width

export const useEditorStore = create<EditorState>()(
  devtools(
    (set, get) => ({
      mapId: uuid(),
      image: null,
      imageStatus: 'idle',
      imageError: null,
      callouts: [],
      selectedCalloutId: null,
      tool: 'select',
      draftRegionPoints: [],

      setImage: (url, width, height) =>
        set(
          { image: { url, width, height }, imageStatus: 'idle', imageError: null },
          false,
          'setImage',
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
            // Leaving region mode discards any in-progress draft.
            draftRegionPoints:
              tool === 'draw-region' ? state.draftRegionPoints : [],
          }),
          false,
          'setTool',
        ),

      addPointCallout: (cx, cy) => {
        const id = uuid();
        const callout: Callout = {
          id,
          label: `Callout ${get().callouts.length + 1}`,
          shape: { type: 'circle', cx, cy, r: DEFAULT_POINT_RADIUS },
          productIds: [],
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
        const callout: Callout = {
          id,
          label: label?.trim() || `Region ${get().callouts.length + 1}`,
          shape: { type: 'region', points: points.map((p) => ({ ...p })) },
          productIds: [],
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
              c.id === id ? { ...c, shape } : c,
            ),
          }),
          false,
          'updateCalloutShape',
        ),

      setCalloutProducts: (id, productIds) =>
        set(
          (state) => ({
            callouts: state.callouts.map((c) =>
              c.id === id ? { ...c, productIds: [...productIds] } : c,
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
        const { mapId, image, callouts } = get();
        return {
          mapId,
          image: image ?? { url: '', width: 0, height: 0 },
          // Deep clone so callers can't mutate store state.
          callouts: callouts.map((c) => ({
            id: c.id,
            label: c.label,
            shape:
              c.shape.type === 'circle'
                ? { ...c.shape }
                : {
                    type: 'region' as const,
                    points: c.shape.points.map((p) => ({ ...p })),
                  },
            productIds: [...c.productIds],
          })),
        };
      },

      loadFromJson: (json) => {
        const doc = parseMapDocument(json);
        set(
          {
            mapId: doc.mapId,
            image: doc.image,
            imageStatus: 'idle',
            imageError: null,
            callouts: doc.callouts,
            selectedCalloutId: null,
            tool: 'select',
            draftRegionPoints: [],
          },
          false,
          'loadFromJson',
        );
      },

      reset: () =>
        set(
          {
            mapId: uuid(),
            image: null,
            imageStatus: 'idle',
            imageError: null,
            callouts: [],
            selectedCalloutId: null,
            tool: 'select',
            draftRegionPoints: [],
          },
          false,
          'reset',
        ),
    }),
    { name: 'dripfit-editor' },
  ),
);
