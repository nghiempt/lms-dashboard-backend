import * as crypto from 'crypto';

/** Tạo slug từ chuỗi tiếng Việt. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** SHA-256 hex (dùng băm token để lưu DB). */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Sinh token ngẫu nhiên (URL-safe). */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Sinh mã đơn hàng/hoá đơn: PREFIX-XXXXXX. */
export function generateCode(prefix: string): string {
  const n = crypto.randomInt(100000, 999999);
  return `${prefix}-${n}`;
}

/** Cộng số giây vào thời điểm hiện tại. */
export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

/** Cộng số ngày. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
