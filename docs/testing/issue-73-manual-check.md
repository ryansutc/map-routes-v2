# Issue #73 Manual Browser Check

Automated tests cover GPS eligibility, visibility filtering, grouped-event
coordination, timer suspension, responsive placement, focus and Escape behavior,
and the 2D/3D ArcGIS adapter contract.

The following checks require a real ArcGIS view and route data and were not run
in the headless implementation workspace:

- Start playback in desktop 2D and 3D; verify the popup tracks the permanent
  photo icon while the view changes and remains clamped inside the map.
- Repeat in mobile fullscreen 2D and 3D; verify the popup uses the smaller size,
  flips at the top edge, and leaves the animation controls clickable.
- Put one grouped icon outside the viewport and verify no camera movement or
  visible pause occurs for it while the next visible icon still opens.
- Expand a popup image, navigate the full gallery, close the lightbox, and
  verify playback resumes; repeat Stop and replay from the existing controls.
- Hover the loaded popup and move keyboard focus between its actions; verify
  the two-second timer resumes with its remaining time and Escape closes it.
