# Real-Time Camera Surveillance Dashboard Backend

This repository contains the backend, worker, and infrastructure pieces for a small video management system. Users can register RTSP cameras, start or stop camera processing, receive realtime person-detection alerts, and query stored alerts.

The current repository focuses on the Bun + Hono API, Python worker, database, queue, Docker Compose setup, and Kubernetes manifests.

## Services

- `backend`: Bun + Hono API on `http://localhost:4000`
- `worker`: Python + FastAPI worker on `http://localhost:8001`
- `postgres`: PostgreSQL database used by Prisma
- `rabbitmq`: message broker for camera commands and worker events, with management UI on `http://localhost:15672`
- `mediamtx`: local RTSP server on `rtsp://localhost:8554`

## Architecture

The system uses the API as the control plane and the worker as the camera-processing plane.

```text
Client
  |
  | HTTP + JWT / WebSocket
  v
Backend API
  |                  ^
  | camera.commands | detection.events
  v                  |
RabbitMQ <----------+
  |
  v
Worker replicas
  |
  | RTSP ingest + YOLOv8n person detection
  v
RTSP cameras / MediaMTX

Backend API -> Postgres
Backend API -> WebSocket realtime updates
```

Flow:

- A user signs up or logs in and receives a JWT.
- Authenticated camera CRUD and alert routes are scoped to the logged-in user.
- Starting or stopping a camera publishes a durable command to RabbitMQ queue `camera.commands`.
- Worker replicas consume `camera.commands`; each worker can process several cameras independently.
- For each active camera, the worker reads the RTSP stream with OpenCV, samples frames, runs person detection, and emits events to RabbitMQ queue `detection.events`.
- The backend consumes `detection.events`, validates the event format, applies alert deduplication and rate limiting, stores accepted alerts in Postgres, updates camera state/stats, and broadcasts realtime messages over WebSocket.
- HTTP worker endpoints still exist as a fallback/manual test path, but RabbitMQ is the default path when `RABBITMQ_URL` is configured.

## Design Decisions

- RabbitMQ is used for camera commands and detection events so backend and worker lifecycles are decoupled. This allows worker replicas to be scaled independently and prevents API requests from depending on a live worker HTTP call.
- Commands and events are explicit JSON contracts shared across API, queue, database persistence, and WebSocket payloads. Backend validation uses Zod before storing or broadcasting worker events.
- The backend stores durable business state in Postgres: users, cameras, alerts, and latest camera stats.
- WebSocket fan-out is currently in memory. For this reason, the Kubernetes manifest keeps the backend at one replica. Scaling backend replicas would require shared fan-out through Redis Pub/Sub, RabbitMQ fanout exchanges, or a dedicated realtime gateway.
- Worker camera processing is isolated per camera using threads. One failed/stopped camera should not stop other cameras in the same worker process.
- `MAX_CAMERAS_PER_WORKER` caps worker load. More cameras can be handled by increasing worker replicas.
- Alert deduplication and rate limiting happen in the backend before storage. This keeps the database and frontend from being flooded when a person stays in frame.

## Detection Model

The worker uses `YOLOv8n` from the `ultralytics` package.

Why this model:

- It is open source and easy to run locally.
- It includes the COCO `person` class out of the box, so no custom training is required for the assignment.
- The `n` nano variant is small enough for local development and Docker-based testing.
- It provides a practical speed/accuracy tradeoff for a prototype surveillance dashboard.

The worker currently detects COCO class ID `0`, which is `person`, and only emits detections above `CONFIDENCE_THRESHOLD`.

## Exact Event Format

All worker events are sent through RabbitMQ queue `detection.events` when RabbitMQ is configured. The same payloads are also accepted by `POST /worker/events` for fallback/manual testing.

### Person Detection Event

Stored in Postgres as an alert and broadcast to the frontend as a WebSocket `alert` message after deduplication/rate limiting.

```json
{
  "type": "person_detected",
  "cameraId": "550e8400-e29b-41d4-a716-446655440000",
  "confidence": 0.94,
  "timestamp": "2026-06-23T10:00:00Z",
  "imageUrl": null
}
```

Fields:

- `type`: must be `person_detected`
- `cameraId`: UUID of the camera
- `confidence`: number between `0` and `1`
- `timestamp`: ISO datetime string
- `imageUrl`: optional URL or `null`

### Stats Event

Upserts the latest camera stats and broadcasts the same payload to WebSocket clients.

```json
{
  "type": "stats",
  "cameraId": "550e8400-e29b-41d4-a716-446655440000",
  "fps": 24,
  "detectionsPerMinute": 5
}
```

Fields:

- `type`: must be `stats`
- `cameraId`: UUID of the camera
- `fps`: non-negative integer
- `detectionsPerMinute`: non-negative integer

### State Event

Updates camera status and broadcasts the same payload to WebSocket clients.

```json
{
  "type": "state",
  "cameraId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "live"
}
```

Allowed `status` values:

- `connecting`
- `live`
- `stopped`
- `error`

### WebSocket Messages

Connect with:

```text
ws://localhost:4000/ws?token=<jwt>
```

On connection:

```json
{
  "type": "connected"
}
```

Alert broadcast:

```json
{
  "type": "alert",
  "cameraId": "550e8400-e29b-41d4-a716-446655440000",
  "confidence": 0.94,
  "timestamp": "2026-06-23T10:00:00.000Z",
  "imageUrl": null
}
```

Stats and state WebSocket messages use the same shape as the worker `stats` and `state` events.

## Camera Command Format

Camera commands are published by the backend to RabbitMQ queue `camera.commands`.

Start command:

```json
{
  "type": "start_camera",
  "commandId": "2c4b3af0-2809-4c1e-8984-7569a4d38e5b",
  "camera": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Front Gate",
    "rtspUrl": "rtsp://mediamtx:8554/cam",
    "location": "Entrance",
    "enabled": true
  }
}
```

Stop command:

```json
{
  "type": "stop_camera",
  "commandId": "2c4b3af0-2809-4c1e-8984-7569a4d38e5b",
  "cameraId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Environment Variables

Backend:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret, minimum 16 characters
- `JWT_EXPIRES_IN`: JWT lifetime, for example `7d`
- `WORKER_BASE_URL`: worker HTTP fallback URL
- `WORKER_API_KEY`: shared key for worker/backend HTTP fallback requests
- `CORS_ORIGIN`: `*` or comma-separated allowed origins
- `RABBITMQ_URL`: RabbitMQ connection string
- `CAMERA_COMMANDS_QUEUE`: defaults to `camera.commands`
- `DETECTION_EVENTS_QUEUE`: defaults to `detection.events`
- `ALERT_DEDUP_WINDOW_SECONDS`: suppress duplicate person alerts inside this window
- `ALERT_RATE_LIMIT_PER_CAMERA_PER_MINUTE`: max stored person alerts per camera per minute

Worker:

- `BACKEND_URL`: backend HTTP fallback URL
- `WORKER_API_KEY`: shared key for HTTP fallback
- `RABBITMQ_URL`: RabbitMQ connection string
- `CAMERA_COMMANDS_QUEUE`: queue consumed by workers
- `DETECTION_EVENTS_QUEUE`: queue used for emitted events
- `MAX_CAMERAS_PER_WORKER`: max active cameras per worker process
- `MODEL_PATH`: YOLO model path, defaults to `yolov8n.pt`
- `CONFIDENCE_THRESHOLD`: minimum person detection confidence
- `DETECTION_COOLDOWN_SECONDS`: worker-side cooldown between person events
- `STATS_INTERVAL_SECONDS`: stats event interval
- `SAMPLE_EVERY_N_FRAMES`: frame sampling rate for detection

## How To Run

Prerequisites:

- Docker Desktop
- `curl`
- `jq` for the smoke-test commands
- `ffmpeg` if you want to publish a local RTSP test stream

Start everything:

```sh
docker compose up --build
```

The first worker build can take several minutes because it installs OpenCV, Ultralytics, and PyTorch dependencies.

To start only the faster control-plane services:

```sh
docker compose up --build postgres rabbitmq backend mediamtx
```

The backend runs Prisma migrations automatically before starting.

Health checks:

```sh
curl http://localhost:4000/health
curl http://localhost:8001/health
```

RabbitMQ UI:

```text
http://localhost:15672
```

Default local credentials:

```text
guest / guest
```

## API Smoke Test

Create a user and store the JWT:

```sh
TOKEN=$(curl -s -X POST http://localhost:4000/auth/signup \
  -H "content-type: application/json" \
  -d '{"username":"admin","password":"password123"}' \
  | jq -r '.data.token')
```

If the user already exists, login instead:

```sh
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "content-type: application/json" \
  -d '{"username":"admin","password":"password123"}' \
  | jq -r '.data.token')
```

Create a camera. Use `rtsp://mediamtx:8554/cam` because the worker connects from inside Docker:

```sh
CAMERA_ID=$(curl -s -X POST http://localhost:4000/cameras \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"name":"Test Camera","rtspUrl":"rtsp://mediamtx:8554/cam","location":"Local","enabled":true}' \
  | jq -r '.data.camera.id')
```

Start processing:

```sh
curl -X POST "http://localhost:4000/cameras/$CAMERA_ID/start" \
  -H "authorization: Bearer $TOKEN"
```

List cameras and alerts:

```sh
curl http://localhost:4000/cameras \
  -H "authorization: Bearer $TOKEN"

curl http://localhost:4000/alerts \
  -H "authorization: Bearer $TOKEN"
```

Stop processing:

```sh
curl -X POST "http://localhost:4000/cameras/$CAMERA_ID/stop" \
  -H "authorization: Bearer $TOKEN"
```

## Local RTSP Test Stream

With Compose running, publish a test stream to MediaMTX from your host:

```sh
ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -f rtsp rtsp://localhost:8554/cam
```

The synthetic test pattern is useful for connection/status testing. To test real person alerts, publish an RTSP stream that contains people.

## Scaling

Scale worker replicas locally:

```sh
docker compose up --build --scale worker=2
```

Each worker enforces `MAX_CAMERAS_PER_WORKER`. Additional worker replicas allow more cameras to be processed concurrently.

Useful Docker commands:

```sh
docker compose ps
docker compose logs -f backend
docker compose logs -f worker
docker compose logs -f rabbitmq
docker compose down
docker compose down -v
```

## Tests

Run backend typecheck and tests:

```sh
cd backend
bun run typecheck
bun test
```

Run worker syntax check from the repository root:

```sh
PYTHONPYCACHEPREFIX=.pycache python3 -m py_compile worker/app.py
rm -rf .pycache
```

Run opt-in integration tests against a configured test database:

```sh
cd backend
RUN_INTEGRATION_TESTS=true bun test
```

## Kubernetes

Build local images and apply the manifests:

```sh
docker build -t camera-surveillance-backend:latest ./backend
docker build -t camera-surveillance-worker:latest ./worker
kubectl apply -f infra/k8s/camera-surveillance.yaml
```

More details are in `infra/k8s/README.md`.

## Future Improvements

- Add the React frontend dashboard with protected routes, camera tiles, live WebRTC playback, realtime alerts, and stats.
- Add real WebRTC restreaming from worker to browser. The current worker processes RTSP frames for detection; MediaMTX is included for local RTSP testing.
- Move WebSocket fan-out to a shared pub/sub layer so the backend can safely run multiple replicas.
- Add worker ownership and heartbeat tracking so cameras can be reassigned automatically when a worker dies.
- Add dead-letter queues and retry policies for malformed or repeatedly failing queue messages.
- Persist worker instances and camera assignment history for better observability.
- Add Redis-based dedup/rate-limit counters for lower latency at high alert volume.
- Add end-to-end integration tests with RabbitMQ and Postgres test containers.
- Add model acceleration options such as ONNX Runtime, TensorRT, or hardware-specific builds.
- Replace development secrets with managed secrets for production deployments.
