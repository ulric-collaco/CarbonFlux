# CarbonFlux

CarbonFlux is a trustless industrial emission tracking platform that creates a verifiable chain of custody from physical sensor readings to immutable blockchain-style records.

Instead of relying on self-reported data, CarbonFlux captures gas readings, applies cryptographic integrity checks, validates them server-side, and stores them in a tamper-evident chain for auditability.

## Why CarbonFlux Exists

Greenwashing is a real risk when organizations self-report environmental data without independent verification.

CarbonFlux addresses this by ensuring each reading is:

- Timestamped
- Nonce-protected
- SHA-256 hashed
- HMAC-SHA256 signed
- Validated before storage
- Anchored to an immutable blockchain-like log

## Classroom Demo Context

This project is designed for a 5-minute teacher demonstration.

MQ-135 warmup behavior is part of the flow:

1. Power on the device
2. Warmup for approximately 90 seconds
3. Start detection
4. Introduce smoke/gas source
5. Observe ppm spike on dashboard
6. Stop detection

The system must support bidirectional control and live status updates during the demo.

## Architecture

### Phase 1 (Current Build Target)

ESP32 connects over BLE to a Flutter app. The app forwards validated payloads over mobile data to the backend. The backend validates and forwards to a Cloudflare Worker for blockchain logging. The web dashboard reads recent data from backend APIs.

Flow:

ESP32 (BLE) <-> Flutter App -> Backend Server -> Cloudflare Worker (blockchain)

Backend Server -> Web Frontend (polling or push)

### Phase 2 (After Phase 1)

ESP32 connects via WiFi hotspot and maintains a WebSocket session with a GCP VM relay. The relay forwards data to backend and routes control messages between browser and ESP32.

Flow:

ESP32 (WiFi) <-> GCP VM Relay (WebSocket) -> Backend Server -> Cloudflare Worker

Web Frontend <-> GCP VM Relay (WebSocket)

The backend, Cloudflare Worker, and dashboard remain consistent across both phases. Only device connectivity and relay path change.

## Core Components

1. ESP32 Firmware (Arduino/C++)
- Reads MQ-135 every 2 seconds
- Computes rolling average over 5 readings
- Produces structured payload with nonce + timestamp
- Hashes payload (SHA-256) and signs with HMAC-SHA256
- Implements state machine: STANDBY -> WARMUP -> READY -> DETECTING -> STOPPED
- Supports bidirectional command/status channels

2. Flutter App (Phase 1)
- BLE scan/connect to ESP32
- Receives live status + reading streams
- Provides control UI (Warmup, Detect, Stop)
- Forwards validated readings to backend over HTTPS

3. GCP VM Relay (Phase 2)
- Stateless WebSocket relay
- Routes commands from browser to ESP32
- Routes readings/status from ESP32 to browser and backend
- Supports TLS termination via reverse proxy

4. Backend Server
- Ingests payloads from Flutter (Phase 1) or VM relay (Phase 2)
- Verifies hash, signature, nonce uniqueness, and timestamp window
- Stores validated readings
- Forwards valid entries to Cloudflare Worker
- Exposes APIs for status and readings

5. Cloudflare Worker + Blockchain Layer
- Appends each validated reading as a block
- Maintains previous_hash linkage for tamper evidence
- Re-validates chain on audit reads
- Flags violations above threshold

6. Web Frontend Dashboard
- Live ppm monitor + device state
- Blockchain log and chain audit view
- Threshold-based visual alerts
- Responsive for mobile classroom viewing

## Shared Payload Contract

All components use this JSON schema:

```json
{
  "device_id": "carbonflux-001",
  "timestamp": 1712000000,
  "nonce": "a3f9b2c1",
  "ppm_value": 420.5,
  "avg_ppm": 418.2,
  "data_hash": "sha256hexstring",
  "signature": "hmacsha256hexstring"
}
```

## Security Model

- SHA-256 detects tampering
- HMAC-SHA256 proves trusted origin
- Nonce + timestamp blocks replay attacks
- Chain linking enforces immutability
- Phase 2 adds TLS for transport protection

## Repository Structure

- `esp32/`: ESP32 firmware and sensor integration
- `flutter-app/`: Flutter BLE bridge and control app
- `website/`: Web platform workspace
- `website/frontend/`: Dashboard UI
- `website/backend/`: API and ingestion services

## Build Strategy

- Build each component independently with the shared payload contract
- Keep integration points explicit and versioned
- Validate end-to-end flow in Phase 1 before moving to Phase 2
