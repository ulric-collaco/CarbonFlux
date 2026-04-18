import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../models/sensor_reading.dart';

class PpmLineChart extends StatelessWidget {
  const PpmLineChart({super.key, required this.readings});

  final List<SensorReading> readings;

  @override
  Widget build(BuildContext context) {
    if (readings.isEmpty) {
      return const Center(
        child: Text(
          'No readings yet. Start detection to see live graph.',
          style: TextStyle(color: Color(0xFF90A0B9)),
        ),
      );
    }

    final spots = <FlSpot>[];
    for (var i = 0; i < readings.length; i++) {
      spots.add(FlSpot(i.toDouble(), readings[i].ppmProxy));
    }

    const visibleCount = 40;
    final maxX = (spots.length - 1).toDouble();
    final minX = (spots.length > visibleCount)
        ? (spots.length - visibleCount).toDouble()
        : 0.0;

    return LineChart(
      LineChartData(
        minX: minX,
        maxX: maxX,
        minY: 0,
        maxY: _maxY(readings),
        clipData: const FlClipData.all(),
        lineTouchData: const LineTouchData(enabled: true),
        gridData: FlGridData(
          show: true,
          drawVerticalLine: true,
          horizontalInterval: 250,
          getDrawingHorizontalLine: (_) => const FlLine(
            color: Color(0xFF1E2A3B),
            strokeWidth: 1,
          ),
          getDrawingVerticalLine: (_) => const FlLine(
            color: Color(0xFF131D2C),
            strokeWidth: 1,
          ),
        ),
        titlesData: FlTitlesData(
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 48,
              interval: 250,
              getTitlesWidget: (value, _) => Text(
                value.toInt().toString(),
                style: const TextStyle(fontSize: 11, color: Color(0xFF8BA0BC)),
              ),
            ),
          ),
          bottomTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
        ),
        borderData: FlBorderData(
          show: true,
          border: Border.all(color: const Color(0xFF223046)),
        ),
        extraLinesData: ExtraLinesData(horizontalLines: [
          HorizontalLine(
            y: 1000,
            color: Colors.redAccent.withValues(alpha: 0.5),
            strokeWidth: 1.3,
            dashArray: [6, 4],
            label: HorizontalLineLabel(
              show: true,
              alignment: Alignment.topRight,
              style: const TextStyle(color: Colors.redAccent, fontSize: 10),
              labelResolver: (_) => 'threshold',
            ),
          ),
        ]),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            color: const Color(0xFF32D9FF),
            barWidth: 2.2,
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  const Color(0xFF32D9FF).withValues(alpha: 0.35),
                  const Color(0xFF32D9FF).withValues(alpha: 0.05),
                ],
              ),
            ),
            dotData: FlDotData(
              show: true,
              checkToShowDot: (spot, _) => spot.y > 1000,
              getDotPainter: (spot, _, __, ___) => FlDotCirclePainter(
                radius: 3,
                color: Colors.redAccent,
                strokeWidth: 1,
                strokeColor: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  double _maxY(List<SensorReading> values) {
    final peak = values.fold<double>(
      1000,
      (prev, e) => e.ppmProxy > prev ? e.ppmProxy : prev,
    );
    return (peak + 200).clamp(1200.0, double.infinity);
  }
}
