import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;

import '../models/sensor_reading.dart';

/// Result of a batch upload attempt.
class UploadResult {
  const UploadResult({
    required this.success,
    required this.uploaded,
    required this.failed,
    this.lastBlockIndex,
    this.error,
  });

  final bool success;
  final int uploaded;
  final int failed;
  final int? lastBlockIndex;
  final String? error;

  @override
  String toString() =>
      'UploadResult(success=$success, uploaded=$uploaded, failed=$failed)';
}

/// Sends validated readings to the CarbonFlux Cloudflare Worker.
///
/// Responsibilities:
///   - Compute SHA-256 data hash over canonical payload fields
///   - Compute HMAC-SHA256 signature using shared secret
///   - POST each reading to /ingest
///   - Return an aggregate UploadResult
class BackendService {
  BackendService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  /// CF Worker — deployed at https://carbonflux-worker.collacou.workers.dev
  static const String _baseUrl =
      String.fromEnvironment('BACKEND_URL', defaultValue: 'https://carbonflux-worker.collacou.workers.dev');

  /// Must match HMAC_SECRET in wrangler.toml
  static const String _hmacSecret =
      String.fromEnvironment('HMAC_SECRET', defaultValue: 'CARBONFLUX_SECRET_KEY_2024');

  static const Duration _timeout = Duration(seconds: 10);

  // ─── Crypto helpers ──────────────────────────────────────────────

  /// SHA-256 hex of a UTF-8 string.
  String _sha256Hex(String input) {
    final bytes = utf8.encode(input);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  /// HMAC-SHA256 hex over [message] using [_hmacSecret].
  String _hmacSha256Hex(String message) {
    final keyBytes = utf8.encode(_hmacSecret);
    final msgBytes = utf8.encode(message);
    final hmac = Hmac(sha256, keyBytes);
    final digest = hmac.convert(msgBytes);
    return digest.toString();
  }

  // ─── Payload building ─────────────────────────────────────────────

  /// Builds the canonical payload JSON for hashing.
  /// Field order MUST match the CF Worker's canonicalPayload.
  String _canonicalJson({
    required String deviceId,
    required int timestamp,
    required int nonce,
    required double ppmValue,
    required double avgPpm,
  }) {
    // jsonEncode produces sorted keys in Dart — but to be safe we build
    // the map in the exact same key order as the CF Worker.
    final map = <String, dynamic>{
      'device_id': deviceId,
      'timestamp': timestamp,
      'nonce': nonce,
      'ppm_value': ppmValue,
      'avg_ppm': avgPpm,
    };
    return jsonEncode(map);
  }

  /// Builds the full ingest payload from a [SensorReading].
  Map<String, dynamic> _buildPayload(SensorReading reading) {
    // Use rawAdc / 10.0 as avg_ppm proxy (firmware sends ppmProxy for both)
    final ppmValue = reading.ppmProxy;
    final avgPpm = reading.ppmProxy; // Same until firmware exposes avg separately

    final canonical = _canonicalJson(
      deviceId: reading.deviceId,
      timestamp: reading.timestamp,
      nonce: reading.nonce,
      ppmValue: ppmValue,
      avgPpm: avgPpm,
    );

    final dataHash = _sha256Hex(canonical);
    final signature = _hmacSha256Hex(dataHash);

    return {
      'device_id': reading.deviceId,
      'timestamp': reading.timestamp,
      'nonce': reading.nonce,
      'ppm_value': ppmValue,
      'avg_ppm': avgPpm,
      'data_hash': dataHash,
      'signature': signature,
    };
  }

  // ─── Upload ───────────────────────────────────────────────────────

  /// Upload a single reading. Returns the parsed response body or throws.
  Future<Map<String, dynamic>> _postReading(SensorReading reading) async {
    final payload = _buildPayload(reading);
    final body = jsonEncode(payload);

    final response = await _client
        .post(
          Uri.parse('$_baseUrl/ingest'),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: body,
        )
        .timeout(_timeout);

    final decoded = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 200 && decoded['success'] == true) {
      return decoded;
    }

    throw BackendException(
      decoded['error']?.toString() ?? 'Upload failed (HTTP ${response.statusCode})',
    );
  }

  /// Batch-upload [readings] to the backend.
  ///
  /// Skips readings not in DETECTING state to avoid noise.
  /// Called by the controller when detection stops.
  Future<UploadResult> uploadBatch(List<SensorReading> readings) async {
    // Filter to only DETECTING readings with real ppm data
    final toUpload = readings
        .where((r) => r.state == 'DETECTING' && r.ppmProxy > 0)
        .toList();

    if (toUpload.isEmpty) {
      return const UploadResult(
        success: true,
        uploaded: 0,
        failed: 0,
        error: 'No DETECTING readings to upload',
      );
    }

    int uploaded = 0;
    int failed = 0;
    int? lastBlockIndex;
    String? lastError;

    for (final reading in toUpload) {
      try {
        final result = await _postReading(reading);
        uploaded++;
        lastBlockIndex = result['block_index'] as int?;
      } catch (e) {
        failed++;
        lastError = e.toString();
        // Continue uploading remaining readings even if one fails
      }
    }

    return UploadResult(
      success: failed == 0,
      uploaded: uploaded,
      failed: failed,
      lastBlockIndex: lastBlockIndex,
      error: lastError,
    );
  }

  void dispose() {
    _client.close();
  }
}

class BackendException implements Exception {
  BackendException(this.message);
  final String message;
  @override
  String toString() => message;
}
