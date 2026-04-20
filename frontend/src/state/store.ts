// create a new zustand store:
import type {} from "@redux-devtools/extension"; // required for devtools typing

import { combine, devtools, persist } from "zustand/middleware";

import type { PageType } from "@/types/state_types";
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
};

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
              "user/setIsAuthenticated"
            );
          },
          setViewMode: (viewMode: "2d" | "3d") => {
            set({ viewMode }, undefined, "view/setViewMode");
          },
          setListView: (view: ListView) => {
            set({ listView: view }, undefined, "list/setListView");
          },
        })
      ),
      {
        name: "map-routes-store",
        // Only persist UI preferences; auth state and transient view mode
        // are recomputed on load from the API / Zustand defaults.
        partialize: (state) => ({ listView: state.listView }),
      }
    )
  )
);
