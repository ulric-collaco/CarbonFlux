import 'package:flutter/material.dart';

class LiveUploadBar extends StatelessWidget {
  const LiveUploadBar({
    super.key,
    required this.isUploading,
    required this.status,
  });

  final bool isUploading;
  final String? status;

  @override
  Widget build(BuildContext context) {
    if (!isUploading && status == null) {
      return const SizedBox.shrink();
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1A222F),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: status != null && status!.toLowerCase().contains('failed')
              ? const Color(0xFF8A1F28)
              : const Color(0xFF0B6B53),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0B6B53).withValues(alpha: 0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          if (isUploading &&
              (!status!.toLowerCase().contains('failed') &&
                  !status!.toLowerCase().contains('verified'))) ...[
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Color(0xFF0B6B53),
              ),
            ),
            const SizedBox(width: 12),
          ] else if (status != null && status!.toLowerCase().contains('failed')) ...[
            const Icon(Icons.error_outline,
                size: 20, color: Color(0xFF8A1F28)),
            const SizedBox(width: 12),
          ] else if (status != null && status!.toLowerCase().contains('verified')) ...[
            const Icon(Icons.check_circle_outline,
                size: 20, color: Color(0xFF0B6B53)),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Text(
              status ?? 'Processing...',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFFE2E8F0),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
