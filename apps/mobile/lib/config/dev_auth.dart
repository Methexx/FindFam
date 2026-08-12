/// Credentials for the debug-only "skip auth" button on the login screen.
///
/// Overridable per device via --dart-define, so two developers (or a phone
/// and an emulator pointed at the same backend) don't fight over one
/// account — useful when testing anything that needs two users, like a
/// follow request or an SOS to an emergency contact.
class DevAuth {
  DevAuth._();

  static const username = String.fromEnvironment(
    'DEV_USERNAME',
    defaultValue: 'devuser',
  );

  static const password = String.fromEnvironment(
    'DEV_PASSWORD',
    // Backend requires min 8 characters (registerBodySchema).
    defaultValue: 'devpassword123',
  );

  static const email = String.fromEnvironment(
    'DEV_EMAIL',
    defaultValue: 'devuser@findfam.local',
  );
}
