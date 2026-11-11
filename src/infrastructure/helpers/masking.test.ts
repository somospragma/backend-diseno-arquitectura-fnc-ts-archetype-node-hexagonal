import { maskEmail, maskAccount } from './masking.js';

describe('masking (DSC-O-003)', () => {
  it('maskEmail conserva el dominio y oculta el local part', () => {
    expect(maskEmail('jane.doe@pragma.com')).toBe('****@pragma.com');
  });

  it('maskEmail devuelve **** ante valores sin @ valido', () => {
    expect(maskEmail('sin-arroba')).toBe('****');
    expect(maskEmail('@nolocal.com')).toBe('****');
  });

  it('maskAccount enmascara el email del objeto sin mutar el resto', () => {
    const masked = maskAccount({ id: 'acc-1', email: 'a@b.com' });
    expect(masked.email).toBe('****@b.com');
    expect(masked.id).toBe('acc-1');
  });

  it('maskAccount deja el objeto intacto si no hay email', () => {
    const obj: { id: string; email?: string } = { id: 'acc-2' };
    expect(maskAccount(obj)).toBe(obj);
  });
});
