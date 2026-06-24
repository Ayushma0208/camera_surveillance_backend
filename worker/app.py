from __future__ import annotations

import os
import threading
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any, Optional

import cv2
import requests
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from ultralytics import YOLO


BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:4000").rstrip("/")
WORKER_API_KEY = os.getenv("WORKER_API_KEY", "")
MODEL_PATH = os.getenv("MODEL_PATH", "yolov8n.pt")
PERSON_CLASS_ID = 0
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.45"))
DETECTION_COOLDOWN_SECONDS = float(os.getenv("DETECTION_COOLDOWN_SECONDS", "5"))
STATS_INTERVAL_SECONDS = float(os.getenv("STATS_INTERVAL_SECONDS", "10"))
SAMPLE_EVERY_N_FRAMES = int(os.getenv("SAMPLE_EVERY_N_FRAMES", "5"))


app = FastAPI(title="Camera Surveillance Worker")
model = YOLO(MODEL_PATH)
running_cameras: dict[str, "CameraRuntime"] = {}
running_cameras_lock = threading.Lock()


class StartCameraRequest(BaseModel):
    cameraId: str
    name: str
    rtspUrl: str
    location: str
    enabled: bool


class StopCameraRequest(BaseModel):
    cameraId: str


class CameraRuntime:
    def __init__(self, thread: threading.Thread, stop_event: threading.Event):
        self.thread = thread
        self.stop_event = stop_event


def require_worker_key(x_worker_api_key: Optional[str]) -> None:
    if WORKER_API_KEY and x_worker_api_key != WORKER_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid worker API key")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def post_event(event: dict[str, Any]) -> None:
    headers = {"content-type": "application/json"}
    if WORKER_API_KEY:
        headers["x-worker-api-key"] = WORKER_API_KEY

    try:
        response = requests.post(
            f"{BACKEND_URL}/worker/events",
            json=event,
            headers=headers,
            timeout=5,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        print(f"Failed to post worker event: {error}")


def post_state(camera_id: str, status: str) -> None:
    post_event(
        {
            "type": "state",
            "cameraId": camera_id,
            "status": status,
        }
    )


def detect_person(frame: Any) -> Optional[float]:
    results = model(frame, verbose=False)
    best_confidence: Optional[float] = None

    for result in results:
        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])

            if class_id == PERSON_CLASS_ID and confidence >= CONFIDENCE_THRESHOLD:
                best_confidence = max(best_confidence or 0, confidence)

    return best_confidence


def process_camera(camera_id: str, rtsp_url: str, stop_event: threading.Event) -> None:
    cap = cv2.VideoCapture(rtsp_url)
    frame_count = 0
    processed_frames = 0
    detection_timestamps: deque[float] = deque()
    last_detection_sent_at = 0.0
    stats_started_at = time.time()

    if not cap.isOpened():
        post_state(camera_id, "error")
        cap.release()
        with running_cameras_lock:
            runtime = running_cameras.get(camera_id)
            if runtime and runtime.stop_event is stop_event:
                running_cameras.pop(camera_id, None)
        return

    post_state(camera_id, "live")

    try:
        while not stop_event.is_set():
            success, frame = cap.read()

            if not success:
                post_state(camera_id, "error")
                time.sleep(1)
                continue

            frame_count += 1

            if frame_count % SAMPLE_EVERY_N_FRAMES != 0:
                continue

            processed_frames += 1
            confidence = detect_person(frame)
            now = time.time()

            while detection_timestamps and now - detection_timestamps[0] > 60:
                detection_timestamps.popleft()

            if confidence is not None:
                detection_timestamps.append(now)

                if now - last_detection_sent_at >= DETECTION_COOLDOWN_SECONDS:
                    last_detection_sent_at = now
                    post_event(
                        {
                            "type": "person_detected",
                            "cameraId": camera_id,
                            "confidence": confidence,
                            "timestamp": utc_now(),
                            "imageUrl": None,
                        }
                    )

            stats_elapsed = now - stats_started_at
            if stats_elapsed >= STATS_INTERVAL_SECONDS:
                post_event(
                    {
                        "type": "stats",
                        "cameraId": camera_id,
                        "fps": round(processed_frames / stats_elapsed),
                        "detectionsPerMinute": len(detection_timestamps),
                    }
                )
                processed_frames = 0
                stats_started_at = now
    finally:
        cap.release()
        post_state(camera_id, "stopped")
        with running_cameras_lock:
            runtime = running_cameras.get(camera_id)
            if runtime and runtime.stop_event is stop_event:
                running_cameras.pop(camera_id, None)


@app.get("/health")
def health() -> dict[str, Any]:
    with running_cameras_lock:
        active_cameras = list(running_cameras.keys())

    return {"ok": True, "activeCameras": active_cameras}


@app.post("/cameras/start")
def start_camera(
    body: StartCameraRequest,
    x_worker_api_key: Optional[str] = Header(default=None),
) -> dict[str, Any]:
    require_worker_key(x_worker_api_key)

    if not body.enabled:
        raise HTTPException(status_code=400, detail="Camera is disabled")

    with running_cameras_lock:
        existing = running_cameras.get(body.cameraId)
        if existing and existing.thread.is_alive():
            return {"ok": True, "message": "Camera already running"}

        stop_event = threading.Event()
        thread = threading.Thread(
            target=process_camera,
            args=(body.cameraId, body.rtspUrl, stop_event),
            daemon=True,
        )
        running_cameras[body.cameraId] = CameraRuntime(thread, stop_event)
        thread.start()

    return {"ok": True}


@app.post("/cameras/stop")
def stop_camera(
    body: StopCameraRequest,
    x_worker_api_key: Optional[str] = Header(default=None),
) -> dict[str, Any]:
    require_worker_key(x_worker_api_key)

    with running_cameras_lock:
        runtime = running_cameras.get(body.cameraId)

    if runtime:
        runtime.stop_event.set()

    return {"ok": True}
