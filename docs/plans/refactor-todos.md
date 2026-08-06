### Zustand Store

- the store is typed via combine(), and the initial-state object is cast as MapRouteState. That cast means TypeScript will not complain if you add a field to the MapRouteState type but forget to add it to the initial state — you'd get undefined at runtime with a number type. I added animationProgress: 0 to both, but that cast is a live footgun for the next field.

- update Recharts library. See if we can change version so:
  isFront and isAnimationActive aren't valid props on ReferenceLine/ReferenceDot. Removed — the reference elements are declared after <Line> so they still draw on top, and Recharts doesn't tween reference elements by default.
