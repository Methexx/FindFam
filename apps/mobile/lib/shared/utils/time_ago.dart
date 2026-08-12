/// Short relative-time labels ("2m ago", "1h ago") for anything timestamped
/// server-side — currently the map marker/list and its detail sheet, kept
/// here rather than inlined so a future feature (chat, SOS history) can
/// reuse the same wording instead of drifting.
String timeAgo(DateTime from, {DateTime? now}) {
  final reference = now ?? DateTime.now();
  final diff = reference.difference(from);

  if (diff.inSeconds < 5) return 'just now';
  if (diff.inMinutes < 1) return '${diff.inSeconds}s ago';
  if (diff.inHours < 1) return '${diff.inMinutes}m ago';
  if (diff.inDays < 1) return '${diff.inHours}h ago';
  return '${diff.inDays}d ago';
}
