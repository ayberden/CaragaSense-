---
title: CaragaSense Detection API
emoji: 🛣️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# CaragaSense Detection API

AI Road Damage Detection API for CaragaSense, powered by YOLOv11 and Flask.

### Endpoints
- `GET /health` - Health check & loaded class list
- `POST /upload` - Multipart image upload for detection & severity scoring
- `POST /detect` - Base64 image detection
