import type {
  AnimationPhotoPresentation,
  PhotoSessionController,
  TimedPhotoPresenter,
} from "@/domain/timedPhotoPlayback";
import { resolvePhotoUrl } from "@/utils/dropboxImgHelpers";
import { useCallback, useMemo, useRef, useState } from "react";

type RoutePhoto = {
  id: number;
  url: string;
};

/**
 * Coordinates manual and timed photo lightbox sessions for the route detail page.
 *
 * @param photos - Ordered route photos available to the lightbox and animation.
 */
export function useRoutePhotoSessions(photos: readonly RoutePhoto[]) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(
    null,
  );
  const [animationPhoto, setAnimationPhoto] =
    useState<AnimationPhotoPresentation | null>(null);
  const controllerRef = useRef<PhotoSessionController | null>(null);
  const photoUrls = useMemo(
    () =>
      new Map(
        photos.map((photo) => [photo.id, resolvePhotoUrl(photo.url)]),
      ),
    [photos],
  );
  const presenter = useMemo<TimedPhotoPresenter>(
    () => ({
      open: setAnimationPhoto,
      close: (sessionId) =>
        setAnimationPhoto((current) =>
          current?.sessionId === sessionId ? null : current,
        ),
      preload: (photoIds) => {
        for (const photoId of photoIds) {
          const url = photoUrls.get(photoId);
          if (!url) continue;
          const image = new Image();
          image.src = url;
        }
      },
    }),
    [photoUrls],
  );

  const onControllerChange = useCallback(
    (controller: PhotoSessionController | null) => {
      controllerRef.current = controller;
    },
    [],
  );
  const onPhotoClick = useCallback(
    (index: number) => {
      const photo = photos[index];
      if (photo && controllerRef.current?.openManualPhoto(photo.id)) return;
      setSelectedPhotoIndex(index);
    },
    [photos],
  );
  const onIndexChange = useCallback(
    (index: number) => {
      if (!animationPhoto) {
        setSelectedPhotoIndex(index);
        return;
      }
      const photo = photos[index];
      if (!photo) return;
      if (animationPhoto.kind === "automatic") {
        animationPhoto.onNavigate(photo.id);
        return;
      }
      setAnimationPhoto((current) =>
        current?.kind === "manual" &&
        current.sessionId === animationPhoto.sessionId
          ? { ...current, photoId: photo.id }
          : current,
      );
    },
    [animationPhoto, photos],
  );

  return {
    presenter,
    onControllerChange,
    onPhotoClick,
    lightbox: {
      index: animationPhoto
        ? photos.findIndex((photo) => photo.id === animationPhoto.photoId)
        : selectedPhotoIndex,
      onIndexChange,
      onClose: animationPhoto
        ? animationPhoto.onDismiss
        : () => setSelectedPhotoIndex(null),
      onImageLoad:
        animationPhoto?.kind === "automatic"
          ? animationPhoto.onLoad
          : undefined,
      onImageError:
        animationPhoto?.kind === "automatic"
          ? animationPhoto.onError
          : undefined,
      onStopPlayback: animationPhoto?.onStop,
    },
  };
}
