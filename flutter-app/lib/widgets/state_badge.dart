import 'package:flutter/material.dart';

Color stateColor(String state) {
  switch (state) {
    case 'READY':
      return Colors.greenAccent.shade400;
    case 'WARMUP':
      return Colors.amberAccent.shade400;
    case 'DETECTING':
      return Colors.redAccent.shade200;
    case 'STOPPED':
      return Colors.orangeAccent.shade200;
    default:
      return Colors.blueGrey.shade300;
  }
}

class StateBadge extends StatelessWidget {
  const StateBadge({super.key, required this.state});

  final String state;

  @override
  Widget build(BuildContext context) {
    final color = stateColor(state);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(20),
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
            state,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }
}
