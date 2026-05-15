import QRCode from 'qrcode';
import { config } from '../config';

export async function generateQrPng(
  payload: string,
  width = 300,
): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: 'png',
    width,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/**
 * Resolves the URL the QR code should encode.
 *
 * Priority:
 *   1) PUBLIC_BASE_URL set → HTTP download endpoint on our webhook server
 *   2) BOT_USERNAME set    → Telegram deeplink that re-sends the file
 *   3) fallback            → bare deeplink with no username (still works
 *      if the bot has been opened recently)
 */
export function buildDownloadUrl(token: string): string {
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl}/download/${token}`;
  }
  if (config.botUsername) {
    return `https://t.me/${config.botUsername}?start=doc_${token}`;
  }
  return `https://t.me/?start=doc_${token}`;
}
