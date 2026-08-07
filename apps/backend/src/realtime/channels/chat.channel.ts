import { z } from 'zod';
import * as messagesService from '../../modules/messages/messages.service';
import { MessagesError } from '../../modules/messages/messages.service';

const messageSendSchema = z.object({
  type: z.literal('message:send'),
  payload: z.object({
    circleId: z.string().uuid(),
    content: z.string().min(1).max(2000),
  }),
});

export interface ChatChannelResult {
  ok: boolean;
  error?: string;
}

/**
 * Handles a parsed `message:send` WS message for one authenticated
 * connection. Delegates to messagesService.sendMessage — the same function
 * the REST route calls — so validation, broadcast, and offline-push
 * behavior can't diverge between the two paths.
 */
export async function handleMessageSend(
  userId: string,
  rawMessage: unknown,
): Promise<ChatChannelResult> {
  const parsed = messageSendSchema.safeParse(rawMessage);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid message:send payload' };
  }

  try {
    await messagesService.sendMessage(userId, parsed.data.payload.circleId, parsed.data.payload.content);
    return { ok: true };
  } catch (err) {
    if (err instanceof MessagesError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}
