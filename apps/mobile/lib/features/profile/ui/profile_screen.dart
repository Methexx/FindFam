import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../shared/widgets/app_error_text.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../../emergency_contacts/ui/emergency_contacts_screen.dart';
import '../../map/viewmodel/location_sharing_notifier.dart';
import '../../settings/ui/privacy_policy_screen.dart';
import '../viewmodel/profile_notifier.dart';
import 'change_password_screen.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _usernameController;
  late final TextEditingController _displayNameController;
  late final TextEditingController _phoneController;

  @override
  void initState() {
    super.initState();
    // Reachable only from the already-authenticated home shell (the header
    // person icon), so authNotifierProvider is guaranteed AuthAuthenticated
    // by the time this screen mounts — no loading/placeholder state needed.
    final authState = ref.read(authNotifierProvider);
    final user = authState is AuthAuthenticated ? authState.user : null;
    _usernameController = TextEditingController(text: user?.username ?? '');
    _displayNameController = TextEditingController(text: user?.displayName ?? '');
    _phoneController = TextEditingController(text: user?.phone ?? '');
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _displayNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadAvatar() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1024);
    if (picked == null || !mounted) return;
    await ref.read(profileNotifierProvider.notifier).uploadAvatar(File(picked.path));
  }

  Future<void> _saveDetails() async {
    if (!_formKey.currentState!.validate()) return;
    final displayName = _displayNameController.text.trim();
    await ref.read(profileNotifierProvider.notifier).updateDetails(
          username: _usernameController.text.trim(),
          displayName: displayName.isEmpty ? '' : displayName,
          phone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
        );
  }

  Future<void> _confirmDeactivate() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Deactivate your account?'),
        content: const Text(
          "You'll be signed out everywhere immediately and won't be able to log back in "
          'until an admin reactivates it. This cannot be undone from here.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Deactivate'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final ok = await ref.read(profileNotifierProvider.notifier).deactivateAccount();
    if (ok) {
      await ref.read(authNotifierProvider.notifier).logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final user = authState is AuthAuthenticated ? authState.user : null;
    final sharingState = ref.watch(locationSharingNotifierProvider);
    final profileState = ref.watch(profileNotifierProvider);
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: user == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Center(
                  child: GestureDetector(
                    onTap: _pickAndUploadAvatar,
                    child: Stack(
                      children: [
                        CircleAvatar(
                          radius: 40,
                          backgroundColor: colorScheme.primaryContainer,
                          backgroundImage: user.avatarUrl != null
                              ? CachedNetworkImageProvider(user.avatarUrl!)
                              : null,
                          child: user.avatarUrl == null
                              ? Text(
                                  user.name.substring(0, 1).toUpperCase(),
                                  style: TextStyle(
                                    color: colorScheme.onPrimaryContainer,
                                    fontSize: 28,
                                  ),
                                )
                              : null,
                        ),
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: CircleAvatar(
                            radius: 14,
                            backgroundColor: colorScheme.primary,
                            child: Icon(Icons.edit, size: 16, color: colorScheme.onPrimary),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          TextFormField(
                            controller: _usernameController,
                            decoration: const InputDecoration(labelText: 'Username'),
                            validator: (value) => (value == null || value.trim().length < 3)
                                ? 'At least 3 characters'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _displayNameController,
                            decoration: const InputDecoration(
                              labelText: 'Name',
                              helperText: "Shown instead of your username where there's room",
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _phoneController,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(labelText: 'Phone'),
                          ),
                          const SizedBox(height: 16),
                          if (profileState.error != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: AppErrorText(profileState.error!),
                            ),
                          FilledButton(
                            onPressed: profileState.isUpdating ? null : _saveDetails,
                            child: profileState.isUpdating
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const Text('Save changes'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: SwitchListTile(
                    title: const Text('Share my location'),
                    subtitle: const Text(
                      'When off, circle members and emergency contacts cannot see your location',
                    ),
                    value: sharingState == LocationSharingState.on,
                    onChanged: profileState.isUpdating
                        ? null
                        : (value) => ref.read(profileNotifierProvider.notifier).setSharing(value),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Column(
                    children: [
                      ListTile(
                        title: const Text('Change password'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const ChangePasswordScreen()),
                        ),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        title: const Text('Emergency contacts'),
                        subtitle: const Text('Who gets notified when you trigger an SOS'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const EmergencyContactsScreen()),
                        ),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        title: const Text('Privacy Policy'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const PrivacyPolicyScreen()),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: ListTile(
                    leading: Icon(Icons.warning_amber, color: colorScheme.error),
                    title: Text('Deactivate account', style: TextStyle(color: colorScheme.error)),
                    onTap: profileState.isUpdating ? null : _confirmDeactivate,
                  ),
                ),
              ],
            ),
    );
  }
}
