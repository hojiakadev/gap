import { useTranslation } from 'react-i18next';
import { useRef, useState, type FocusEvent } from 'react';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import ShareRounded from '@mui/icons-material/ShareRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import { QRCodeCanvas } from 'qrcode.react';
import { displayCode } from '../../../shared/protocol';
import { copyText } from '../../lib/format';
import { invitationUrl, inviteOrigins, isLoopbackHost, isPrivateIpv4 } from '../../lib/invitations';

interface Props {
  code: string;
  expiresAt: number;
  now: number;
  notify: (message: string) => void;
}
export function InviteCard({ code, expiresAt, now, notify }: Props) {
  const { t } = useTranslation();
  const qr = useRef<HTMLCanvasElement>(null);
  const shareInvite = async () => {
    if (!url) return;
    try {
      if (navigator.share)
        await navigator.share({ title: 'Gap', text: t('Join my Gap tunnel'), url });
      else copy(url);
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) copy(url);
    }
  };
  const shareQr = async (downloadOnly = false) => {
    try {
      const canvas = qr.current;
      if (!canvas) return;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error();
      const file = new File([blob], `gap-${code}.png`, { type: 'image/png' });
      if (!downloadOnly && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Gap', text: t('Join my Gap tunnel') });
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = file.name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError'))
        notify(t('Could not share the QR code. Try copying the invite link.'));
    }
  };

  const origins = inviteOrigins(
    window.location.origin,
    import.meta.env.DEV ? __GAP_LAN_HOSTS__ : [],
  );
  const [selectedOrigin, setSelectedOrigin] = useState(origins.length === 1 ? origins[0] : '');
  const local = isLoopbackHost(window.location.hostname) || isPrivateIpv4(window.location.hostname);
  const url = selectedOrigin ? invitationUrl(code, selectedOrigin) : '';
  const copy = (value: string) => {
    void copyText(value)
      .then(() => notify(t('Copied. Pass it on!')))
      .catch((error) => notify(error.message));
  };
  return (
    <div className="invite-card">
      <h2 className="aside-title">{t('Invite teammates')}</h2>
      {local && (
        <details className="network-help">
          <summary>{t('Connecting from a phone?')}</summary>
          <Alert severity="info" icon={false} sx={{ mt: 2, fontSize: 11, lineHeight: 1.7 }}>
            {origins.length
              ? t(
                  'For this link to open, your phone and computer must be on the same Wi-Fi. Keep Gap running on your computer. Mobile data won’t reach this local server.',
                )
              : t(
                  'This address only opens on this computer. Open the Network URL printed by npm run dev to invite your phone. Both devices must be on the same Wi-Fi.',
                )}
          </Alert>
        </details>
      )}
      {origins.length > 1 && (
        <TextField
          select
          label={t('Computer’s Wi-Fi address')}
          value={selectedOrigin}
          onChange={(event) => setSelectedOrigin(event.target.value)}
          fullWidth
          size="small"
          sx={{ mt: 2 }}
          helperText={t('Choose the address for the network your phone uses.')}
        >
          {origins.map((origin) => (
            <MenuItem key={origin} value={origin}>
              {origin}
            </MenuItem>
          ))}
        </TextField>
      )}
      <div className="invite-code" aria-label={t('Tunnel code')}>
        {displayCode(code)}
      </div>
      {url && (
        <>
          <div className="qr-wrap">
            <QRCodeCanvas
              ref={qr}
              value={url}
              size={256}
              fgColor="#087f72"
              marginSize={4}
              level="M"
              aria-label={t('Scan to join this Gap tunnel')}
            />
          </div>
          <TextField
            value={url}
            label={t('Invite link')}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            slotProps={{
              input: { readOnly: true },
              htmlInput: {
                onFocus: (event: FocusEvent<HTMLInputElement>) => event.currentTarget.select(),
                style: { fontSize: 11 },
              },
            }}
          />
        </>
      )}
      <div className="invite-share-actions">
        <Button
          variant="contained"
          disabled={!url}
          startIcon={<ShareRounded />}
          onClick={() => void shareInvite()}
        >
          {t('Share invite')}
        </Button>
        <Button
          variant="outlined"
          disabled={!url}
          startIcon={<DownloadRounded />}
          onClick={() => void shareQr()}
        >
          {t('Share QR code')}
        </Button>
        <Button size="small" disabled={!url} onClick={() => void shareQr(true)}>
          {t('Download QR code')}
        </Button>
      </div>
      <Button
        variant="contained"
        fullWidth
        size="small"
        disabled={!url}
        startIcon={<ContentCopyRounded sx={{ fontSize: 13 }} />}
        sx={{ fontSize: 12, py: 1 }}
        onClick={() => copy(url)}
      >
        {t('Copy invite link')}
      </Button>
      <Button
        fullWidth
        size="small"
        sx={{ fontSize: 12, py: 1 }}
        onClick={() => copy(displayCode(code))}
      >
        {t('Copy code instead')}
      </Button>
      <p className="aside-copy" style={{ fontSize: 11 }}>
        {t('Share with people you trust. Anyone with the link can join.')}
      </p>
      <p className="room-expiry">
        {t('expiresIn', { count: Math.max(0, Math.ceil((expiresAt - now) / 60_000)) })}
      </p>
    </div>
  );
}
