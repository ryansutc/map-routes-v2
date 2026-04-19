import useWidth from "./useWidth";

export default function useBootstrapWidth() {
  const width = useWidth();
  if (width > 1400) {
    return 1320;
  } else if (width > 1200) {
    return 1140;
  } else if (width > 992) {
    return 960;
  } else if (width > 768) {
    return 720;
  } else if (width > 576) {
    return 540;
  } else {
    return 480;
  }
}
