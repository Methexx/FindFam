import { Redis } from 'ioredis';
import { env } from '../config/env';

type ChannelHandler = (message: string) => void;

/**
 * Thin Pub/Sub wrapper. All broadcast fan-out goes through here rather than
 * in-process delivery — required even at single-instance scale so that
 * scaling to multiple backend instances later needs no changes to callers
 * (see docs/05-realtime-channels.md).
 *
 * ioredis requires a connection used for SUBSCRIBE to not issue other
 * commands, so publishing and subscribing use separate connections.
 */
class RedisPubSub {
  private readonly publisher = new Redis(env.REDIS_URL);
  private readonly subscriber = new Redis(env.REDIS_URL);
  private readonly handlers = new Map<string, Set<ChannelHandler>>();

  constructor() {
    this.subscriber.on('message', (channel: string, message: string) => {
      const channelHandlers = this.handlers.get(channel);
      if (!channelHandlers) return;
      for (const handler of channelHandlers) handler(message);
    });
  }

  publish(channel: string, message: string): Promise<number> {
    return this.publisher.publish(channel, message);
  }

  async subscribe(channel: string, handler: ChannelHandler): Promise<void> {
    let channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) {
      channelHandlers = new Set();
      this.handlers.set(channel, channelHandlers);
      await this.subscriber.subscribe(channel);
    }
    channelHandlers.add(handler);
  }

  async unsubscribe(channel: string, handler: ChannelHandler): Promise<void> {
    const channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) return;
    channelHandlers.delete(handler);
    if (channelHandlers.size === 0) {
      this.handlers.delete(channel);
      await this.subscriber.unsubscribe(channel);
    }
  }

  async close(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}

export const redisPubSub = new RedisPubSub();
