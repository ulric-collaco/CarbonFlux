import '../models/sensor_reading.dart';

bool isSameSensorSample(SensorReading a, SensorReading b) {
  return a.deviceId == b.deviceId &&
      a.nonce == b.nonce &&
      a.timestamp == b.timestamp &&
      a.hash == b.hash &&
      a.rawAdc == b.rawAdc &&
      a.ppmProxy == b.ppmProxy;
}

List<SensorReading> appendUniqueReading(
  List<SensorReading> history,
  SensorReading reading, {
  required int maxPoints,
}) {
  if (history.isNotEmpty && isSameSensorSample(history.last, reading)) {
    return history;
  }

  final updated = [...history, reading];
  if (updated.length > maxPoints) {
    updated.removeRange(0, updated.length - maxPoints);
  }
  return updated;
}
