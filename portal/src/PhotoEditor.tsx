import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as PhotoPointerEvent,
  type KeyboardEvent as PhotoKeyboardEvent,
} from "react";
import type { PhotoPolicy } from "./domain";
import {
  defaultCrop,
  preparePhoto,
  optimizePhoto,
  paintCrop,
  adjustCrop,
  rotateCrop,
  type Crop,
  type CropPoint,
  type PreparedPhoto,
  type ProcessedPhoto,
} from "./photo-processing";
import "./PhotoEditor.css";

export interface PhotoEditorProps {
  policy: PhotoPolicy;
  value?: string;
  disabled?: boolean;
  onProcessed: (photo: ProcessedPhoto) => Promise<void> | void;
  onRemove: () => Promise<void> | void;
}
export function PhotoEditor({
  policy,
  value,
  disabled = false,
  onProcessed,
  onRemove,
}: PhotoEditorProps) {
  const [image, setImage] = useState<PreparedPhoto | null>(null);
  const [crop, setCrop] = useState<Crop>({ ...defaultCrop });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const helpId = useId();
  const pointers = useRef(new Map<number, CropPoint>());
  const [dragging, setDragging] = useState(false);
  const current = useRef<PreparedPhoto | null>(null);
  const task = useRef(0);
  const importController = useRef<AbortController | null>(null);
  const admissionPaused =
    !policy.enabled ||
    policy.maxUploadsPerDay === 0 ||
    policy.maxStoredPhotos === 0;
  useEffect(
    () => () => {
      task.current++;
      importController.current?.abort();
      current.current?.close();
    },
    [],
  );
  useEffect(() => {
    if (image && canvas.current) {
      try {
        paintCrop(canvas.current, image, crop, 320);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Photo preview failed.");
      }
    }
  }, [image, crop]);
  useEffect(() => {
    if (disabled || busy) {
      pointers.current.clear();
      setDragging(false);
    }
  }, [disabled, busy]);
  useEffect(() => {
    const frame = canvas.current;
    if (!frame || !image || disabled || busy) return;
    const wheel = (event: WheelEvent) => {
      const bounds = frame.getBoundingClientRect();
      if (!bounds.width || pointers.current.size) return;
      event.preventDefault();
      const units =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1;
      const factor = Math.exp(
        -Math.max(-1, Math.min(1, event.deltaY * units * 0.002)),
      );
      const point = {
        x: (event.clientX - bounds.left) / bounds.width,
        y: (event.clientY - bounds.top) / bounds.height,
      };
      setCrop((previous) =>
        adjustCrop(
          image.width,
          image.height,
          previous,
          previous.zoom * factor,
          point,
        ),
      );
    };
    // React's delegated wheel listener may be passive. Only this crop frame
    // owns the non-passive listener; scrolling outside it remains ordinary.
    frame.addEventListener("wheel", wheel, { passive: false });
    return () => frame.removeEventListener("wheel", wheel);
  }, [image, disabled, busy]);
  const zoom = (factor: number) => {
    if (image && !disabled && !busy)
      setCrop((previous) =>
        adjustCrop(image.width, image.height, previous, previous.zoom * factor),
      );
  };
  const move = (x:number,y:number) => {
    if(image&&!disabled&&!busy)setCrop(previous=>adjustCrop(image.width,image.height,previous,previous.zoom,{x:.5,y:.5},{x:.5+x,y:.5+y}));
  };
  const rotate = (turns: number) => {
    pointers.current.clear();
    setDragging(false);
    setCrop((previous) => rotateCrop(previous, turns));
  };
  const reset = () => {
    pointers.current.clear();
    setDragging(false);
    setCrop({ ...defaultCrop });
  };
  const pointAt = (event: PhotoPointerEvent<HTMLCanvasElement>): CropPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
  };
  const pointerDown = (event: PhotoPointerEvent<HTMLCanvasElement>) => {
    if (
      !image ||
      disabled ||
      busy ||
      event.button !== 0 ||
      pointers.current.size >= 2
    )
      return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, pointAt(event));
    setDragging(true);
  };
  const pointerMove = (event: PhotoPointerEvent<HTMLCanvasElement>) => {
    if (!image || disabled || busy || !pointers.current.has(event.pointerId))
      return;
    event.preventDefault();
    const before = [...pointers.current.values()];
    pointers.current.set(event.pointerId, pointAt(event));
    const after = [...pointers.current.values()];
    const midpoint = (points: CropPoint[]) =>
      points.length === 1
        ? points[0]
        : {
            x: (points[0].x + points[1].x) / 2,
            y: (points[0].y + points[1].y) / 2,
          };
    const distance = (points: CropPoint[]) =>
      Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const ratio =
      before.length === 2 && distance(before) > 0.01
        ? distance(after) / distance(before)
        : 1;
    setCrop((previous) =>
      adjustCrop(
        image.width,
        image.height,
        previous,
        previous.zoom * ratio,
        midpoint(before),
        midpoint(after),
      ),
    );
  };
  const pointerEnd = (event: PhotoPointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId);
    setDragging(pointers.current.size > 0);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyDown = (event: PhotoKeyboardEvent<HTMLCanvasElement>) => {
    if (
      !image ||
      disabled ||
      busy ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    const movement: Record<string, CropPoint> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    if (movement[event.key]) {
      event.preventDefault();
      const step = event.shiftKey ? 0.1 : 0.025;
      const delta = movement[event.key];
      setCrop((previous) =>
        adjustCrop(
          image.width,
          image.height,
          previous,
          previous.zoom,
          { x: 0.5, y: 0.5 },
          { x: 0.5 + delta.x * step, y: 0.5 + delta.y * step },
        ),
      );
    } else if (["+", "=", "-", "_", "r", "R", "Home"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Home") reset();
      else if (event.key.toLowerCase() === "r") rotate(event.shiftKey ? -1 : 1);
      else zoom(event.key === "-" || event.key === "_" ? 1 / 1.1 : 1.1);
    }
  };
  const close = () => {
    current.current?.close();
    current.current = null;
    setImage(null);
    reset();
  };
  const choose = async (file?: File) => {
    if (!file || busy) return;
    if (admissionPaused) {
      setError(
        "New photo uploads are paused for this plan. Your saved photo is retained.",
      );
      return;
    }
    const sequence = ++task.current;
    importController.current?.abort();
    const controller = new AbortController();
    importController.current = controller;
    setBusy(true);
    setError("");
    try {
      const prepared = await preparePhoto(file, policy, controller.signal);
      if (sequence !== task.current) {
        prepared.close();
        return;
      }
      current.current?.close();
      current.current = prepared;
      setImage(prepared);
      setCrop({ ...defaultCrop });
    } catch (e) {
      if (sequence === task.current)
        setError(
          e instanceof Error ? e.message : "This photo could not be opened.",
        );
    } finally {
      if (sequence === task.current) setBusy(false);
    }
  };
  const save = async () => {
    if (!image || busy) return;
    if (admissionPaused) {
      setError(
        "New photo uploads are paused for this plan. Your crop is retained.",
      );
      return;
    }
    const sequence = task.current;
    setBusy(true);
    setError("");
    try {
      const processed = await optimizePhoto(image, crop, policy);
      if (sequence !== task.current) return;
      await onProcessed(processed);
      if (sequence === task.current) close();
    } catch (e) {
      if (sequence === task.current)
        setError(
          e instanceof Error
            ? e.message
            : "Photo could not be saved. Your crop is retained; try again.",
        );
    } finally {
      if (sequence === task.current) setBusy(false);
    }
  };
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onRemove();
      close();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Photo could not be removed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="photo-editor" aria-label="Profile photo editor" aria-busy={busy}>
      <h3>Profile photo</h3>
      <p>
        Choose a phone photo, then position, zoom and rotate it in the frame. We
        automatically prepare it for your page and contact download.

      </p>
      {!policy.enabled && (
        <p role="status">Photos are not enabled for this plan yet.</p>
      )}
      {policy.enabled && admissionPaused && (
        <p role="status">
          New photo uploads are paused for this plan. Your saved photo is
          retained and can still be removed.
        </p>
      )}
      {value && !image && (
        <img
          className="photo-current"
          src={value}
          alt="Current profile portrait"
        />
      )}
      <label className="photo-file uc-upload">
        {value ? "Replace photo" : "Upload photo"}
        <input
          className="uc-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          disabled={disabled || busy || admissionPaused}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void choose(file);
          }}
        />
      </label>
      
      {busy && !image && <p role="status">Opening your photo. HEIC photos may take a few moments.</p>}
      <p className="photo-help">
        JPEG, PNG, WebP and HEIC/HEIF.
      </p>
      {image && (
        <div className="photo-crop">
          <canvas
            ref={canvas}
            aria-label="Photo crop frame"
            aria-describedby={helpId}
            aria-disabled={disabled || busy}
            role="group"
            tabIndex={disabled || busy ? -1 : 0}
            data-dragging={dragging}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerEnd}
            onPointerCancel={pointerEnd}
            onLostPointerCapture={pointerEnd}
            onKeyDown={keyDown}
          >
            Photo crop preview
          </canvas>
          <p id={helpId} className="photo-help photo-gesture-help">
            Drag to move; scroll or pinch to zoom. Keyboard: arrows move, +/-
            zoom, R rotates (Shift+R left), Home resets.
          </p>
          <div
            className="photo-zoom-controls"
            role="group"
            aria-label="Photo zoom"
          >
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              disabled={disabled || busy || crop.zoom <= 1}
              onClick={() => zoom(1 / 1.1)}
            >
              -
            </button>
            <output aria-label="Zoom level">
              {Math.round(crop.zoom * 100)}%
            </output>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in"
              disabled={disabled || busy || crop.zoom >= 4}
              onClick={() => zoom(1.1)}
            >
              +
            </button>
          </div>
          <div className="photo-buttons photo-pan-controls" role="group" aria-label="Move photo">
            <button type="button" disabled={disabled||busy} onClick={()=>move(-.05,0)}>Move left</button>
            <button type="button" disabled={disabled||busy} onClick={()=>move(.05,0)}>Move right</button>
            <button type="button" disabled={disabled||busy} onClick={()=>move(0,-.05)}>Move up</button>
            <button type="button" disabled={disabled||busy} onClick={()=>move(0,.05)}>Move down</button>
          </div>
          
      <p className="photo-help">{crop.zoom<=1?"Zoom in to create more room to move the photo in every direction.":"Drag or use the Move buttons to position your photo."}</p>
          <div className="photo-buttons photo-transform-controls">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => rotate(-1)}
            >
              Rotate left
            </button>
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => rotate(1)}
            >
              Rotate right
            </button>
            <button type="button" disabled={disabled || busy} onClick={reset}>
              Reset crop
            </button>
          </div>
          <p className="photo-transform-status">
            Rotation:{" "}
            <output aria-label="Rotation">{crop.rotation ?? 0} degrees</output>
          </p>
          <div className="photo-buttons">
            <button
              type="button"
              disabled={disabled || busy || admissionPaused}
              onClick={() => void save()}
            >
              {busy ? "Preparing photo..." : "Save"}
            </button>
            <button type="button" disabled={busy} onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {(value || image) && (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => void remove()}
        >
          Remove photo
        </button>
      )}
      {error && (
        <p className="photo-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
