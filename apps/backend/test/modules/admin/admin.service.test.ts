import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword } from '../../../src/lib/password';

vi.mock('../../../src/modules/admin/admin.repository', () => ({
  findAdminByEmail: vi.fn(),
}));

import * as adminRepository from '../../../src/modules/admin/admin.repository';
import * as adminService from '../../../src/modules/admin/admin.service';
import { AdminAuthError } from '../../../src/modules/admin/admin.service';

describe('admin.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an unknown admin email', async () => {
    vi.mocked(adminRepository.findAdminByEmail).mockResolvedValueOnce(undefined);

    await expect(
      adminService.login({ email: 'ghost@example.com', password: 'whatever' }),
    ).rejects.toThrow(AdminAuthError);
  });

  it('rejects the wrong password', async () => {
    vi.mocked(adminRepository.findAdminByEmail).mockResolvedValueOnce({
      id: 'admin-1',
      email: 'admin@example.com',
      password_hash: await hashPassword('correct-password'),
      created_at: new Date(),
    });

    await expect(
      adminService.login({ email: 'admin@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(AdminAuthError);
  });

  it('issues an access token for correct credentials', async () => {
    vi.mocked(adminRepository.findAdminByEmail).mockResolvedValueOnce({
      id: 'admin-1',
      email: 'admin@example.com',
      password_hash: await hashPassword('correct-password'),
      created_at: new Date(),
    });

    const result = await adminService.login({
      email: 'admin@example.com',
      password: 'correct-password',
    });

    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(result.admin.email).toBe('admin@example.com');
  });
});
