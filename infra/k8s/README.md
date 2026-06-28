# Kubernetes Deployment

Build local images before applying these manifests to a local cluster such as Docker Desktop Kubernetes or kind:

```sh
docker build -t camera-surveillance-backend:latest ./backend
docker build -t camera-surveillance-worker:latest ./worker
kubectl apply -f infra/k8s/camera-surveillance.yaml
```

Check rollout status:

```sh
kubectl -n camera-surveillance get pods
kubectl -n camera-surveillance logs deploy/backend
kubectl -n camera-surveillance logs deploy/worker
```

The worker deployment starts with two replicas and each worker is capped by `MAX_CAMERAS_PER_WORKER`. The backend is kept at one replica because WebSocket clients are tracked in process memory. To scale backend replicas safely, add shared WebSocket fan-out through Redis Pub/Sub, RabbitMQ fanout exchanges, or a dedicated realtime gateway.
