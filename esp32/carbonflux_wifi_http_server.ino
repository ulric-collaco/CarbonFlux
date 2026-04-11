/*
 * CarbonFlux ESP32 Firmware — WiFi HTTP Server
 * Sensor : MQ-135 on GPIO34
 * Control: HTTP endpoints + BLE GATT (Flutter)
 * OTA    : ArduinoOTA over WiFi
 *
 * Endpoints:
 *   GET /status                    → current state JSON
 *   GET /command?cmd=START_WARMUP  → begin warmup
 *   GET /command?cmd=START_DETECT  → begin detection
 *   GET /command?cmd=STOP          → stop
 *   GET /command?cmd=RESET         → back to standby
 *   GET /reading                   → latest sensor reading JSON
 *   GET /stream                    → all readings since detection started (array)
 *
 * BLE (name: CarbonFlux-ESP32):
 *   Service: 6f4e0001-5f8a-4d8d-9f4f-3a7c8e3d1001
 *   Char status  (read/notify): 6f4e0002-5f8a-4d8d-9f4f-3a7c8e3d1001
 *   Char command (write)      : 6f4e0003-5f8a-4d8d-9f4f-3a7c8e3d1001
 *   Char reading (read/notify): 6f4e0004-5f8a-4d8d-9f4f-3a7c8e3d1001
 *
 * States: STANDBY → WARMUP (90s) → READY → DETECTING → STOPPED
 */

#include <WiFi.h>
#include <WebServer.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <ArduinoOTA.h>
#include <ArduinoJson.h>
// Latest reading
struct Reading {
  int      raw_adc;
  int      ppm_proxy;
  uint32_t nonce;
  uint32_t timestamp_s;
  uint32_t hash;
};

// ─── Pin ────────────────────────────────────────────────────────────────────
#define MQ_PIN 34

// ─── WiFi ───────────────────────────────────────────────────────────────────
const char* ssid1 = "Villet";
const char* pass1 = "wifiroutervillethouse";
const char* ssid2 = "Ulrics S24 Ultra";
const char* pass2 = "12345678";
const char* otaPassword = "1234";

// Static IP config per network (edit to match each network's subnet)
const IPAddress primaryIP(192, 168, 1, 77);
const IPAddress primaryGateway(192, 168, 1, 1);
const IPAddress primarySubnet(255, 255, 255, 0);

const IPAddress hotspotIP(192, 168, 43, 77);
const IPAddress hotspotGateway(192, 168, 43, 1);
const IPAddress hotspotSubnet(255, 255, 255, 0);

const IPAddress dns1(8, 8, 8, 8);
const IPAddress dns2(1, 1, 1, 1);

// BLE service + characteristics
const char* BLE_SERVICE_UUID     = "6f4e0001-5f8a-4d8d-9f4f-3a7c8e3d1001";
const char* BLE_STATUS_CHAR_UUID = "6f4e0002-5f8a-4d8d-9f4f-3a7c8e3d1001";
const char* BLE_COMMAND_CHAR_UUID= "6f4e0003-5f8a-4d8d-9f4f-3a7c8e3d1001";
const char* BLE_READING_CHAR_UUID= "6f4e0004-5f8a-4d8d-9f4f-3a7c8e3d1001";

// ─── Timing ─────────────────────────────────────────────────────────────────
#define WARMUP_MS         90000UL
#define READ_INTERVAL_MS  2000UL
#define AVG_SAMPLES       5
#define MAX_READINGS      300       // store up to 300 readings (~10 min)

// ─── State machine ───────────────────────────────────────────────────────────
enum State { STANDBY, WARMUP, READY, DETECTING, STOPPED };
State currentState = STANDBY;

const char* stateStr() {
  switch (currentState) {
    case STANDBY:   return "STANDBY";
    case WARMUP:    return "WARMUP";
    case READY:     return "READY";
    case DETECTING: return "DETECTING";
    case STOPPED:   return "STOPPED";
  }
  return "UNKNOWN";
}

// ─── Globals ─────────────────────────────────────────────────────────────────
WebServer server(80);

BLEServer* pBleServer = nullptr;
BLECharacteristic* pBleStatusCharacteristic = nullptr;
BLECharacteristic* pBleCommandCharacteristic = nullptr;
BLECharacteristic* pBleReadingCharacteristic = nullptr;
bool bleClientConnected = false;

unsigned long warmupStart  = 0;
unsigned long lastReadTime = 0;
uint32_t      nonceCounter = 0;
const char*   DEVICE_ID    = "carbonflux-001";


Reading latestReading   = {0, 0, 0, 0, 0};
Reading readings[MAX_READINGS];
int     readingCount    = 0;
bool    hasReading      = false;

String buildStatusJson();
String buildReadingJson();
void processCommand(const String& cmd, String& result, String& message);
void updateBleTelemetry(bool notify);
void setupBLE();

// ─── WiFi connection ──────────────────────────
void connectWiFi() {
  WiFi.mode(WIFI_STA);

  Serial.println("[WiFi] Connecting to primary...");
  if (!WiFi.config(primaryIP, primaryGateway, primarySubnet, dns1, dns2)) {
    Serial.println("[WiFi] Failed to apply static config for primary network");
  }
  WiFi.begin(ssid1, pass1);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 8000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() != WL_CONNECTED) {
    WiFi.disconnect(true, true);
    delay(200);

    Serial.println("\n[WiFi] Trying hotspot...");
    if (!WiFi.config(hotspotIP, hotspotGateway, hotspotSubnet, dns1, dns2)) {
      Serial.println("[WiFi] Failed to apply static config for hotspot network");
    }
    WiFi.begin(ssid2, pass2);
    start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 12000) {
      delay(500);
      Serial.print("*");
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.println("[WiFi] ─────────────────────────────────────");
    Serial.print("[WiFi] Test in browser: http://");
    Serial.print(WiFi.localIP());
    Serial.println("/status");
    Serial.println("[WiFi] ─────────────────────────────────────");
  } else {
    Serial.println("\n[WiFi] FAILED — check credentials");
  }
}

class CarbonfluxBleServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server) override {
    bleClientConnected = true;
    Serial.println("[BLE] Client connected");
  }

  void onDisconnect(BLEServer* server) override {
    bleClientConnected = false;
    Serial.println("[BLE] Client disconnected");
    server->getAdvertising()->start();
  }
};

class CarbonfluxBleCommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    String raw = characteristic->getValue();
    if (raw.length() == 0) return;

    String cmd = raw;
    cmd.trim();
    String result;
    String message;
    processCommand(cmd, result, message);

    Serial.println("[BLE] CMD " + cmd + " -> " + result + " (" + message + ")");
    updateBleTelemetry(true);
  }
};

void setupBLE() {
  BLEDevice::init("CarbonFlux-ESP32");
  pBleServer = BLEDevice::createServer();
  pBleServer->setCallbacks(new CarbonfluxBleServerCallbacks());

  BLEService* service = pBleServer->createService(BLE_SERVICE_UUID);
  pBleStatusCharacteristic = service->createCharacteristic(
    BLE_STATUS_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pBleCommandCharacteristic = service->createCharacteristic(
    BLE_COMMAND_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pBleReadingCharacteristic = service->createCharacteristic(
    BLE_READING_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );

  pBleCommandCharacteristic->setCallbacks(new CarbonfluxBleCommandCallbacks());
  service->start();

  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(BLE_SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->start();

  updateBleTelemetry(false);
  Serial.println("[BLE] Advertising as CarbonFlux-ESP32");
}

// ─── Sensor read ─────────────────────────────────────────────────────────────
float readAvgADC() {
  long sum = 0;
  for (int i = 0; i < AVG_SAMPLES; i++) {
    sum += analogRead(MQ_PIN);
    delay(20);
  }
  return (float)(sum / AVG_SAMPLES);
}

// ─── Build reading struct ────────────────────────────────────────────────────
Reading buildReading() {
  nonceCounter++;
  float raw = readAvgADC();
  Reading r;
  r.raw_adc     = (int)raw;
  r.ppm_proxy   = map((long)raw, 0, 4095, 0, 1000);
  r.nonce       = nonceCounter;
  r.timestamp_s = millis() / 1000;
  r.hash        = (uint32_t)(raw * 1000) ^ (nonceCounter << 8) ^ millis();
  return r;
}

String buildStatusJson() {
  StaticJsonDocument<300> doc;
  doc["type"]      = "STATUS";
  doc["device_id"] = DEVICE_ID;
  doc["state"]     = stateStr();
  doc["uptime_s"]  = millis() / 1000;

  if (currentState == WARMUP) {
    unsigned long elapsed = millis() - warmupStart;
    int remaining = max((int)((WARMUP_MS - elapsed) / 1000), 0);
    doc["warmup_remaining_s"] = remaining;
    doc["message"] = "Sensor warming up";
  } else if (currentState == STANDBY) {
    doc["message"] = "Send START_WARMUP to begin";
  } else if (currentState == READY) {
    doc["message"] = "Send START_DETECT to begin detection";
  } else if (currentState == DETECTING) {
    doc["reading_count"] = readingCount;
    doc["message"] = "Detection active";
  } else if (currentState == STOPPED) {
    doc["reading_count"] = readingCount;
    doc["message"] = "Detection stopped";
  }

  String out;
  serializeJson(doc, out);
  return out;
}

String buildReadingJson() {
  if (!hasReading) {
    return "{\"error\":\"no reading yet\",\"state\":\"" + String(stateStr()) + "\"}";
  }

  StaticJsonDocument<300> doc;
  doc["type"]      = "READING";
  doc["device_id"] = DEVICE_ID;
  doc["state"]     = stateStr();
  doc["raw_adc"]   = latestReading.raw_adc;
  doc["ppm_proxy"] = latestReading.ppm_proxy;
  doc["nonce"]     = latestReading.nonce;
  doc["timestamp"] = latestReading.timestamp_s;
  doc["hash"]      = latestReading.hash;

  String out;
  serializeJson(doc, out);
  return out;
}

void processCommand(const String& cmd, String& result, String& message) {
  result = "ok";
  message = "";

  if (cmd == "START_WARMUP") {
    if (currentState == STANDBY || currentState == STOPPED) {
      currentState = WARMUP;
      warmupStart  = millis();
      readingCount = 0;
      message      = "Warmup started - 90 seconds";
      Serial.println("[STATE] -> WARMUP");
    } else {
      result  = "ignored";
      message = "Already in " + String(stateStr());
    }

  } else if (cmd == "START_DETECT") {
    if (currentState == READY) {
      currentState = DETECTING;
      lastReadTime = 0;
      message      = "Detection started";
      Serial.println("[STATE] -> DETECTING");
    } else {
      result  = "ignored";
      message = "Must be in READY state - currently " + String(stateStr());
    }

  } else if (cmd == "STOP") {
    if (currentState == DETECTING || currentState == WARMUP || currentState == READY) {
      currentState = STOPPED;
      message      = "Stopped. " + String(readingCount) + " readings captured";
      Serial.println("[STATE] -> STOPPED");
    } else {
      result  = "ignored";
      message = "Nothing to stop";
    }

  } else if (cmd == "RESET") {
    currentState = STANDBY;
    readingCount = 0;
    hasReading   = false;
    nonceCounter = 0;
    message      = "Reset to STANDBY";
    Serial.println("[STATE] -> STANDBY (reset)");

  } else {
    result  = "error";
    message = "Unknown command: " + cmd;
  }
}

void updateBleTelemetry(bool notify) {
  if (pBleStatusCharacteristic == nullptr || pBleReadingCharacteristic == nullptr) {
    return;
  }

  String statusPayload = buildStatusJson();
  String readingPayload = buildReadingJson();

  pBleStatusCharacteristic->setValue(statusPayload.c_str());
  pBleReadingCharacteristic->setValue(readingPayload.c_str());

  if (notify && bleClientConnected) {
    pBleStatusCharacteristic->notify();
    pBleReadingCharacteristic->notify();
  }
}

// ─── CORS helper ─────────────────────────────────────────────────────────────
void addCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
}

// ─── HTTP handlers ───────────────────────────────────────────────────────────

// GET /status
void handleStatus() {
  addCORS();
  String out = buildStatusJson();
  server.send(200, "application/json", out);
  Serial.println("[HTTP] GET /status -> " + String(stateStr()));
}

// GET /command?cmd=START_WARMUP etc
void handleCommand() {
  addCORS();
  if (!server.hasArg("cmd")) {
    server.send(400, "application/json", "{\"error\":\"missing cmd param\"}");
    return;
  }

  String cmd = server.arg("cmd");
  String result;
  String message;
  processCommand(cmd, result, message);

  StaticJsonDocument<200> doc;
  doc["result"]  = result;
  doc["cmd"]     = cmd;
  doc["state"]   = stateStr();
  doc["message"] = message;
  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
  Serial.println("[HTTP] CMD " + cmd + " -> " + result);
  updateBleTelemetry(true);
}

// GET /reading — latest single reading
void handleReading() {
  addCORS();
  String out = buildReadingJson();
  server.send(200, "application/json", out);
}

// GET /stream — all readings as array
void handleStream() {
  addCORS();
  String out = "{\"device_id\":\"" + String(DEVICE_ID) + "\",\"count\":" + readingCount + ",\"readings\":[";
  for (int i = 0; i < readingCount; i++) {
    out += "{\"t\":" + String(readings[i].timestamp_s);
    out += ",\"adc\":" + String(readings[i].raw_adc);
    out += ",\"ppm\":" + String(readings[i].ppm_proxy);
    out += ",\"n\":" + String(readings[i].nonce);
    out += "}";
    if (i < readingCount - 1) out += ",";
  }
  out += "]}";
  server.send(200, "application/json", out);
  Serial.println("[HTTP] GET /stream → " + String(readingCount) + " readings");
}

// ─── Setup ───────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n╔══════════════════════════════╗");
  Serial.println("║   CarbonFlux ESP32 Firmware  ║");
  Serial.println("╚══════════════════════════════╝");

  connectWiFi();

  // OTA
  ArduinoOTA.setHostname("carbonflux-esp32");
  ArduinoOTA.setPassword(otaPassword);
  ArduinoOTA.onStart([]() {
    Serial.println("[OTA] Update started");
  });
  ArduinoOTA.onEnd([]() {
    Serial.println("[OTA] Update complete");
  });
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("[OTA] Error[%u]\n", error);
  });
  ArduinoOTA.begin();
  Serial.println("[OTA] Ready (password set)");

  // BLE
  setupBLE();

  // HTTP routes
  server.on("/status",  HTTP_GET, handleStatus);
  server.on("/command", HTTP_GET, handleCommand);
  server.on("/reading", HTTP_GET, handleReading);
  server.on("/stream",  HTTP_GET, handleStream);
  server.onNotFound([]() {
    server.send(404, "application/json", "{\"error\":\"not found\"}");
  });
  server.begin();
  Serial.println("[HTTP] Server started on port 80");

  Serial.println("\n[CarbonFlux] Ready — State: STANDBY");
  Serial.println("[CarbonFlux] Commands:");
  Serial.println("  /command?cmd=START_WARMUP");
  Serial.println("  /command?cmd=START_DETECT");
  Serial.println("  /command?cmd=STOP");
  Serial.println("  /command?cmd=RESET");
}

// ─── Loop ────────────────────────────────────────────────────────────────────
void loop() {
  ArduinoOTA.handle();
  server.handleClient();

  unsigned long now = millis();

  // ── WARMUP: check countdown ──
  if (currentState == WARMUP) {
    unsigned long elapsed   = now - warmupStart;
    int remaining = (int)((WARMUP_MS - elapsed) / 1000);

    // Print countdown every 10s
    static unsigned long lastPrint = 0;
    if (now - lastPrint >= 10000) {
      lastPrint = now;
      Serial.printf("[WARMUP] %ds remaining\n", max(remaining, 0));
    }

    if (elapsed >= WARMUP_MS) {
      currentState = READY;
      Serial.println("[STATE] -> READY");
      Serial.println("[CarbonFlux] Sensor ready — send START_DETECT");
      updateBleTelemetry(true);
    }
    return;
  }

  // ── DETECTING: read sensor ──
  if (currentState == DETECTING) {
    if (now - lastReadTime >= READ_INTERVAL_MS) {
      lastReadTime  = now;
      latestReading = buildReading();
      hasReading    = true;

      // Store in array
      if (readingCount < MAX_READINGS) {
        readings[readingCount++] = latestReading;
      }

      // Print to serial
      Serial.printf("[READ] #%d | ADC: %4d | PPM proxy: %4d | Nonce: %d\n",
        readingCount,
        latestReading.raw_adc,
        latestReading.ppm_proxy,
        latestReading.nonce
      );

      updateBleTelemetry(true);
    }
    return;
  }

  delay(10);
}
