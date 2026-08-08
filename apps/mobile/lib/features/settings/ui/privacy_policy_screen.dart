import 'package:flutter/material.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Privacy Policy')),
      body: const SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Section(
              title: 'What we collect',
              body:
                  'Your location (only while sharing is on), account details, '
                  'circle/contact data, chat messages, and SOS event history. '
                  'Battery level and speed are shown to your circle members so '
                  'they know your device state — not used for anything else.',
            ),
            _Section(
              title: 'Who can see your data',
              body:
                  'Only members of circles you\'ve joined and your emergency '
                  'contacts can see your live location. Chat messages are '
                  'visible only within the circle they were sent in.',
            ),
            _Section(
              title: 'What we don\'t do',
              body:
                  'We do not sell your location data or any other user data. '
                  'There is no third-party analytics or advertising SDK in '
                  'this app.',
            ),
            _Section(
              title: 'Safety disclaimer',
              body:
                  'SOS is a way to alert people you trust. It is not a '
                  'substitute for calling emergency services.',
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(body),
        ],
      ),
    );
  }
}
