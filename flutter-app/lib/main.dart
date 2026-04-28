import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'providers/app_providers.dart';
import 'screens/connection_screen.dart';
import 'screens/dashboard_screen.dart';
import 'theme/carbonflux_theme.dart';

void main() {
  runApp(const ProviderScope(child: CarbonFluxApp()));
}

class CarbonFluxApp extends ConsumerWidget {
  const CarbonFluxApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appState = ref.watch(carbonfluxControllerProvider);

    return MaterialApp(
      title: 'CarbonFlux',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: CarbonFluxTheme.dark(),
      home: appState.isConnected
          ? const DashboardScreen()
          : const ConnectionScreen(),
    );
  }
}
