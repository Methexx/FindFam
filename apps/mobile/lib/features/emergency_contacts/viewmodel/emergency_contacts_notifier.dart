import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../data/emergency_contacts_repository.dart';
import '../domain/emergency_contact.dart';

sealed class EmergencyContactsState {
  const EmergencyContactsState();
}

class EmergencyContactsInitial extends EmergencyContactsState {
  const EmergencyContactsInitial();
}

class EmergencyContactsLoading extends EmergencyContactsState {
  const EmergencyContactsLoading();
}

class EmergencyContactsLoaded extends EmergencyContactsState {
  const EmergencyContactsLoaded(this.contacts, {this.actionError});
  final List<EmergencyContact> contacts;
  final String? actionError;
}

class EmergencyContactsError extends EmergencyContactsState {
  const EmergencyContactsError(this.message);
  final String message;
}

final emergencyContactsRepositoryProvider = Provider<EmergencyContactsRepository>((ref) {
  return EmergencyContactsRepository(apiClient: ref.read(apiClientProvider));
});

final emergencyContactsNotifierProvider =
    StateNotifierProvider<EmergencyContactsNotifier, EmergencyContactsState>((ref) {
  return EmergencyContactsNotifier(ref.read(emergencyContactsRepositoryProvider));
});

class EmergencyContactsNotifier extends StateNotifier<EmergencyContactsState> {
  EmergencyContactsNotifier(this._repository) : super(const EmergencyContactsInitial());

  final EmergencyContactsRepository _repository;

  Future<void> load() async {
    state = const EmergencyContactsLoading();
    try {
      final contacts = await _repository.listContacts();
      state = EmergencyContactsLoaded(contacts);
    } catch (e) {
      state = EmergencyContactsError(e.toString());
    }
  }

  Future<bool> addContact(String username, {String? phone}) async {
    try {
      await _repository.addContact(username, phone: phone);
      await load();
      return true;
    } catch (e) {
      final current = state;
      if (current is EmergencyContactsLoaded) {
        state = EmergencyContactsLoaded(current.contacts, actionError: e.toString());
      }
      return false;
    }
  }

  Future<bool> removeContact(String id) async {
    try {
      await _repository.removeContact(id);
      await load();
      return true;
    } catch (e) {
      final current = state;
      if (current is EmergencyContactsLoaded) {
        state = EmergencyContactsLoaded(current.contacts, actionError: e.toString());
      }
      return false;
    }
  }
}
