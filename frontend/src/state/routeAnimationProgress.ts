type ProgressListener = () => void;

let distanceProgress = 0;
const listeners = new Set<ProgressListener>();

const publish = (nextDistanceProgress: number) => {
  if (nextDistanceProgress === distanceProgress) return;
  distanceProgress = nextDistanceProgress;
  listeners.forEach((listener) => listener());
};

/**
 * High-frequency route-animation distance, isolated from persisted/devtools
 * application state. Only lightweight animation surfaces should subscribe.
 */
export const routeAnimationProgress = {
  getSnapshot: () => distanceProgress,
  subscribe: (listener: ProgressListener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  publish,
  reset: () => publish(0),
};
