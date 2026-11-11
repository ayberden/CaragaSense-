"""
CaragaSense Detection API
Flask server that provides road damage detection via YOLOv11.

Endpoints:
  POST /detect       - Receive base64 image, return detections + annotated image
  POST /upload       - Receive file upload, return detections + annotated image URL
  GET  /video_feed   - MJPEG stream from webcam (with live detection overlay)
  GET  /health       - Health check
"""

import base64
import os
import time
import functools
import gc
import re
import threading
import uuid
from pathlib import Path

import cv2
import numpy as np
import torch
from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS
from ultralytics import YOLO
from werkzeug.utils import secure_filename

# Limit PyTorch to single-thread CPU to stay strictly within Render's 512MB RAM limit
torch.set_num_threads(1)

# ── App setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
# Hardened: Enforce max upload size to prevent memory & disk-exhaustion DoS (32MB)
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024

# CORS: Allow all origins so Vercel domains, preview URLs, and localhost connect seamlessly
CORS(app, origins="*")

# ── Security: Optional API Key Protection ────────────────────────────────────
API_KEY = os.environ.get("CARAGASENSE_API_KEY")

def require_api_key(func):
    """Protects endpoints when CARAGASENSE_API_KEY is configured."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if not API_KEY:
            return func(*args, **kwargs)
        auth_header = request.headers.get("Authorization") or request.headers.get("X-API-Key")
        if not auth_header:
            return jsonify({"error": "Unauthorized: Missing API Key"}), 401
        token = auth_header.replace("Bearer ", "").strip()
        if token != API_KEY:
            return jsonify({"error": "Forbidden: Invalid API Key"}), 403
        return func(*args, **kwargs)
    return wrapper

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "Payload exceeds maximum allowed size (32MB)"}), 413

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ── Model ─────────────────────────────────────────────────────────────────────
# Resolution order:
#   1. Any .pt file inside api/models/  (drop your model here)
#   2. Legacy absolute path (kept for backward compatibility)
#   3. Generic YOLOv11n fallback
MODELS_DIR = BASE_DIR / "models"
LEGACY_MODEL_PATH = Path(r"C:\Users\IVERDEEN.DESKTOP-SN548D5\Desktop\yolo\my_model\my_model1")
FALLBACK_MODEL = "yolo11n.pt"

_model = None
_model_lock = threading.Lock()


def _resolve_model_path() -> Path | None:
    """Return the first .pt file found in api/models/, or the legacy path."""
    if MODELS_DIR.exists():
        pt_files = sorted(MODELS_DIR.glob("*.pt"))
        if pt_files:
            return pt_files[0]  # Use the first model found alphabetically
    if LEGACY_MODEL_PATH.exists():
        return LEGACY_MODEL_PATH
    return None


def load_model():
    """Load YOLO model — api/models/ first, legacy path second, fallback third."""
    global _model
    with _model_lock:
        if _model is not None:
            return _model
        resolved = _resolve_model_path()
        if resolved:
            print(f"[CaragaSense] Loading model: {resolved}")
            _model = YOLO(str(resolved))
        else:
            print(f"[CaragaSense] No custom model found. Loading fallback: {FALLBACK_MODEL}")
            _model = YOLO(FALLBACK_MODEL)
        try:
            _model.fuse()
        except Exception:
            pass
        print(f"[CaragaSense] Model loaded. Classes: {_model.names}")
        return _model


# ── Colour palette (Tableau-10, matching yolo_detect.py) ─────────────────────
CLASS_COLORS = [
    (164, 120,  87),
    ( 68, 148, 228),
    ( 93,  97, 209),
    (178, 182, 133),
    ( 88, 159, 106),
    ( 96, 202, 231),
    (159, 124, 168),
    (169, 162, 241),
    ( 98, 118, 150),
    (172, 176, 184),
]





CONF_THRESHOLD = 0.5   # matches yolo_detect.py default


def get_color(class_id: int):
    return CLASS_COLORS[class_id % len(CLASS_COLORS)]


# ── Detection helpers ─────────────────────────────────────────────────────────

def run_detection(frame_bgr: np.ndarray, conf_threshold: float = CONF_THRESHOLD):
    """
    Run YOLO inference on a BGR numpy frame.
    Returns (detections_list, annotated_bgr_frame).
    """
    # Downscale oversized frames to prevent memory spikes on 512MB RAM cloud hosts
    h, w = frame_bgr.shape[:2]
    max_dim = max(h, w)
    if max_dim > 1024:
        scale = 1024.0 / max_dim
        frame_bgr = cv2.resize(frame_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    model = load_model()

    # Memory-optimized inference mode (no autograd overhead)
    with torch.inference_mode():
        results = model(frame_bgr, conf=conf_threshold, imgsz=640, device='cpu', verbose=False)

    detections = []
    annotated = frame_bgr.copy()
    img_h, img_w = frame_bgr.shape[:2]
    img_area = max(img_h * img_w, 1)

    boxes = results[0].boxes
    for i in range(len(boxes)):
        # Coordinates — same tensor→numpy path as yolo_detect.py
        xyxy = boxes[i].xyxy.cpu().numpy().squeeze()
        xmin, ymin, xmax, ymax = xyxy.astype(int)

        cls_id   = int(boxes[i].cls.item())
        cls_name = model.names.get(cls_id, str(cls_id))
        conf     = boxes[i].conf.item()

        if conf < conf_threshold:
            continue

        box_w = int(max(0, xmax - xmin))
        box_h = int(max(0, ymax - ymin))
        bbox_ratio = round((box_w * box_h) / img_area, 4)

        detection = {
            'class':      cls_name.lower(),
            'confidence': round(conf, 4),
            'bbox':       [int(xmin), int(ymin), box_w, box_h],
            'bbox_ratio': bbox_ratio,
        }

        detections.append(detection)

        # Draw bounding box — always use trained YOLO model class name on image overlay
        color = get_color(cls_id)
        cv2.rectangle(annotated, (xmin, ymin), (xmax, ymax), color, 2)

        yolo_display_name = 'Crack' if cls_name.lower() in ('crack', 'cracks') else cls_name.replace('_', ' ').title()
        label = f'{yolo_display_name}: {int(conf * 100)}%'
        labelSize, baseLine = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        label_ymin = max(ymin, labelSize[1] + 10)
        cv2.rectangle(annotated,
                      (xmin, label_ymin - labelSize[1] - 10),
                      (xmin + labelSize[0], label_ymin + baseLine - 10),
                      color, cv2.FILLED)
        cv2.putText(annotated, label, (xmin, label_ymin - 7),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

    # Immediately release PyTorch output tensor memory
    del results
    gc.collect()

    return detections, annotated


def bgr_to_base64_jpeg(frame_bgr: np.ndarray, quality: int = 80) -> str:
    """Encode a BGR numpy array to a base64 JPEG data URL."""
    _, buf = cv2.imencode(".jpg", frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    b64 = base64.b64encode(buf).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def base64_to_bgr(data_url: str) -> np.ndarray:
    """Decode a base64 data URL (or raw base64) to a BGR numpy array."""
    try:
        if "," in data_url:
            _, encoded = data_url.split(",", 1)
        else:
            encoded = data_url
        raw = base64.b64decode(encoded)
        if not raw:
            return None
        arr = np.frombuffer(raw, dtype=np.uint8)
        if arr is None or len(arr) == 0:
            return None
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception:
        return None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    model = load_model()
    resolved = _resolve_model_path()
    return jsonify({"status": "ok", "model": str(resolved or FALLBACK_MODEL), "classes": model.names})


@app.route("/detect", methods=["POST"])
@require_api_key
def detect():
    """
    Accepts JSON: { "image": "<data:image/jpeg;base64,...>" }
    Returns JSON: { "detections": [...], "annotated_image": "<data:image/jpeg;base64,...>" }
    """
    data = request.get_json(force=True)
    if not data or "image" not in data:
        return jsonify({"error": "Missing 'image' field"}), 400

    frame = base64_to_bgr(data["image"])
    if frame is None:
        return jsonify({"error": "Could not decode image"}), 400

    detections, annotated = run_detection(frame)
    annotated_b64 = bgr_to_base64_jpeg(annotated)

    return jsonify({"detections": detections, "annotated_image": annotated_b64})


ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".webm", ".mkv"}
ALLOWED_EXTS = ALLOWED_IMAGE_EXTS | ALLOWED_VIDEO_EXTS


@app.route("/upload", methods=["POST"])
@require_api_key
def upload():
    """
    Accepts multipart/form-data with a 'file' field (image or video).
    Returns JSON: { "url": "<served URL>", "detections": [...], "type": "image"|"video" }
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    safe_original_name = secure_filename(file.filename)
    ext = Path(safe_original_name).suffix.lower()

    # Hardened: Validate file extension
    if ext not in ALLOWED_EXTS:
        return jsonify({"error": f"File type not allowed. Supported: {', '.join(sorted(ALLOWED_EXTS))}"}), 400

    filename = f"{uuid.uuid4().hex}{ext}"
    save_path = (UPLOAD_DIR / filename).resolve()

    file.save(str(save_path))

    # Determine type
    is_video = ext in ALLOWED_VIDEO_EXTS

    if is_video:
        # For video, serve as-is and stream via /video_feed?file=<filename>
        stream_url = f"http://{request.host}/video_feed?file={filename}"
        return jsonify({
            "url": stream_url,
            "type": "video",
            "detections": [],
        })
    else:
        # For image, run detection and return annotated image
        frame = cv2.imread(str(save_path))
        if frame is None:
            return jsonify({"error": "Could not read image"}), 400

        detections, annotated = run_detection(frame)

        # Save annotated image
        annotated_filename = f"annotated_{filename}"
        annotated_path = UPLOAD_DIR / annotated_filename
        cv2.imwrite(str(annotated_path), annotated)

        # Return as base64 data URL (simpler, no file serving needed)
        annotated_b64 = bgr_to_base64_jpeg(annotated)

        return jsonify({
            "url": annotated_b64,
            "type": "image",
            "detections": detections,
            "damage_type": detections[0]["class"] if detections else "other",
            "confidence": detections[0]["confidence"] if detections else 0.0,
        })


# ── Video Feed ────────────────────────────────────────────────────────────────

def _make_no_camera_frame() -> bytes:
    """Create a simple 'NO CAMERA' JPEG frame to stream when webcam is unavailable."""
    frame = np.zeros((360, 640, 3), dtype=np.uint8)
    frame[:] = (20, 20, 30)  # dark background

    text1 = "NO CAMERA DETECTED"
    text2 = "Use 'Manual Upload' to test YOLO detection"
    text3 = "or connect a webcam and restart."

    cv2.putText(frame, text1, (80, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 229, 255), 2, cv2.LINE_AA)
    cv2.putText(frame, text2, (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1, cv2.LINE_AA)
    cv2.putText(frame, text3, (120, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1, cv2.LINE_AA)
    cv2.putText(frame, "YOLO API: http://localhost:5000", (170, 300), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 150, 100), 1, cv2.LINE_AA)

    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    return buf.tobytes()


def _generate_webcam_feed():
    """Generator that yields MJPEG frames from the webcam with live detection."""
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        # No webcam available — stream a static "no camera" frame
        no_cam = _make_no_camera_frame()
        while True:
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + no_cam + b"\r\n")
            time.sleep(2.0)  # low-rate stream for no-camera case
        return

    last_detection_time = 0
    detection_interval = 1.0  # run detection every 1 second
    last_detections = []
    last_annotated = None

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                # Camera disconnected mid-stream — send no-camera frame and exit
                no_cam = _make_no_camera_frame()
                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n" + no_cam + b"\r\n")
                break

            now = time.time()
            if now - last_detection_time >= detection_interval:
                last_detections, last_annotated = run_detection(frame)
                last_detection_time = now

            display = last_annotated if last_annotated is not None else frame

            # Overlay detection count
            overlay_text = f"Detections: {len(last_detections)}"
            cv2.putText(display, overlay_text, (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 229, 255), 2, cv2.LINE_AA)

            _, buf = cv2.imencode(".jpg", display, [cv2.IMWRITE_JPEG_QUALITY, 70])
            frame_bytes = buf.tobytes()

            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")
    finally:
        cap.release()



def _generate_file_feed(filepath: str):
    """Generator that yields MJPEG frames from a video file with detection."""
    cap = cv2.VideoCapture(filepath)
    if not cap.isOpened():
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    frame_delay = 1.0 / fps

    while True:
        ret, frame = cap.read()
        if not ret:
            # Loop back
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        _, annotated = run_detection(frame)
        _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 70])
        frame_bytes = buf.tobytes()

        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")

        time.sleep(frame_delay)


@app.route("/video_feed")
def video_feed():
    """MJPEG stream. Optionally accepts ?file=<filename> for uploaded videos."""
    file_param = request.args.get("file")
    if file_param:
        safe_name = secure_filename(file_param)
        filepath = (UPLOAD_DIR / safe_name).resolve()
        # Hardened: Prevent path traversal outside UPLOAD_DIR
        if not filepath.is_relative_to(UPLOAD_DIR.resolve()) or not filepath.is_file():
            return jsonify({"error": "File not found"}), 404
        gen = _generate_file_feed(str(filepath))
    else:
        gen = _generate_webcam_feed()

    return Response(gen, mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    safe_name = secure_filename(filename)
    return send_from_directory(str(UPLOAD_DIR.resolve()), safe_name)


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    resolved = _resolve_model_path()
    print("=" * 60)
    print("  CaragaSense Detection API")
    print("  Starting on http://0.0.0.0:5000")
    print(f"  Models dir:  {MODELS_DIR}")
    print(f"  Model found: {resolved or 'None — will use fallback'}")
    print("=" * 60)
    # Pre-load model on startup
    load_model()
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
