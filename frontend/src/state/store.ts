// create a new zustand store:
import type {} from "@redux-devtools/extension"; // required for devtools typing

import { combine, devtools, persist } from "zustand/middleware";

import {
  DEFAULT_TARGET_ROUTE_DURATION_SEC,
  isRoutePlaybackMode,
  isTargetRouteDuration,
  type RoutePlaybackMode,
  type TargetRouteDurationSec,
} from "@/domain/routeAnimation";
import type { PageType } from "@/types/state_types";
import type { UnitSystem } from "@/utils/units";
import type { ExtractState } from "zustand";
import { create } from "zustand";

// Instead of explicitly defining the store structure for typescript,
// we can use the ExtractState function to extract it for us.
// We use this with combine() below, which infers the state for us
export type State = ExtractState<typeof useStore>;

export type ListView = "cards" | "table";

type MapRouteState = {
  page: PageType;
  setPage: (page: PageType) => void;
  user: string | null;
  setUser: (user: string | null) => void;
  userIsAuthenticated: boolean | undefined;
  setUserIsAuthenticated: (isAuthenticated: boolean) => void;
  viewMode: "2d" | "3d";
  setViewMode: (viewMode: "2d" | "3d") => void;
  listView: ListView;
  setListView: (view: ListView) => void;
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
  animationDurationSec: TargetRouteDurationSec;
  setAnimationDurationSec: (
    animationDurationSec: TargetRouteDurationSec,
  ) => void;
  animationPlaybackMode: RoutePlaybackMode;
  setAnimationPlaybackMode: (animationPlaybackMode: RoutePlaybackMode) => void;
  skipDetectedStops: boolean;
  setSkipDetectedStops: (skipDetectedStops: boolean) => void;
  showTimedPhotos: boolean;
  setShowTimedPhotos: (showTimedPhotos: boolean) => void;
  /**
   * Live route-animation progress (0–1). Transient: updated ~20x/sec while
   * playback runs and never persisted. Always subscribe with a selector.
   */
  animationDistanceProgress: number;
  setAnimationDistanceProgress: (animationDistanceProgress: number) => void;
};

type PersistedAnimationState = {
  animationDurationSec?: unknown;
  animationPlaybackMode?: unknown;
  animationSpeed?: unknown;
  skipDetectedStops?: unknown;
  showTimedPhotos?: unknown;
};

export function migratePersistedAnimationState(persistedState: unknown) {
  const persisted =
    typeof persistedState === "object" && persistedState !== null
      ? (persistedState as PersistedAnimationState & Record<string, unknown>)
      : {};
  const persistedPreferences = { ...persisted };
  delete persistedPreferences.animationSpeed;
  return {
    ...persistedPreferences,
    animationDurationSec: isTargetRouteDuration(persisted.animationDurationSec)
      ? persisted.animationDurationSec
      : DEFAULT_TARGET_ROUTE_DURATION_SEC,
    animationPlaybackMode: isRoutePlaybackMode(persisted.animationPlaybackMode)
      ? persisted.animationPlaybackMode
      : "recorded",
    skipDetectedStops:
      typeof persisted.skipDetectedStops === "boolean"
        ? persisted.skipDetectedStops
        : true,
    showTimedPhotos:
      typeof persisted.showTimedPhotos === "boolean"
        ? persisted.showTimedPhotos
        : true,
  };
}

export const useStore = create<MapRouteState>()(
  devtools(
    persist(
      combine(
        {
          page: "route" as PageType,
          user: null as string | null,
          userIsAuthenticated: undefined, // user isAuthenticated is undefined until we check
          viewMode: "2d" as "2d" | "3d",
          listView: "cards" as ListView,
          units: "metric" as UnitSystem,
          animationDurationSec: DEFAULT_TARGET_ROUTE_DURATION_SEC,
          animationPlaybackMode: "recorded" as RoutePlaybackMode,
          skipDetectedStops: true,
          showTimedPhotos: true,
          animationDistanceProgress: 0,
        } as MapRouteState,
        (set) => ({
          setPage: (page: PageType) => set({ page }, undefined, "page/setPage"),
          setUser: (user: string | null) => {
            set({ user }, undefined, "user/setUser");
          },
          setUserIsAuthenticated: (isAuthenticated: boolean) => {
            set(
              { userIsAuthenticated: isAuthenticated },
              undefined,
              "user/setIsAuthenticated",
            );
          },
          setViewMode: (viewMode: "2d" | "3d") => {
            set({ viewMode }, undefined, "view/setViewMode");
          },
          setListView: (view: ListView) => {
            set({ listView: view }, undefined, "list/setListView");
          },
          setUnits: (units: UnitSystem) => {
            set({ units }, undefined, "units/setUnits");
          },
          setAnimationDurationSec: (
            animationDurationSec: TargetRouteDurationSec,
          ) => {
            set(
              { animationDurationSec },
              undefined,
              "animation/setAnimationDurationSec",
            );
          },
          setAnimationPlaybackMode: (
            animationPlaybackMode: RoutePlaybackMode,
          ) => {
            set(
              { animationPlaybackMode },
              undefined,
              "animation/setAnimationPlaybackMode",
            );
          },
          setSkipDetectedStops: (skipDetectedStops: boolean) => {
            set(
              { skipDetectedStops },
              undefined,
              "animation/setSkipDetectedStops",
            );
          },
          setShowTimedPhotos: (showTimedPhotos: boolean) => {
            set({ showTimedPhotos }, undefined, "animation/setShowTimedPhotos");
          },
          setAnimationDistanceProgress: (animationDistanceProgress: number) => {
            set(
              { animationDistanceProgress },
              undefined,
              "animation/setAnimationDistanceProgress",
            );
          },
        }),
      ),
      {
        name: "map-routes-store",
        version: 2,
        migrate: (persistedState) =>
          migratePersistedAnimationState(persistedState),
        partialize: (state) => ({
          listView: state.listView,
          units: state.units,
          animationDurationSec: state.animationDurationSec,
          animationPlaybackMode: state.animationPlaybackMode,
          skipDetectedStops: state.skipDetectedStops,
          showTimedPhotos: state.showTimedPhotos,
        }),
      },
    ),
  ),
);
