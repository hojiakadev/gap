import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Button, InputAdornment, TextField } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import PeopleOutlineRounded from '@mui/icons-material/PeopleOutlineRounded';
import GroupOutlined from '@mui/icons-material/GroupOutlined';
import LinkRounded from '@mui/icons-material/LinkRounded';
import { TunnelArt } from '../../components/TunnelArt';
import { extractCode } from '../../lib/format';
import { normalizeCode, type RoomMode } from '../../../shared/protocol';
interface Props {
  initialCode: string;
  busy: boolean;
  connected: boolean;
  onCreate: (mode: RoomMode) => void;
  onJoin: (code: string) => void;
}
export function Landing({ initialCode, busy, connected, onCreate, onJoin }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<RoomMode>('team');
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState(false);
  const join = () => {
    const value = normalizeCode(extractCode(code));
    if (!/^[a-f0-9]{12}$/.test(value)) {
      setError(true);
      return;
    }
    setError(false);
    onJoin(value);
  };
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>
            {t('Good things')}
            <br />
            {t('travel')} <span>{t('fast.')}</span>
          </h1>
          <p className="hero-description">{t('Messages, links, and files. No accounts.')}</p>
        </div>
        <TunnelArt />
      </section>
      <section className="connection-grid" aria-label={t('Connect with your teammates')}>
        <article className="action-card">
          <div className="card-heading">
            <span className="card-icon">
              <AddRounded />
            </span>
            <h2>{t('Create a tunnel')}</h2>
          </div>
          <p className="card-copy">{t('Invite your teammates with a link or QR code.')}</p>
          <div className="mode-picker" role="group" aria-label={t('Tunnel type')}>
            <button
              className={`mode-option ${mode === 'pair' ? 'selected' : ''}`}
              aria-pressed={mode === 'pair'}
              onClick={() => setMode('pair')}
            >
              <PeopleOutlineRounded />
              <span>
                {t('Just us two')}
                <small>{t('2 people')}</small>
              </span>
              <i className="radio-dot" />
            </button>
            <button
              className={`mode-option ${mode === 'team' ? 'selected' : ''}`}
              aria-pressed={mode === 'team'}
              onClick={() => setMode('team')}
            >
              <GroupOutlined />
              <span>
                {t('The whole team')}
                <small>{t('Up to 12 people')}</small>
              </span>
              <i className="radio-dot" />
            </button>
          </div>
          <Button
            className="create-button"
            disabled={busy || !connected}
            endIcon={busy ? <span className="spinner" /> : <ArrowForwardRounded fontSize="small" />}
            onClick={() => onCreate(mode)}
          >
            {t('Create a tunnel')}
          </Button>
        </article>
        <article className="action-card">
          <div className="card-heading">
            <span className="card-icon">
              <LinkRounded />
            </span>
            <h2>{t('Join a tunnel')}</h2>
          </div>
          <p className="card-copy">{t('Paste a code or invite link.')}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              join();
            }}
          >
            <TextField
              className="join-input"
              fullWidth
              placeholder={t('e.g. a1b2-c3d4-e5f6')}
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setError(false);
              }}
              error={error}
              helperText={
                error ? t('Enter the 12-character code or paste an invite link.') : undefined
              }
              slotProps={{
                htmlInput: {
                  'aria-label': t('Tunnel code or invite link'),
                  maxLength: 2048,
                  autoComplete: 'off',
                  spellCheck: false,
                },
                input: { startAdornment: <InputAdornment position="start">#</InputAdornment> },
              }}
            />
            <Button
              className="join-button"
              type="submit"
              disabled={busy || !connected || !code.trim()}
              endIcon={<ArrowForwardRounded fontSize="small" />}
            >
              {t('Join the tunnel')}
            </Button>
          </form>
        </article>
      </section>
      <p className="temporary-note">{t('Content disappears when the tunnel ends.')}</p>
    </>
  );
}
