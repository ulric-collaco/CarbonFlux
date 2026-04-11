import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'providers/app_providers.dart';
import 'screens/connection_screen.dart';
import 'screens/dashboard_screen.dart';

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
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF090E16),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF32D9FF),
          secondary: Color(0xFF00D68F),
          surface: Color(0xFF111722),
          error: Color(0xFFFF5A5F),
        ),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF090E16),
          foregroundColor: Colors.white,
          elevation: 0,
          centerTitle: false,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF111722),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF1F2A3A)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF1F2A3A)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF32D9FF)),
          ),
        ),
      ),
      home: appState.isConnected
          ? const DashboardScreen()
          : const ConnectionScreen(),
    );
  }
}
