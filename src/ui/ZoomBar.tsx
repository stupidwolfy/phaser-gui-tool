import { atMaxZoom, atMinZoom, useViewZoom, zoomPercent } from '../editor/zoom';

/**
 * Zoom out, the current percentage (press it for 100%), zoom in, and Fit.
 *
 * Over the canvas rather than in the toolbar: a 390px toolbar already clips,
 * and these are about the surface they sit on. The accessible names are fixed
 * words and the live percentage is a separate status line, because the suite
 * matches names exactly and a name that changed with every pinch frame would
 * be one no locator — and no screen-reader user — could hold on to.
 */
export function ZoomBar({
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit: () => void;
}) {
  const zoom = useViewZoom();
  const percent = zoomPercent(zoom);

  return (
    <div className="zoombar" role="group" aria-label="Zoom">
      <button
        className="btn zoombar__btn"
        onClick={onZoomOut}
        disabled={atMinZoom(zoom)}
        title="Zoom out (−)"
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        className="btn zoombar__btn zoombar__percent"
        onClick={onReset}
        title="Reset zoom to 100% (0)"
        aria-label="Reset zoom to 100%"
        aria-describedby="zoombar-status"
        data-testid="zoom-percent"
      >
        {percent}%
      </button>
      <button
        className="btn zoombar__btn"
        onClick={onZoomIn}
        disabled={atMaxZoom(zoom)}
        title="Zoom in (+)"
        aria-label="Zoom in"
      >
        +
      </button>
      <button className="btn zoombar__btn" onClick={onFit} title="Fit scene to view (Shift+1)" aria-label="Fit scene to view">
        ⤢
      </button>
      <span id="zoombar-status" className="visually-hidden" role="status">
        Zoom {percent}%
      </span>
    </div>
  );
}
