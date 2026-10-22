import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n';
import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import CodeRounded from '@mui/icons-material/CodeRounded';
import {
  CODE_LANGUAGES,
  LIMITS,
  type CodeLanguage,
  type TextContent,
  type ReplyReference,
} from '../../../shared/protocol';
interface Props {
  open: boolean;
  onClose: () => void;
  onSend: (content: TextContent) => Promise<boolean>;
  replyTo: ReplyReference | null;
  onSent: () => void;
}
export function CodeDialog({ open, onClose, onSend, replyTo, onSent }: Props) {
  const { t } = useTranslation();

  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<CodeLanguage>('typescript');
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!code.trim() || sending) return;
    setSending(true);
    try {
      if (await onSend({ kind: 'code', text: code, language, ...(replyTo ? { replyTo } : {}) })) {
        setCode('');
        onSent();
        onClose();
      }
    } finally {
      setSending(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!sending) onClose();
      }}
      fullWidth
      maxWidth="md"
      aria-labelledby="code-dialog-title"
    >
      <DialogTitle id="code-dialog-title">
        <span className="code-dialog-title">
          <CodeRounded />
          {t('Share a code snippet')}
        </span>
      </DialogTitle>
      <DialogContent>
        <p className="dialog-description">{t('Keep the indentation. Share the whole idea.')}</p>
        <TextField
          select
          label={t('Code language')}
          value={language}
          size="small"
          onChange={(event) => setLanguage(event.target.value as CodeLanguage)}
          sx={{ mt: 2, mb: 2, minWidth: 190 }}
        >
          {CODE_LANGUAGES.map((value) => (
            <MenuItem key={value} value={value}>
              {value === 'plaintext'
                ? t('Plain text')
                : value === 'cpp'
                  ? 'C++'
                  : value === 'typescript'
                    ? 'TypeScript'
                    : value === 'javascript'
                      ? 'JavaScript'
                      : ['html', 'css', 'json', 'sql'].includes(value)
                        ? value.toUpperCase()
                        : value[0].toUpperCase() + value.slice(1)}
            </MenuItem>
          ))}
        </TextField>
        {replyTo && (
          <div className="code-reply-note">
            {t('Replying to {{name}}', { name: replyTo.senderName })}: {replyTo.preview}
          </div>
        )}
        <textarea
          className="code-editor"
          aria-label={t('Code snippet')}
          autoFocus
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={LIMITS.textLength}
          placeholder={t('// Your next great idea goes here…')}
          onKeyDown={(event) => {
            if (event.key === 'Tab') {
              event.preventDefault();
              const input = event.currentTarget;
              const start = input.selectionStart;
              const end = input.selectionEnd;
              if (code.length - (end - start) + 2 <= LIMITS.textLength) {
                setCode(code.slice(0, start) + '  ' + code.slice(end));
                requestAnimationFrame(() => input.setSelectionRange(start + 2, start + 2));
              }
            }
            if (
              (event.metaKey || event.ctrlKey) &&
              event.key === 'Enter' &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="code-editor-footer">
          <span>{t('Tab to indent · Ctrl / ⌘ + Enter to send')}</span>
          <span>
            {t('characterCount', {
              value: code.length.toLocaleString(currentLocale()),
              limit: (16000).toLocaleString(currentLocale()),
            })}
          </span>
        </div>
      </DialogContent>
      <DialogActions>
        <Button disabled={sending} onClick={onClose}>
          {t('Cancel')}
        </Button>
        <Button variant="contained" disabled={sending || !code.trim()} onClick={() => void send()}>
          {sending ? t('Sending…') : t('Send code')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
