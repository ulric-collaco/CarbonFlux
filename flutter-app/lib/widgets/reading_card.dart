import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/sensor_reading.dart';
import '../theme/carbonflux_theme.dart';
import 'hud_panel.dart';

class ReadingCard extends StatelessWidget {
  const ReadingCard({super.key, required this.reading});

  final SensorReading reading;

  @override
  Widget build(BuildContext context) {
    final ppm = reading.ppmProxy;
    final isHigh = ppm > 1000;
    final valueColor = isHigh ? CarbonFluxColors.red : CarbonFluxColors.green;

    return HudPanel(
      accentColor: valueColor,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('LIVE SENSOR READING', style: CarbonFluxText.label),
          if (isHigh) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: CarbonFluxColors.red.withValues(alpha: 0.12),
                border: Border.all(
                  color: CarbonFluxColors.red.withValues(alpha: 0.55),
                ),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                'VIOLATION - EXCEEDS 1000 PPM THRESHOLD',
                style: TextStyle(
                  color: CarbonFluxColors.red,
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.2,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
          const SizedBox(height: 12),
          _ppmGauge(ppm, valueColor),
          const SizedBox(height: 16),
          Wrap(
            runSpacing: 12,
            spacing: 18,
            children: [
              _metric('RAW ADC', reading.rawAdc.toString(), Colors.white),
              _metric('NONCE', reading.nonce.toString(),
                  CarbonFluxColors.textSecondary),
              _metric(
                'TIMESTAMP',
                DateFormat('HH:mm:ss').format(
                  DateTime.fromMillisecondsSinceEpoch(
                    reading.timestamp * 1000,
                    isUtc: true,
                  ).toLocal(),
                ),
                CarbonFluxColors.textSecondary,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _ppmGauge(double ppm, Color color) {
    final progress = (ppm / 1500).clamp(0.0, 1.0).toDouble();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                ppm.toStringAsFixed(1),
                style: TextStyle(
                  fontSize: 58,
                  height: 0.95,
                  fontWeight: FontWeight.w900,
                  color: color,
                  letterSpacing: 0.2,
                ),
              ),
              const SizedBox(width: 6),
              const Padding(
                padding: EdgeInsets.only(bottom: 7),
                child: Text(
                  'ppm',
                  style: TextStyle(
                    color: CarbonFluxColors.textMuted,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Stack(
          children: [
            Container(height: 4, color: CarbonFluxColors.bgCard),
            FractionallySizedBox(
              widthFactor: progress,
              child: Container(height: 4, color: color),
            ),
            const FractionallySizedBox(
              widthFactor: 0.666,
              child: Align(
                alignment: Alignment.centerRight,
                child: SizedBox(
                  height: 12,
                  child: VerticalDivider(
                    width: 1,
                    color: CarbonFluxColors.red,
                    thickness: 1,
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 5),
        const Align(
          alignment: Alignment.centerRight,
          child: Text(
            'THRESHOLD 1000',
            style: TextStyle(
              color: CarbonFluxColors.red,
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
            ),
          ),
        ),
      ],
    );
  }

  Widget _metric(String label, String value, Color color,
      {bool large = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: CarbonFluxText.label),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: large ? 30 : 18,
            fontWeight: FontWeight.w800,
            fontFamily: 'monospace',
            color: color,
          ),
        ),
      ],
    );
  }
}
