import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../viewmodel/emergency_contacts_notifier.dart';

class EmergencyContactsScreen extends ConsumerStatefulWidget {
  const EmergencyContactsScreen({super.key});

  @override
  ConsumerState<EmergencyContactsScreen> createState() => _EmergencyContactsScreenState();
}

class _EmergencyContactsScreenState extends ConsumerState<EmergencyContactsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(emergencyContactsNotifierProvider.notifier).load());
  }

  Future<void> _showAddDialog() async {
    final controller = TextEditingController();
    final username = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add emergency contact'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Username',
            helperText: 'Must be an existing FindFam user you follow each other with',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text('Add'),
          ),
        ],
      ),
    );

    if (username != null && username.isNotEmpty) {
      await ref.read(emergencyContactsNotifierProvider.notifier).addContact(username);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(emergencyContactsNotifierProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Emergency Contacts')),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddDialog,
        child: const Icon(Icons.person_add_alt),
      ),
      body: switch (state) {
        EmergencyContactsInitial() ||
        EmergencyContactsLoading() =>
          const Center(child: CircularProgressIndicator()),
        EmergencyContactsError(:final message) => Center(child: Text(message)),
        EmergencyContactsLoaded(contacts: final contacts, actionError: final actionError) =>
          Column(
            children: [
              if (actionError != null)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(actionError, style: const TextStyle(color: Colors.red)),
                ),
              if (contacts.isEmpty)
                const Expanded(
                  child: Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'No emergency contacts yet — add someone you follow each other with',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                )
              else
                Expanded(
                  child: ListView.builder(
                    itemCount: contacts.length,
                    itemBuilder: (context, index) {
                      final contact = contacts[index];
                      return ListTile(
                        leading: CircleAvatar(child: Text('${contact.priority}')),
                        title: Text(contact.username),
                        subtitle: contact.phone != null ? Text(contact.phone!) : null,
                        trailing: IconButton(
                          icon: const Icon(Icons.remove_circle_outline),
                          onPressed: () => ref
                              .read(emergencyContactsNotifierProvider.notifier)
                              .removeContact(contact.id),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
      },
    );
  }
}
