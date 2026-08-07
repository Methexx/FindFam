import * as messagesRepository from './messages.repository';
import * as circlesRepository from '../circles/circles.repository';
import { redisPubSub } from '../../realtime/redis-pubsub';
import { isUserConnected } from '../../realtime/ws-gateway';
import { sendPushToUser } from '../../lib/fcm';

export class MessagesError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

function toPublicMessage(row: messagesRepository.MessageRow) {
  return {
    id: row.id,
    circleId: row.circle_id,
    senderId: row.sender_id,
    content: row.content,
    sentAt: row.sent_at.toISOString(),
  };
}

async function requireMembership(userId: string, circleId: string) {
  const circle = await circlesRepository.findCircleById(circleId);
  if (!circle) {
    throw new MessagesError('Circle not found', 404);
  }
  const membership = await circlesRepository.findMembership(circleId, userId);
  if (!membership) {
    // Same non-disclosure behavior as circles.service — a non-member gets
    // the same "not found" a nonexistent circle would.
    throw new MessagesError('Circle not found', 404);
  }
  return { circle, membership };
}

function encodeCursor(sentAt: Date, id: string): string {
  return Buffer.from(`${sentAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { sentAt: Date; id: string } {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw new MessagesError('Invalid cursor', 400);
  }
  const [sentAtIso, id] = decoded.split('|');
  const sentAt = sentAtIso ? new Date(sentAtIso) : null;
  if (!sentAt || Number.isNaN(sentAt.getTime()) || !id) {
    throw new MessagesError('Invalid cursor', 400);
  }
  return { sentAt, id };
}

export async function sendMessage(userId: string, circleId: string, content: string) {
  await requireMembership(userId, circleId);

  const row = await messagesRepository.insertMessage({
    circleId,
    senderId: userId,
    content,
    sentAt: new Date(),
  });
  const message = toPublicMessage(row);

  await redisPubSub.publish(
    `circle:${circleId}:chat`,
    JSON.stringify({ type: 'message:broadcast', payload: message }),
  );

  // Offline-member fan-out: anyone in the circle with no open WS connection
  // gets an FCM push instead of silently missing the message — history
  // remains fetchable via GET /circles/:id/messages regardless.
  const members = await circlesRepository.listMembers(circleId);
  const offlineMembers = members.filter(
    (member) => member.user_id !== userId && !isUserConnected(member.user_id),
  );
  await Promise.all(
    offlineMembers.map((member) =>
      sendPushToUser(member.user_id, {
        title: 'New message',
        body: message.content,
        data: { type: 'chat', circleId },
      }),
    ),
  );

  return message;
}

export async function listMessages(
  userId: string,
  circleId: string,
  opts: { cursor?: string; limit: number },
) {
  await requireMembership(userId, circleId);

  const before = opts.cursor ? decodeCursor(opts.cursor) : undefined;
  const rows = await messagesRepository.listMessagesForCircle(circleId, {
    limit: opts.limit,
    before,
  });

  const messages = rows.map(toPublicMessage);
  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === opts.limit && last ? encodeCursor(last.sent_at, last.id) : null;

  return { messages, nextCursor };
}
