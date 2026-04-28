import 'package:flutter/material.dart';

import '../theme/carbonflux_theme.dart';

Color stateColor(String state) {
  switch (state) {
    case 'READY':
      return CarbonFluxColors.blue;
    case 'WARMUP':
      return CarbonFluxColors.yellow;
    case 'DETECTING':
      return CarbonFluxColors.green;
    case 'STOPPED':
      return CarbonFluxColors.orange;
    default:
      return CarbonFluxColors.textMuted;
  }
}

class StateBadge extends StatelessWidget {
  const StateBadge({super.key, required this.state});

  final String state;

  @override
  Widget build(BuildContext context) {
    final color = stateColor(state);
    final label = state == 'WARMUP' ? 'WARMING UP' : state;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.7)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              fontSize: 11,
              letterSpacing: 1.1,
            ),
          ),
        ],
      ),
    );
  }
}
