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
import io
import json
import os
import re
import time
import threading
import uuid
from pathlib import Path

import cv2
import numpy as np
import requests as http_requests
from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS
from ultralytics import YOLO

# ── App setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, origins="*")  # Allow Next.js on port 3001

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ── Model ─────────────────────────────────────────────────────────────────────
# Primary: user's custom road-damage model
MODEL_PATH = Path(r"C:\Users\IVERDEEN.DESKTOP-SN548D5\Desktop\yolo\my_model\my_model.pt")
FALLBACK_MODEL = "yolo11n.pt"   # Generic fallback if custom model not found

_model = None
_model_lock = threading.Lock()


def load_model():
    """Load YOLO model — custom model if available, else generic fallback."""
    global _model
    with _model_lock:
        if _model is not None:
            return _model
        if MODEL_PATH.exists():
            print(f"[CaragaSense] Loading custom model: {MODEL_PATH}")
            _model = YOLO(str(MODEL_PATH))
        else:
            print(f"[CaragaSense] No custom model found at {MODEL_PATH}.")
            print(f"[CaragaSense] Loading fallback model: {FALLBACK_MODEL}")
            _model = YOLO(FALLBACK_MODEL)
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

# ── OpenRouter AI crack classifier ─────────────────────────────────────────────
OPENROUTER_API_KEY    = os.getenv('OPENROUTER_API_KEY', '')
# Primary vision model; fallback if primary is rate-limited
OPENROUTER_MODELS = [
    'meta-llama/llama-3.2-11b-vision-instruct:free',  # primary
    'google/gemma-4-31b-it:free',                      # fallback
]

# Classes from your model that represent cracks and should trigger AI subtype analysis
CRACK_CLASSES = {'crack', 'cracks', 'd00', 'd10', 'd20',
                 'longitudinal_crack', 'transverse_crack', 'alligator_crack'}


def classify_crack_type_ai(crop_bgr: np.ndarray) -> dict:
    """
    Send a cropped crack image to OpenRouter (Gemma 4 Vision) to identify
    the specific crack subtype.
    Returns a dict with crack_type, crack_label, crack_description.
    Falls back gracefully if the API is unavailable.
    """
    _default = {
        'crack_type': 'unknown',
        'crack_label': 'Crack',
        'crack_description': 'Crack detected on the road surface.',
    }

    if crop_bgr is None or crop_bgr.size == 0:
        return _default

    # Encode crop as a base64 JPEG data URL
    _, buf = cv2.imencode('.jpg', crop_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
    b64     = base64.b64encode(buf).decode('utf-8')
    data_url = f'data:image/jpeg;base64,{b64}'

    prompt = (
        'You are a road surface damage analyst. Look at this cropped road image '
        'and classify the crack type.\n\n'
        'Choose EXACTLY ONE from:\n'
        '- longitudinal : crack runs parallel to the road direction\n'
        '- transverse   : crack runs perpendicular / across the road\n'
        '- alligator    : interconnected network of cracks (fatigue cracking)\n'
        '- block        : large rectangular block-pattern cracks\n'
        '- edge         : crack along the road edge or shoulder\n\n'
        'Respond with ONLY valid JSON — no markdown, no extra text:\n'
        '{"crack_type": "alligator", "crack_label": "Alligator Crack", '
        '"crack_description": "One-sentence description of the crack."}'
    )

    try:
        for model in OPENROUTER_MODELS:
            resp = http_requests.post(
                url='https://openrouter.ai/api/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {OPENROUTER_API_KEY}',
                    'Content-Type': 'application/json',
                },
                json={
                    'model': model,
                    'messages': [
                        {
                            'role': 'user',
                            'content': [
                                {'type': 'image_url', 'image_url': {'url': data_url}},
                                {'type': 'text', 'text': prompt},
                            ],
                        }
                    ],
                    'max_tokens': 150,
                },
                timeout=20,
            )

            if resp.status_code == 429:
                print(f'[CaragaSense] {model} rate-limited (429), trying next model...')
                continue

            if not resp.ok:
                print(f'[CaragaSense] {model} error {resp.status_code}: {resp.text[:200]}')
                continue

            data    = resp.json()
            content = data['choices'][0]['message']['content'].strip()
            print(f'[CaragaSense] Crack AI ({model}) response: {content}')

            # Extract the first JSON object from the response
            match = re.search(r'\{[^{}]+\}', content, re.DOTALL)
            if match:
                result = json.loads(match.group())
                if 'crack_type' in result and 'crack_label' in result:
                    return result
            break  # got a valid response, stop trying models

    except Exception as exc:
        print(f'[CaragaSense] AI crack classification failed: {exc}')

    return _default

CONF_THRESHOLD = 0.5   # matches yolo_detect.py default


def get_color(class_id: int):
    return CLASS_COLORS[class_id % len(CLASS_COLORS)]


# ── Detection helpers ─────────────────────────────────────────────────────────

def run_detection(frame_bgr: np.ndarray, conf_threshold: float = CONF_THRESHOLD,
                  classify_cracks: bool = False):
    """
    Run YOLO inference on a BGR numpy frame.
    Uses the same drawing style as yolo_detect.py.

    Args:
      classify_cracks: If True, detected cracks are sent to the OpenRouter AI
                       API for subtype classification. Keep False for live video
                       feeds to avoid latency. Set True for image uploads.

    Returns (detections_list, annotated_bgr_frame).
    """
    model = load_model()
    results = model(frame_bgr, conf=conf_threshold, verbose=False)

    detections = []
    annotated = frame_bgr.copy()

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

        detection = {
            'class':      cls_name.lower(),
            'confidence': round(conf, 4),
            'bbox':       [int(xmin), int(ymin), int(xmax - xmin), int(ymax - ymin)],
        }

        # ── AI crack subtype classification (only on uploads, not live video) ──
        if classify_cracks and cls_name.lower() in CRACK_CLASSES:
            cx1  = max(0, xmin)
            cy1  = max(0, ymin)
            cx2  = min(frame_bgr.shape[1], xmax)
            cy2  = min(frame_bgr.shape[0], ymax)
            crop = frame_bgr[cy1:cy2, cx1:cx2]
            crack_info = classify_crack_type_ai(crop)
            detection.update(crack_info)
            print(f'[CaragaSense] Crack classified as: {crack_info["crack_label"]}')

        detections.append(detection)

        # Draw bounding box — show crack subtype label when available
        color = get_color(cls_id)
        cv2.rectangle(annotated, (xmin, ymin), (xmax, ymax), color, 2)

        display_name = detection.get('crack_label', cls_name)
        label = f'{display_name}: {int(conf * 100)}%'
        labelSize, baseLine = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        label_ymin = max(ymin, labelSize[1] + 10)
        cv2.rectangle(annotated,
                      (xmin, label_ymin - labelSize[1] - 10),
                      (xmin + labelSize[0], label_ymin + baseLine - 10),
                      color, cv2.FILLED)
        cv2.putText(annotated, label, (xmin, label_ymin - 7),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

    return detections, annotated


def bgr_to_base64_jpeg(frame_bgr: np.ndarray, quality: int = 80) -> str:
    """Encode a BGR numpy array to a base64 JPEG data URL."""
    _, buf = cv2.imencode(".jpg", frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    b64 = base64.b64encode(buf).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def base64_to_bgr(data_url: str) -> np.ndarray:
    """Decode a base64 data URL (or raw base64) to a BGR numpy array."""
    if "," in data_url:
        _, encoded = data_url.split(",", 1)
    else:
        encoded = data_url
    raw = base64.b64decode(encoded)
    arr = np.frombuffer(raw, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    model = load_model()
    return jsonify({"status": "ok", "model": str(MODEL_PATH if MODEL_PATH.exists() else FALLBACK_MODEL), "classes": model.names})


@app.route("/detect", methods=["POST"])
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

    detections, annotated = run_detection(frame, classify_cracks=True)
    annotated_b64 = bgr_to_base64_jpeg(annotated)

    return jsonify({"detections": detections, "annotated_image": annotated_b64})


@app.route("/upload", methods=["POST"])
def upload():
    """
    Accepts multipart/form-data with a 'file' field (image or video).
    Returns JSON: { "url": "<served URL>", "detections": [...], "type": "image"|"video" }
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    save_path = UPLOAD_DIR / filename

    file.save(str(save_path))

    # Determine type
    video_exts = {".mp4", ".mov", ".avi", ".webm", ".mkv"}
    is_video = ext in video_exts

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

        detections, annotated = run_detection(frame, classify_cracks=True)

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
        filepath = str(UPLOAD_DIR / file_param)
        if not os.path.exists(filepath):
            return jsonify({"error": "File not found"}), 404
        gen = _generate_file_feed(filepath)
    else:
        gen = _generate_webcam_feed()

    return Response(gen, mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(str(UPLOAD_DIR), filename)


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("  CaragaSense Detection API")
    print("  Starting on http://0.0.0.0:5000")
    print(f"  Model: {MODEL_PATH}")
    print(f"  Model exists: {MODEL_PATH.exists()}")
    print("=" * 60)
    # Pre-load model on startup
    load_model()
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
