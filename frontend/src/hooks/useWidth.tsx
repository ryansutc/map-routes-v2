import React from "react";

/**
 * Get the width of the browser window in pixels
 * @returns {number} The width of the window in pixels
 */
export default function useWidth() {
  // get the width of the window as it changes
  const [width, setWidth] = React.useState(window.innerWidth);

  React.useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return width;
}
