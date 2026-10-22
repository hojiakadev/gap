import { useTranslation } from 'react-i18next';
import { localizeNotice } from '../i18n';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  TextField,
} from '@mui/material';
import { Shell, type Page } from '../components/Shell';
import { InfoPage } from '../components/InfoPage';
import { Landing } from '../features/tunnel/Landing';
import { TunnelRoom } from '../features/tunnel/TunnelRoom';
import { useTunnel } from '../features/tunnel/useTunnel';
import { loadPreferences, savePreferences } from '../lib/preferences';
import { normalizeName } from '../../shared/names';
import type { RoomMode } from '../../shared/protocol';
function codeFromHash() {
  return window.location.hash.match(/^#\/?join\/([a-f0-9-]+)$/i)?.[1] ?? '';
}
type PendingConnection = { mode: RoomMode } | { code: string };
export default function App() {
  const { t } = useTranslation();
  const [page, setPage] = useState<Page>('home');
  const [name, setName] = useState(() => loadPreferences().name);
  const [nameDraft, setNameDraft] = useState(name);
  const [nameError, setNameError] = useState(false);
  const [settings, setSettings] = useState(false);
  const [pending, setPending] = useState<PendingConnection | null>(null);
  const [notice, setNotice] = useState('');
  const [inviteCode, setInviteCode] = useState(codeFromHash);
  const notify = useCallback((message: string) => setNotice(message), []);
  const tunnel = useTunnel(notify);
  useEffect(() => {
    const handler = () => {
      setInviteCode(codeFromHash());
      setPage('home');
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  const execute = (value: string, action: PendingConnection) => {
    void tunnel.createOrJoin(
      value,
      'mode' in action ? action.mode : undefined,
      'code' in action ? action.code : undefined,
    );
  };
  const connect = (action: PendingConnection) => {
    const value = normalizeName(name);
    if (value) {
      execute(value, action);
      return;
    }
    setPending(action);
    setNameDraft(name);
    setNameError(false);
    setSettings(true);
  };
  const saveName = () => {
    const value = normalizeName(nameDraft);
    if (!value) {
      setNameError(true);
      return;
    }
    setName(value);
    savePreferences({ name: value });
    setSettings(false);
    if (pending) execute(value, pending);
    setPending(null);
  };
  const closeSettings = () => {
    setSettings(false);
    setPending(null);
  };
  return (
    <>
      <Shell
        inRoom={!!tunnel.room && page === 'home'}
        page={page}
        onPage={setPage}
        name={name}
        onSettings={() => {
          setNameDraft(name);
          setNameError(false);
          setSettings(true);
        }}
      >
        {tunnel.connectionIssue && (
          <Alert severity="warning" className="relay-warning">
            {t('The relay is unavailable. Check the connection or try again shortly.')}
          </Alert>
        )}
        {page === 'home' ? (
          tunnel.room ? (
            <TunnelRoom tunnel={tunnel} notify={notify} />
          ) : (
            <Landing
              key={inviteCode}
              initialCode={codeFromHash()}
              busy={tunnel.busy}
              connected={tunnel.connected}
              onCreate={(mode) => connect({ mode })}
              onJoin={(code) => connect({ code })}
            />
          )
        ) : (
          <InfoPage privacy={page === 'privacy'} onBack={() => setPage('home')} />
        )}
      </Shell>
      <Dialog
        open={settings}
        onClose={closeSettings}
        fullWidth
        maxWidth="xs"
        aria-labelledby="name-dialog-title"
      >
        <DialogTitle id="name-dialog-title">{t('What should we call you?')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 14, mb: 3 }}>
            {t('Enter your name so others can recognize you.')}
          </DialogContentText>
          {tunnel.room && (
            <Alert severity="info" sx={{ mb: 3, fontSize: 12 }}>
              {t('Name changes apply to your next tunnel.')}
            </Alert>
          )}
          <TextField
            autoFocus
            required
            fullWidth
            label={t('Display name')}
            placeholder={t('e.g. Alex')}
            value={nameDraft}
            error={nameError}
            helperText={nameError ? t('Enter a name between 1 and 32 characters.') : undefined}
            onChange={(event) => {
              setNameDraft(event.target.value);
              setNameError(false);
            }}
            slotProps={{ htmlInput: { maxLength: 32, autoComplete: 'nickname' } }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                saveName();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          {!tunnel.room && !pending && name && (
            <Button
              color="inherit"
              onClick={() => {
                setName('');
                savePreferences({ name: '' });
                closeSettings();
              }}
            >
              {t('Clear name')}
            </Button>
          )}
          <Button onClick={closeSettings}>{t('Cancel')}</Button>
          <Button variant="contained" onClick={saveName}>
            {t(pending ? 'Continue' : 'Save preference')}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        key={notice}
        open={!!notice}
        message={localizeNotice(notice)}
        autoHideDuration={6500}
        onClose={() => setNotice('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
