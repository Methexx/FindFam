import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword } from '../../../src/lib/password';

vi.mock('../../../src/modules/auth/auth.repository', () => ({
  findUserByUsernameOrEmail: vi.fn(),
  findUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  createRefreshToken: vi.fn(),
  findRefreshTokenByHash: vi.fn(),
  deleteRefreshTokenByHash: vi.fn(),
}));

import * as authRepository from '../../../src/modules/auth/auth.repository';
import * as authService from '../../../src/modules/auth/auth.service';
import { AuthError } from '../../../src/modules/auth/auth.service';

const mockUserRow = async (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  phone: null,
  password_hash: await hashPassword('correct-password'),
  avatar_url: null,
  is_sharing: true,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: null,
  ...overrides,
});

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('rejects a duplicate username', async () => {
      vi.mocked(authRepository.findUserByUsernameOrEmail).mockResolvedValueOnce(
        await mockUserRow(),
      );

      await expect(
        authService.register({
          username: 'alice',
          email: 'new@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(AuthError);
    });

    it('creates a user and issues a token pair on success', async () => {
      vi.mocked(authRepository.findUserByUsernameOrEmail).mockResolvedValue(undefined);
      vi.mocked(authRepository.createUser).mockResolvedValue(await mockUserRow());
      vi.mocked(authRepository.createRefreshToken).mockResolvedValue(undefined as never);

      const result = await authService.register({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(result.user.username).toBe('alice');
      expect(result.tokens.accessToken).toEqual(expect.any(String));
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
      expect(authRepository.createRefreshToken).toHaveBeenCalledOnce();
    });
  });

  describe('login', () => {
    it('rejects an unknown identifier', async () => {
      vi.mocked(authRepository.findUserByUsernameOrEmail).mockResolvedValueOnce(undefined);

      await expect(
        authService.login({ usernameOrEmail: 'ghost', password: 'whatever' }),
      ).rejects.toThrow(AuthError);
    });

    it('rejects the wrong password', async () => {
      vi.mocked(authRepository.findUserByUsernameOrEmail).mockResolvedValueOnce(
        await mockUserRow(),
      );

      await expect(
        authService.login({ usernameOrEmail: 'alice', password: 'wrong-password' }),
      ).rejects.toThrow(AuthError);
    });

    it('issues a token pair for correct credentials', async () => {
      vi.mocked(authRepository.findUserByUsernameOrEmail).mockResolvedValueOnce(
        await mockUserRow(),
      );
      vi.mocked(authRepository.createRefreshToken).mockResolvedValue(undefined as never);

      const result = await authService.login({
        usernameOrEmail: 'alice',
        password: 'correct-password',
      });

      expect(result.tokens.accessToken).toEqual(expect.any(String));
    });
  });

  describe('refresh', () => {
    it('rejects an unknown refresh token', async () => {
      vi.mocked(authRepository.findRefreshTokenByHash).mockResolvedValueOnce(undefined);

      await expect(authService.refresh('bogus-token')).rejects.toThrow(AuthError);
    });

    it('rejects an expired refresh token', async () => {
      vi.mocked(authRepository.findRefreshTokenByHash).mockResolvedValueOnce({
        id: 'rt-1',
        user_id: 'user-1',
        token_hash: 'hash',
        expires_at: new Date(Date.now() - 1000),
        created_at: new Date(),
      });

      await expect(authService.refresh('expired-token')).rejects.toThrow(AuthError);
    });

    it('issues a new access token for a valid refresh token', async () => {
      vi.mocked(authRepository.findRefreshTokenByHash).mockResolvedValueOnce({
        id: 'rt-1',
        user_id: 'user-1',
        token_hash: 'hash',
        expires_at: new Date(Date.now() + 1000 * 60 * 60),
        created_at: new Date(),
      });
      vi.mocked(authRepository.findUserById).mockResolvedValueOnce(await mockUserRow());

      const result = await authService.refresh('valid-token');
      expect(result.accessToken).toEqual(expect.any(String));
    });
  });

  describe('logout', () => {
    it('deletes the refresh token record', async () => {
      vi.mocked(authRepository.deleteRefreshTokenByHash).mockResolvedValue(undefined as never);

      await authService.logout('some-token');

      expect(authRepository.deleteRefreshTokenByHash).toHaveBeenCalledOnce();
    });
  });
});
