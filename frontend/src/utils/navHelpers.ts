import { BACKEND_DOMAIN, IS_DEVELOPMENT } from "./environment";

export const getEnvHref = (href: string) => {
  // In a dev build we need the absolute url so that the backend handles the new url

  const cleanHref = href.startsWith("/") ? href.slice(1) : href;
  const envHref =
    // we are in an iframe if window.self isn't the same as window.top:
    IS_DEVELOPMENT && window.self !== window.top
      ? `${BACKEND_DOMAIN}${cleanHref}`
      : `/${cleanHref}`;

  return envHref;
};
