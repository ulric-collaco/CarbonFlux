class SensorReading {
  const SensorReading({
    required this.deviceId,
    required this.state,
    required this.rawAdc,
    required this.ppmProxy,
    required this.nonce,
    required this.timestamp,
    required this.hash,
  });

  final String deviceId;
  final String state;
  final int rawAdc;
  final double ppmProxy;
  final int nonce;
  final int timestamp;
  final int hash;

  factory SensorReading.fromJson(Map<String, dynamic> json) {
    return SensorReading(
      deviceId: (json['device_id'] ?? 'unknown').toString(),
      state: (json['state'] ?? 'UNKNOWN').toString(),
      rawAdc: _toInt(json['raw_adc']),
      ppmProxy: _toDouble(json['ppm_proxy']),
      nonce: _toInt(json['nonce']),
      timestamp: _toInt(json['timestamp']),
      hash: _toInt(json['hash']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'device_id': deviceId,
      'state': state,
      'raw_adc': rawAdc,
      'ppm_proxy': ppmProxy,
      'nonce': nonce,
      'timestamp': timestamp,
      'hash': hash,
    };
  }

  static int _toInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  static double _toDouble(dynamic value) {
    if (value is double) return value;
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }
}
