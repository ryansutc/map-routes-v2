/**
 * This is a singleton store object outside of React for storing and
 * sharing the users JWT w. axios.
 *
 */
let token: string | null = null;
export function setToken(newToken: string | null) {
  token = newToken;
}
export function getToken() {
  return token;
}
