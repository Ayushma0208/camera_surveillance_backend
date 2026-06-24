# Camera Surveillance Backend

Bun + Hono API for the real-time camera surveillance dashboard.

## Features

- JWT authentication with bcrypt password hashing
- User-scoped camera CRUD
- Camera start/stop commands sent to the worker service
- Worker event ingestion for person alerts, camera stats, and camera state
- PostgreSQL persistence through Prisma
- Authenticated WebSocket updates at `/ws`

## Setup

```sh
cp .env.example .env
bun install
bunx prisma generate
bunx prisma migrate dev
bun run dev
```

The backend listens on `PORT`, defaulting to `4000`.

## Environment

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: secret used to sign auth tokens
- `JWT_EXPIRES_IN`: token lifetime, for example `7d`
- `WORKER_BASE_URL`: worker service base URL
- `WORKER_API_KEY`: optional shared key for backend-to-worker and worker-to-backend requests
- `CORS_ORIGIN`: `*` or comma-separated allowed origins

## Authentication

`POST /auth/signup`

```json
{
  "username": "admin",
  "password": "password123"
}
```

`POST /auth/login`

```json
{
  "username": "admin",
  "password": "password123"
}
```

Authenticated routes require:

```text
Authorization: Bearer <token>
```

`GET /auth/me` returns the current user.

## Cameras

`POST /cameras`

```json
{
  "name": "Front Gate",
  "rtspUrl": "rtsp://example.local/front",
  "location": "Entrance",
  "enabled": true
}
```

Available camera routes:

- `GET /cameras`
- `GET /cameras/:id`
- `PUT /cameras/:id`
- `DELETE /cameras/:id`
- `POST /cameras/:id/start`
- `POST /cameras/:id/stop`

Start sends this worker command to `WORKER_BASE_URL/cameras/start`:

```json
{
  "cameraId": "camera-id",
  "name": "Front Gate",
  "rtspUrl": "rtsp://example.local/front",
  "location": "Entrance",
  "enabled": true
}
```

Stop sends this worker command to `WORKER_BASE_URL/cameras/stop`:

```json
{
  "cameraId": "camera-id"
}
```

## Alerts

`GET /alerts` supports:

- `cameraId`
- `from`
- `to`
- `page`
- `limit`

Example:

```text
GET /alerts?cameraId=<uuid>&from=2026-06-23T10:00:00Z&page=1&limit=20
```

## Worker Events

`POST /worker/events` accepts `x-worker-api-key` when `WORKER_API_KEY` is set.

Person detection event:

```json
{
  "type": "person_detected",
  "cameraId": "550e8400-e29b-41d4-a716-446655440000",
  "confidence": 0.94,
  "timestamp": "2026-06-23T10:00:00Z"
}
```

Stats event:

```json
{
  "type": "stats",
  "cameraId": "550e8400-e29b-41d4-a716-446655440000",
  "fps": 24,
  "detectionsPerMinute": 5
}
```

State event:

```json
{
  "type": "state",
  "cameraId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "live"
}
```

## WebSocket

Connect with:

```text
ws://localhost:4000/ws?token=<jwt>
```

Broadcast messages:

```json
{
  "type": "alert",
  "cameraId": "camera-id",
  "confidence": 0.91,
  "timestamp": "2026-06-23T10:00:00.000Z"
}
```

```json
{
  "type": "stats",
  "cameraId": "camera-id",
  "fps": 24,
  "detectionsPerMinute": 5
}
```

```json
{
  "type": "state",
  "cameraId": "camera-id",
  "status": "live"
}
```

## Verification

```sh
bun test
bun run typecheck
```
