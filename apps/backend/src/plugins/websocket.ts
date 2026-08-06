import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import websocket from '@fastify/websocket';

const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(websocket);
};

export default fp(websocketPlugin, { name: 'websocket' });
