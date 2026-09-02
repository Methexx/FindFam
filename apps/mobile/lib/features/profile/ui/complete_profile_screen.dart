import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../shared/widgets/app_error_text.dart';
import '../../auth/domain/user.dart';
import '../viewmodel/profile_completion.dart';
import '../viewmodel/profile_notifier.dart';

/// Shown instead of the home shell until a new account has a display name
/// and a phone number.
///
/// Only those two block. A photo is offered but never required — uploads
/// 503 until Supabase Storage is configured. An emergency contact cannot be
/// required at all: the backend rejects any contact you do not already
/// mutually follow, and a fresh account follows nobody, so it is signposted
/// as a later step instead.
class CompleteProfileScreen extends ConsumerStatefulWidget {
  const CompleteProfileScreen({super.key, required this.user});

  final User user;

  @override
  ConsumerState<CompleteProfileScreen> createState() => _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends ConsumerState<CompleteProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _displayNameController;
  late final TextEditingController _phoneController;

  @override
  void initState() {
    super.initState();
    _displayNameController = TextEditingController(text: widget.user.displayName ?? '');
    _phoneController = TextEditingController(text: widget.user.phone ?? '');
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadAvatar() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1024);
    if (picked == null || !mounted) return;
    await ref.read(profileNotifierProvider.notifier).uploadAvatar(File(picked.path));
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    // A successful save refreshes the global auth user, which re-evaluates
    // the gate in app.dart — no navigation needed here.
    await ref.read(profileNotifierProvider.notifier).updateDetails(
          displayName: _displayNameController.text.trim(),
          phone: _phoneController.text.trim(),
        );
  }

  @override
  Widget build(BuildContext context) {
    final profileState = ref.watch(profileNotifierProvider);
    final user = ref.watch(authUserProvider) ?? widget.user;
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Finish setting up'),
        actions: [
          TextButton(
            onPressed: profileState.isUpdating
                ? null
                : () => ref.read(profileSetupSkippedProvider.notifier).state = true,
            child: const Text('Skip for now'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'A name and a phone number, so the people you share with know who they are '
            'looking at — and so an SOS has a number to fall back on.',
            style: TextStyle(color: colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 20),
          Center(
            child: GestureDetector(
              onTap: profileState.isUpdating ? null : _pickAndUploadAvatar,
              child: Stack(
                children: [
                  CircleAvatar(
                    radius: 40,
                    backgroundColor: colorScheme.primaryContainer,
                    backgroundImage: user.avatarUrl != null
                        ? CachedNetworkImageProvider(user.avatarUrl!)
                        : null,
                    child: user.avatarUrl == null
                        ? Icon(Icons.add_a_photo, color: colorScheme.onPrimaryContainer)
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
          const SizedBox(height: 4),
          Center(
            child: Text(
              'Photo — optional',
              style: TextStyle(fontSize: 12, color: colorScheme.onSurfaceVariant),
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
                      controller: _displayNameController,
                      decoration: const InputDecoration(labelText: 'Name'),
                      validator: (value) =>
                          (value == null || value.trim().isEmpty) ? 'Required' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Phone',
                        helperText: 'Used as the fallback contact number on an SOS',
                      ),
                      validator: (value) =>
                          (value == null || value.trim().isEmpty) ? 'Required' : null,
                    ),
                    const SizedBox(height: 16),
                    if (profileState.error != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: AppErrorText(profileState.error!),
                      ),
                    FilledButton(
                      onPressed: profileState.isUpdating ? null : _save,
                      child: profileState.isUpdating
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Save and continue'),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              leading: const Icon(Icons.shield_outlined),
              title: const Text('Emergency contacts'),
              subtitle: const Text(
                'Comes after you have added people — a contact has to be someone you '
                'already follow each other with.',
              ),
            ),
          ),
        ],
      ),
    );
  }
}
