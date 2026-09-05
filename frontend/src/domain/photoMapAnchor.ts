export type PhotoMapAnchorSnapshot = {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
  visible: boolean;
};

/** Map-library-neutral access to permanent photo marker screen positions. */
export interface PhotoMapAnchor {
  getSnapshot: (photoId: number) => PhotoMapAnchorSnapshot | null;
  subscribe: (listener: () => void) => () => void;
}
