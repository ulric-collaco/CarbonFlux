import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/device_status.dart';
import '../models/sensor_reading.dart';
import '../services/backend_service.dart';
import '../services/esp32_api_service.dart';
import '../services/esp32_bluetooth_service.dart';

enum ConnectionTransport { wifi, bluetooth }

class CarbonfluxAppState {
  const CarbonfluxAppState({
    this.savedIp,
    this.transport = ConnectionTransport.wifi,
    this.isConnecting = false,
    this.isConnected = false,
    this.isCommandInFlight = false,
    this.isDiscoveringWifi = false,
    this.isDiscoveringBluetooth = false,
    this.errorMessage,
    this.status,
    this.latestReading,
    this.readingHistory = const [],
    this.streamReadings = const [],
    this.discoveredWifiDevices = const [],
    this.discoveredBluetoothDevices = const [],
    this.connectedBluetoothDeviceId,
    this.connectedBluetoothDeviceName,
    this.isDetectionCycleRunning = false,
    this.lastWarmupCompletedAt,
    this.warmupStartedAt,
    this.lastUpdated,
    this.isUploading = false,
    this.lastUploadResult,
    this.uploadingStatus,
  });

  final String? savedIp;
  final ConnectionTransport transport;
  final bool isConnecting;
  final bool isConnected;
  final bool isCommandInFlight;
  final bool isDiscoveringWifi;
  final bool isDiscoveringBluetooth;
  final String? errorMessage;
  final DeviceStatus? status;
  final SensorReading? latestReading;
  final List<SensorReading> readingHistory;
  final List<SensorReading> streamReadings;
  final List<DiscoveredEsp32Device> discoveredWifiDevices;
  final List<DiscoveredBluetoothDevice> discoveredBluetoothDevices;
  final String? connectedBluetoothDeviceId;
  final String? connectedBluetoothDeviceName;
  final bool isDetectionCycleRunning;
  final DateTime? lastWarmupCompletedAt;
  final DateTime? warmupStartedAt;
  final DateTime? lastUpdated;
  final bool isUploading;
  final UploadResult? lastUploadResult;
  final String? uploadingStatus;

  CarbonfluxAppState copyWith({
    String? savedIp,
    ConnectionTransport? transport,
    bool? isConnecting,
    bool? isConnected,
    bool? isCommandInFlight,
    bool? isDiscoveringWifi,
    bool? isDiscoveringBluetooth,
    String? errorMessage,
    bool clearError = false,
    DeviceStatus? status,
    SensorReading? latestReading,
    List<SensorReading>? readingHistory,
    List<SensorReading>? streamReadings,
    List<DiscoveredEsp32Device>? discoveredWifiDevices,
    List<DiscoveredBluetoothDevice>? discoveredBluetoothDevices,
    String? connectedBluetoothDeviceId,
    String? connectedBluetoothDeviceName,
    bool? isDetectionCycleRunning,
    DateTime? lastWarmupCompletedAt,
    DateTime? warmupStartedAt,
    bool clearWarmupStart = false,
    DateTime? lastUpdated,
    bool? isUploading,
    UploadResult? lastUploadResult,
    String? uploadingStatus,
    bool clearUploadingStatus = false,
  }) {
    return CarbonfluxAppState(
      savedIp: savedIp ?? this.savedIp,
      transport: transport ?? this.transport,
      isConnecting: isConnecting ?? this.isConnecting,
      isConnected: isConnected ?? this.isConnected,
      isCommandInFlight: isCommandInFlight ?? this.isCommandInFlight,
      isDiscoveringWifi: isDiscoveringWifi ?? this.isDiscoveringWifi,
      isDiscoveringBluetooth:
          isDiscoveringBluetooth ?? this.isDiscoveringBluetooth,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      status: status ?? this.status,
      latestReading: latestReading ?? this.latestReading,
      readingHistory: readingHistory ?? this.readingHistory,
      streamReadings: streamReadings ?? this.streamReadings,
      discoveredWifiDevices:
          discoveredWifiDevices ?? this.discoveredWifiDevices,
      discoveredBluetoothDevices:
          discoveredBluetoothDevices ?? this.discoveredBluetoothDevices,
      connectedBluetoothDeviceId:
          connectedBluetoothDeviceId ?? this.connectedBluetoothDeviceId,
      connectedBluetoothDeviceName:
          connectedBluetoothDeviceName ?? this.connectedBluetoothDeviceName,
      isDetectionCycleRunning:
          isDetectionCycleRunning ?? this.isDetectionCycleRunning,
      lastWarmupCompletedAt:
          lastWarmupCompletedAt ?? this.lastWarmupCompletedAt,
      warmupStartedAt:
          clearWarmupStart ? null : (warmupStartedAt ?? this.warmupStartedAt),
      lastUpdated: lastUpdated ?? this.lastUpdated,
      isUploading: isUploading ?? this.isUploading,
      lastUploadResult: lastUploadResult ?? this.lastUploadResult,
      uploadingStatus: clearUploadingStatus ? null : (uploadingStatus ?? this.uploadingStatus),
    );
  }

  int get warmupRemainingSeconds {
    if (status?.state != 'WARMUP' || warmupStartedAt == null) return 0;
    final elapsed = DateTime.now().difference(warmupStartedAt!).inSeconds;
    final left = 90 - elapsed;
    return left < 0 ? 0 : left;
  }

  String get statusMessage {
    switch (status?.state) {
      case 'STANDBY':
        return 'Device idle. Ready to warm up.';
      case 'WARMUP':
        return 'Sensor stabilizing. Please wait.';
      case 'READY':
        return 'System ready. Start detection when prepared.';
      case 'DETECTING':
        return 'Live detection running.';
      case 'STOPPED':
        return 'Detection stopped. Data preserved for review.';
      default:
        return 'Awaiting device status.';
    }
  }
}

class CarbonfluxController extends StateNotifier<CarbonfluxAppState> {
  CarbonfluxController(this._api, this._bluetooth, this._backend)
      : super(const CarbonfluxAppState()) {
    unawaited(_loadSavedIp());
  }

  static const _savedIpKey = 'esp32_ip_address';
  static const _lastWarmupCompletedAtKey = 'last_warmup_completed_at';
  static const _maxHistoryPoints = 120;
  static const _detectionRunDuration = Duration(seconds: 15);
  static const _warmupReuseWindow = Duration(minutes: 30);

  final Esp32ApiService _api;
  final Esp32BluetoothService _bluetooth;
  final BackendService _backend;
  Timer? _pollTimer;
  int _pollTicks = 0;

  Future<void> _loadSavedIp() async {
    final prefs = await SharedPreferences.getInstance();
    final savedIp = prefs.getString(_savedIpKey);
    final lastWarmupRaw = prefs.getInt(_lastWarmupCompletedAtKey);

    state = state.copyWith(
      savedIp: (savedIp == null || savedIp.isEmpty) ? null : savedIp,
      lastWarmupCompletedAt: lastWarmupRaw == null
          ? null
          : DateTime.fromMillisecondsSinceEpoch(lastWarmupRaw),
    );
  }

  Future<void> _persistLastWarmup(DateTime ts) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_lastWarmupCompletedAtKey, ts.millisecondsSinceEpoch);
  }

  void setTransport(ConnectionTransport transport) {
    if (state.transport == transport) return;
    state = state.copyWith(transport: transport, clearError: true);
  }

  Future<void> connect(String target) async {
    if (state.transport == ConnectionTransport.wifi) {
      await _connectWifi(target);
      return;
    }
    await _connectBluetooth(target);
  }

  Future<void> _connectWifi(String ip) async {
    final sanitizedIp = ip.trim();

    if (!_isLikelyIp(sanitizedIp)) {
      state = state.copyWith(
        errorMessage: 'Invalid IP format. Example: 192.168.1.120',
      );
      return;
    }

    state = state.copyWith(isConnecting: true, clearError: true);

    try {
      final status = await _api.getStatus(sanitizedIp);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_savedIpKey, sanitizedIp);
      final connectedAt = DateTime.now();
      DateTime? lastWarmupAt = state.lastWarmupCompletedAt;
      if (status.state == 'READY') {
        lastWarmupAt = connectedAt;
        await _persistLastWarmup(connectedAt);
      }

      state = state.copyWith(
        savedIp: sanitizedIp,
        isConnecting: false,
        isConnected: true,
        status: status,
        streamReadings: const [],
        readingHistory: const [],
        connectedBluetoothDeviceId: null,
        connectedBluetoothDeviceName: null,
        lastWarmupCompletedAt: lastWarmupAt,
        warmupStartedAt: status.state == 'WARMUP' ? DateTime.now() : null,
        clearError: true,
      );

      await _fetchReadingWifi();
      _startPolling();
    } on Esp32ApiException catch (error) {
      state = state.copyWith(
        isConnecting: false,
        isConnected: false,
        errorMessage: error.message,
      );
    }
  }

  Future<void> _connectBluetooth(String deviceId) async {
    final trimmedId = deviceId.trim();
    if (trimmedId.isEmpty) {
      state = state.copyWith(errorMessage: 'Pick a Bluetooth device first.');
      return;
    }

    state = state.copyWith(isConnecting: true, clearError: true);

    try {
      final status = await _bluetooth.connectAndReadStatus(trimmedId);
      final selected = state.discoveredBluetoothDevices
          .where((d) => d.id == trimmedId)
          .firstOrNull;
      final connectedAt = DateTime.now();
      DateTime? lastWarmupAt = state.lastWarmupCompletedAt;
      if (status.state == 'READY') {
        lastWarmupAt = connectedAt;
        await _persistLastWarmup(connectedAt);
      }

      state = state.copyWith(
        isConnecting: false,
        isConnected: true,
        status: status,
        streamReadings: const [],
        readingHistory: const [],
        connectedBluetoothDeviceId: trimmedId,
        connectedBluetoothDeviceName: selected?.name,
        lastWarmupCompletedAt: lastWarmupAt,
        warmupStartedAt: status.state == 'WARMUP' ? DateTime.now() : null,
        clearError: true,
      );

      await _fetchReadingBluetooth();
      _startPolling();
    } on Esp32BluetoothException catch (error) {
      state = state.copyWith(
        isConnecting: false,
        isConnected: false,
        errorMessage: error.message,
      );
    }
  }

  Future<void> reconnectSavedIp() async {
    if (state.savedIp == null) return;
    await _connectWifi(state.savedIp!);
  }

  Future<void> discoverWifiDevices({String? hintIp}) async {
    if (state.isDiscoveringWifi) return;

    final hint = (hintIp ?? state.savedIp)?.trim();
    state = state.copyWith(
      isDiscoveringWifi: true,
      discoveredWifiDevices: const [],
      clearError: true,
    );

    try {
      final discovered = await _api.discoverDevices(hintIp: hint);

      state = state.copyWith(
        isDiscoveringWifi: false,
        discoveredWifiDevices: discovered,
        errorMessage: discovered.isEmpty
            ? 'No ESP32 found on WiFi. Ensure phone and ESP32 are on same network.'
            : null,
        clearError: discovered.isNotEmpty,
      );
    } on Esp32ApiException catch (error) {
      state = state.copyWith(
        isDiscoveringWifi: false,
        errorMessage: error.message,
      );
    } catch (_) {
      state = state.copyWith(
        isDiscoveringWifi: false,
        errorMessage: 'WiFi discovery failed. Try again.',
      );
    }
  }

  Future<void> discoverBluetoothDevices() async {
    if (state.isDiscoveringBluetooth) return;

    state = state.copyWith(
      isDiscoveringBluetooth: true,
      discoveredBluetoothDevices: const [],
      clearError: true,
    );

    try {
      final discovered = await _bluetooth.scanDevices();
      state = state.copyWith(
        isDiscoveringBluetooth: false,
        discoveredBluetoothDevices: discovered,
        errorMessage:
            discovered.isEmpty ? 'No Bluetooth devices found nearby.' : null,
        clearError: discovered.isNotEmpty,
      );
    } on Esp32BluetoothException catch (error) {
      state = state.copyWith(
        isDiscoveringBluetooth: false,
        errorMessage: error.message,
      );
    } catch (_) {
      state = state.copyWith(
        isDiscoveringBluetooth: false,
        errorMessage: 'Bluetooth scan failed. Check permissions and retry.',
      );
    }
  }

  Future<void> disconnect() async {
    _pollTimer?.cancel();
    await _bluetooth.disconnect();
    state = state.copyWith(
      isConnected: false,
      isConnecting: false,
      isCommandInFlight: false,
      status: null,
      latestReading: null,
      readingHistory: const [],
      streamReadings: const [],
      clearWarmupStart: true,
    );
  }

  Future<bool> sendCommand(String command) async {
    if (!state.isConnected) return false;

    state = state.copyWith(isCommandInFlight: true, clearError: true);

    try {
      final status = state.transport == ConnectionTransport.wifi
          ? await _api.sendCommand(state.savedIp!, command)
          : await _bluetooth.sendCommand(command);

      DateTime? warmupStart = state.warmupStartedAt;
      bool clearWarmup = false;

      if (command == 'START_WARMUP' || status.state == 'WARMUP') {
        warmupStart = DateTime.now();
      }

      if (status.state == 'READY' || command == 'RESET' || command == 'STOP') {
        clearWarmup = true;
      }

      state = state.copyWith(
        isCommandInFlight: false,
        status: status,
        warmupStartedAt: warmupStart,
        clearWarmupStart: clearWarmup,
        savedIp: status.ip ?? state.savedIp,
      );

      await _refreshNow(forceStream: true);

      // ── Batch upload to backend when detection stops ───────────────
      if (command == 'STOP' && state.readingHistory.isNotEmpty) {
        unawaited(_uploadDetectionBatch());
      }

      return true;
    } on Esp32ApiException catch (error) {
      state = state.copyWith(
        isCommandInFlight: false,
        errorMessage: error.message,
      );
      return false;
    } on Esp32BluetoothException catch (error) {
      state = state.copyWith(
        isCommandInFlight: false,
        errorMessage: error.message,
      );
      return false;
    }
  }

  Future<bool> startDetectionCycle() async {
    if (!state.isConnected || state.isDetectionCycleRunning) return false;

    state = state.copyWith(isDetectionCycleRunning: true, clearError: true);

    try {
      if (_isWarmupNeeded()) {
        final warmed = await _performWarmupIfNeeded();
        if (!warmed) {
          throw Esp32ApiException('Warmup failed or timed out.');
        }
      }

      var started = await _attemptStartDetection();
      if (!started) {
        final warmed = await _performWarmupIfNeeded();
        if (!warmed) {
          throw Esp32ApiException('Warmup required but did not complete.');
        }
        started = await _attemptStartDetection();
      }

      if (!started) {
        throw Esp32ApiException('Could not enter DETECTING state.');
      }

      await Future.delayed(_detectionRunDuration);

      if (state.isConnected && state.status?.state == 'DETECTING') {
        await sendCommand('STOP');
      }

      state = state.copyWith(isDetectionCycleRunning: false);
      return true;
    } on Esp32ApiException catch (error) {
      state = state.copyWith(
        isDetectionCycleRunning: false,
        errorMessage: error.message,
      );
      return false;
    } on Esp32BluetoothException catch (error) {
      state = state.copyWith(
        isDetectionCycleRunning: false,
        errorMessage: error.message,
      );
      return false;
    } catch (_) {
      state = state.copyWith(
        isDetectionCycleRunning: false,
        errorMessage: 'Detection cycle failed. Try again.',
      );
      return false;
    }
  }

  bool _isWarmupNeeded() {
    final last = state.lastWarmupCompletedAt;
    if (last == null) return true;
    return DateTime.now().difference(last) > _warmupReuseWindow;
  }

  Future<bool> _performWarmupIfNeeded() async {
    final warmupStarted = await sendCommand('START_WARMUP');
    if (!warmupStarted) return false;

    final ready = await _waitForReady(timeout: const Duration(seconds: 110));
    if (!ready) return false;

    final now = DateTime.now();
    await _persistLastWarmup(now);
    state = state.copyWith(lastWarmupCompletedAt: now);
    return true;
  }

  Future<bool> _attemptStartDetection() async {
    final ok = await sendCommand('START_DETECT');
    if (!ok) return false;

    await _refreshNow();
    return state.status?.state == 'DETECTING';
  }

  Future<bool> _waitForReady({required Duration timeout}) async {
    final started = DateTime.now();
    while (DateTime.now().difference(started) < timeout) {
      await _refreshNow();
      if (state.status?.state == 'READY') return true;
      if (!state.isConnected) return false;
      await Future.delayed(const Duration(seconds: 1));
    }
    return false;
  }

  Future<void> refreshStream() async {
    if (!state.isConnected) return;

    if (state.transport == ConnectionTransport.bluetooth) {
      state = state.copyWith(streamReadings: [...state.readingHistory]);
      return;
    }

    try {
      final streamReadings = await _api.getStream(state.savedIp!);
      state = state.copyWith(streamReadings: streamReadings, clearError: true);
    } on Esp32ApiException catch (error) {
      state = state.copyWith(errorMessage: error.message);
    }
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }

  Future<void> _refreshNow({bool forceStream = false}) async {
    if (!state.isConnected) return;

    try {
      final status = state.transport == ConnectionTransport.wifi
          ? await _api.getStatus(state.savedIp!)
          : await _bluetooth.getStatus();

      DateTime? warmupStart = state.warmupStartedAt;
      bool clearWarmup = false;

      if (status.state == 'WARMUP' && warmupStart == null) {
        warmupStart = DateTime.now();
      }
      if (status.state != 'WARMUP') {
        clearWarmup = true;
      }

      state = state.copyWith(
        status: status,
        warmupStartedAt: warmupStart,
        clearWarmupStart: clearWarmup,
        lastUpdated: DateTime.now(),
        savedIp: status.ip ?? state.savedIp,
      );

      if (state.transport == ConnectionTransport.wifi) {
        await _fetchReadingWifi();
      } else {
        await _fetchReadingBluetooth();
      }

      final shouldRefreshStream = forceStream ||
          (_pollTicks % 5 == 0 &&
              (status.state == 'DETECTING' || status.state == 'STOPPED'));
      if (shouldRefreshStream) {
        await refreshStream();
      }
    } on Esp32ApiException catch (error) {
      state = state.copyWith(errorMessage: error.message, isConnected: false);
      _pollTimer?.cancel();
    } on Esp32BluetoothException catch (error) {
      state = state.copyWith(errorMessage: error.message, isConnected: false);
      _pollTimer?.cancel();
    }
  }

  Future<void> _fetchReadingWifi() async {
    final reading = await _api.getReading(state.savedIp!);
    _appendReading(reading);
  }

  Future<void> _fetchReadingBluetooth() async {
    try {
      final reading = await _bluetooth.getReading();
      _appendReading(reading);
    } on Esp32BluetoothException catch (error) {
      if (error.message.toLowerCase().contains('no reading yet')) {
        return;
      }
      rethrow;
    }
  }

  void _appendReading(SensorReading reading) {
    final updatedHistory = [...state.readingHistory, reading];
    if (updatedHistory.length > _maxHistoryPoints) {
      updatedHistory.removeRange(0, updatedHistory.length - _maxHistoryPoints);
    }

    state = state.copyWith(
      latestReading: reading,
      readingHistory: updatedHistory,
      status: state.status?.state == reading.state
          ? state.status
          : DeviceStatus(
              deviceId: reading.deviceId,
              state: reading.state,
              timestamp: reading.timestamp,
            ),
      lastUpdated: DateTime.now(),
    );

    // Live sync to backend for the classroom demo when in DETECTING state
    if (reading.state == 'DETECTING' && reading.ppmProxy > 0) {
      unawaited(_uploadSingleReading(reading));
    }
  }

  Future<void> _uploadSingleReading(SensorReading reading) async {
    state = state.copyWith(isUploading: true, uploadingStatus: 'Hashing & Signing data...');
    // Minimal delay to let the UI show the first step to users for demo purposes
    await Future.delayed(const Duration(milliseconds: 300));
    
    state = state.copyWith(uploadingStatus: 'Sending payload to Backend...');
    
    try {
      final result = await _backend.uploadReadingLive(reading);
      if (result.success) {
         state = state.copyWith(
           lastUploadResult: result,
           uploadingStatus: 'Verified! Block #${result.lastBlockIndex} updated.',
         );
      } else {
         state = state.copyWith(uploadingStatus: 'Upload failed: ${result.error}');
      }
    } catch (_) {
      state = state.copyWith(uploadingStatus: 'Upload failed (Network Error)');
    }

    // Leave the success/fail message visible for a short period before clearing
    await Future.delayed(const Duration(milliseconds: 1500));
    if (state.uploadingStatus != null) {
      state = state.copyWith(isUploading: false, clearUploadingStatus: true);
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
      _pollTicks += 1;
      await _refreshNow();
    });
  }

  bool _isLikelyIp(String value) {
    final parts = value.split('.');
    if (parts.length != 4) return false;
    for (final p in parts) {
      final n = int.tryParse(p);
      if (n == null || n < 0 || n > 255) return false;
    }
    return true;
  }

  /// Upload all DETECTING readings accumulated during this session to the CF Worker.
  Future<void> _uploadDetectionBatch() async {
    state = state.copyWith(isUploading: true);
    try {
      final result = await _backend.uploadBatch(state.readingHistory);
      state = state.copyWith(
        isUploading: false,
        lastUploadResult: result,
      );
    } catch (e) {
      state = state.copyWith(
        isUploading: false,
        lastUploadResult: UploadResult(
          success: false,
          uploaded: 0,
          failed: state.readingHistory.length,
          error: e.toString(),
        ),
      );
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _bluetooth.dispose();
    _backend.dispose();
    super.dispose();
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
