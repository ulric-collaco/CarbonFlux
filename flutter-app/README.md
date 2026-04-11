# CarbonFlux Flutter App

WiFi-based control and monitoring app for CarbonFlux Phase 1.

This project is configured for PC use. You can run it in a browser on your computer (recommended) and Windows desktop is also available.

## What This App Does

- Connects to ESP32 via local WiFi HTTP server
- Auto-discovers ESP32 on local network/hotspot from the connection screen
- Supports Bluetooth LE connection with nearby device scanning
- Sends control commands (`START_WARMUP`, `START_DETECT`, `STOP`, `RESET`)
- Polls live readings every 2 seconds from `/reading`
- Polls device status from `/status`
- Displays real-time PPM line chart with spike highlighting
- Fetches `/stream` dataset for quick stream inspection

## ESP32 Endpoints Used

- `GET /status`
- `GET /command?cmd=START_WARMUP`
- `GET /command?cmd=START_DETECT`
- `GET /command?cmd=STOP`
- `GET /command?cmd=RESET`
- `GET /reading`
- `GET /stream`

## Project Structure

- `lib/models/` JSON data models
- `lib/services/` ESP32 API service and HTTP error handling
- `lib/providers/` Riverpod state and polling controller
- `lib/screens/` Connection and dashboard pages
- `lib/widgets/` Reusable dashboard UI components

## Dependencies

- `flutter_riverpod`
- `http`
- `fl_chart`
- `shared_preferences`
- `intl`

## Run

1. Install Flutter SDK (latest stable)
2. In `flutter-app/`, run:

```bash
flutter pub get
flutter devices
flutter run -d chrome
```

Optional native desktop run (requires Visual Studio C++ Build Tools on Windows):

```bash
flutter run -d windows
```

Notes:

- Android/Gradle project folder has been removed from this app.
- If `chrome` is not listed in `flutter devices`, run `flutter config --enable-web` once.

## Demo Flow

1. Enter ESP32 IP and connect
	- or tap Find ESP32 Automatically and select a discovered device
	 - or switch to Bluetooth mode and scan nearby devices
2. Start warmup and monitor countdown
3. Start detection and monitor live graph
4. Introduce gas and observe spikes
5. Stop detection and inspect stream readings

## Connection Modes

- WiFi mode:
	- Manual IP entry
	- Suggested IP chips for quick prefill
	- Network scan for ESP32 `/status`
- Bluetooth mode:
	- BLE scan for nearby devices
	- Highlights likely CarbonFlux targets (`CarbonFlux` / `ESP32`)
	- One-tap connect from discovered list
