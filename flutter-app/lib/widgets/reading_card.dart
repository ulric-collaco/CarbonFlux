import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/sensor_reading.dart';

class ReadingCard extends StatelessWidget {
  const ReadingCard({super.key, required this.reading});

  final SensorReading reading;

  @override
  Widget build(BuildContext context) {
    final ppm = reading.ppmProxy;
    final isHigh = ppm > 1000;
    final valueColor = isHigh ? Colors.redAccent.shade200 : Colors.cyanAccent;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF111722),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF1F2A3A)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Live Sensor Reading',
            style: TextStyle(fontSize: 14, color: Color(0xFFAAB6CA)),
          ),
          const SizedBox(height: 10),
          Wrap(
            runSpacing: 12,
            spacing: 18,
            children: [
              _metric('PPM', ppm.toStringAsFixed(1), valueColor, large: true),
              _metric('RAW ADC', reading.rawAdc.toString(), Colors.white),
              _metric('NONCE', reading.nonce.toString(), const Color(0xFFAAB6CA)),
              _metric(
                'TIMESTAMP',
                DateFormat('HH:mm:ss').format(
                  DateTime.fromMillisecondsSinceEpoch(
                    reading.timestamp * 1000,
                    isUtc: true,
                  ).toLocal(),
                ),
                const Color(0xFFAAB6CA),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _metric(String label, String value, Color color, {bool large = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF6F7D95))),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: large ? 30 : 20,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
      ],
    );
  }
}
