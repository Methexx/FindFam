import { db } from '../../config/db';

export interface MessageRow {
  id: string;
  circle_id: string;
  sender_id: string;
  content: string;
  sent_at: Date;
}

export function insertMessage(input: {
  circleId: string;
  senderId: string;
  content: string;
  sentAt: Date;
}): Promise<MessageRow> {
  return db
    .insertInto('messages')
    .values({
      circle_id: input.circleId,
      sender_id: input.senderId,
      content: input.content,
      sent_at: input.sentAt,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * Keyset pagination on (sent_at DESC, id DESC) — offset pagination would
 * skip/duplicate rows under the concurrent inserts a chat table sees.
 */
export function listMessagesForCircle(
  circleId: string,
  opts: { limit: number; before?: { sentAt: Date; id: string } },
): Promise<MessageRow[]> {
  let query = db.selectFrom('messages').selectAll().where('circle_id', '=', circleId);

  if (opts.before) {
    const { sentAt, id } = opts.before;
    query = query.where(({ eb, or, and }) =>
      or([
        eb('sent_at', '<', sentAt),
        and([eb('sent_at', '=', sentAt), eb('id', '<', id)]),
      ]),
    );
  }

  return query.orderBy('sent_at', 'desc').orderBy('id', 'desc').limit(opts.limit).execute();
}
