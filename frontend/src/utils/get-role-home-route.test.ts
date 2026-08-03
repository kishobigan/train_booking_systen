import { describe, expect, it } from 'vitest';
import { getRoleHomeRoute, safeReturnTo } from './get-role-home-route';
describe('role routing', () => {
  it.each(['SUPER_ADMIN', 'ADMIN', 'STAFF'])('routes %s into management', (role) =>
    expect(getRoleHomeRoute({ role })).toBe('/management/dashboard'),
  );
  it('allows only internal return paths', () => {
    expect(safeReturnTo('//evil.example')).toBeNull();
    expect(safeReturnTo('/journeys')).toBeNull();
    expect(safeReturnTo('/management/journeys')).toBe('/management/journeys');
  });
});
