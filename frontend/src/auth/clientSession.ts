import axios from "axios";

import { useStore } from "@/state/store";

export function isUnauthorizedError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

/**
 * Remove the user's authentication from app:
 * - clear the local storage token, email info
 * - set zustand state of isAuthenticated to false
 * @remarks used by the MainWrapper.tsx component
 */
export function clearClientAuthentication(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("email");

  const { setUser, setUserIsAuthenticated } = useStore.getState();
  setUser(null);
  setUserIsAuthenticated(false);
}
