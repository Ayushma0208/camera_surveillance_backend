# Camera Surveillance Backend

Dockerized local setup for the camera surveillance assignment backend and worker.

## Services

- `postgres`: PostgreSQL database
- `backend`: Bun + Hono API on `http://localhost:4000`
- `worker`: Python + FastAPI worker on `http://localhost:8001`
- `mediamtx`: local RTSP server on `rtsp://localhost:8554`

## Run With Docker Compose

```sh
docker compose up --build
```

The backend runs Prisma migrations automatically before starting.

Health checks:

```sh
curl http://localhost:4000/health
curl http://localhost:8001/health
```

## API Smoke Test

Create a user and store the JWT:

```sh
TOKEN=$(curl -s -X POST http://localhost:4000/auth/signup \
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

The synthetic test pattern is useful for connection/status testing. To test person alerts, publish an RTSP stream that contains people, because the worker uses YOLOv8n and detects the `person` class.

## Useful Commands

```sh
docker compose ps
docker compose logs -f backend
docker compose logs -f worker
docker compose down
docker compose down -v
```
