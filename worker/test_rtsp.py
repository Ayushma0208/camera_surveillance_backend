import cv2
from ultralytics import YOLO

RTSP_URL = "rtsp://localhost:8554/camera1"

model = YOLO("yolov8n.pt")

cap = cv2.VideoCapture(RTSP_URL)

print("Connected to RTSP stream...")

while True:
    success, frame = cap.read()

    if not success:
        print("Failed to read frame")
        continue

    results = model(frame, verbose=False)

    person_count = 0

    for result in results:
        for box in result.boxes:
            cls = int(box.cls[0])

            if cls == 0:  # person class
                person_count += 1

    if person_count > 0:
        print(f"PERSON DETECTED: {person_count}")

    cv2.imshow("Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
