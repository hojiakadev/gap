import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { Button, IconButton, Tooltip } from '@mui/material';
import AttachFileRounded from '@mui/icons-material/AttachFileRounded';
import CodeRounded from '@mui/icons-material/CodeRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import FormatBoldRounded from '@mui/icons-material/FormatBoldRounded';
import FormatItalicRounded from '@mui/icons-material/FormatItalicRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ReplyRounded from '@mui/icons-material/ReplyRounded';
import { LIMITS, type TextContent, type ReplyReference } from '../../../shared/protocol';
import { formatSelection } from '../../lib/textFormatting';
import { RichText } from './RichText';
import { CodeDialog } from './CodeDialog';
interface Props {
  ready: boolean;
  transferring: boolean;
  replyTo: ReplyReference | null;
  onCancelReply: () => void;
  onAttach: () => void;
  onSend: (content: TextContent) => Promise<boolean>;
  notify: (message: string) => void;
}
export function Composer({
  ready,
  transferring,
  replyTo,
  onCancelReply,
  onAttach,
  onSend,
  notify,
}: Props) {
  const { t } = useTranslation();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (replyTo) {
      setPreview(false);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [replyTo]);
  const format = (marker: '**' | '_') => {
    const element = input.current;
    if (!element || !ready) return;
    const result = formatSelection(
      draft,
      element.selectionStart,
      element.selectionEnd,
      marker,
      marker === '**' ? t('bold text') : t('italic text'),
    );
    if (result.text.length > LIMITS.textLength) {
      notify(t('This message has reached the 16,000 character limit.'));
      return;
    }
    setDraft(result.text);
    setPreview(false);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(result.start, result.end);
    });
  };
  const send = async () => {
    if (sending || !draft.trim() || !ready) return;
    setSending(true);
    const text = draft;
    try {
      if (await onSend({ kind: 'text', text, ...(replyTo ? { replyTo } : {}) })) {
        setDraft((current) => (current === text ? '' : current));
        onCancelReply();
        setPreview(false);
      }
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="composer">
      {replyTo && (
        <div className="reply-banner">
          <ReplyRounded fontSize="small" />
          <div>
            <b>{t('Replying to {{name}}', { name: replyTo.senderName })}</b>
            <span>{replyTo.preview}</span>
          </div>
          <IconButton size="small" onClick={onCancelReply} aria-label={t('Cancel reply')}>
            <CloseRounded fontSize="small" />
          </IconButton>
        </div>
      )}
      <div className="composer-box">
        <div className="format-toolbar">
          <div>
            <Tooltip title={t('Bold (Ctrl / ⌘ + B)')}>
              <span>
                <IconButton
                  disabled={!ready}
                  aria-label={t('Bold text')}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => format('**')}
                >
                  <FormatBoldRounded fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('Italic (Ctrl / ⌘ + I)')}>
              <span>
                <IconButton
                  disabled={!ready}
                  aria-label={t('Italic text')}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => format('_')}
                >
                  <FormatItalicRounded fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <span className="toolbar-divider" />
            <Tooltip title={t('Share code')}>
              <span>
                <IconButton
                  disabled={!ready}
                  aria-label={t('Share code snippet')}
                  onClick={() => setCodeOpen(true)}
                >
                  <CodeRounded fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('Attach a file (up to 20 MB)')}>
              <span>
                <IconButton
                  disabled={!ready || transferring}
                  aria-label={t('Attach file')}
                  onClick={onAttach}
                >
                  <AttachFileRounded fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </div>
          <Button
            className="preview-toggle"
            size="small"
            disabled={!draft}
            aria-pressed={preview}
            onClick={() => setPreview(!preview)}
          >
            {preview ? t('Edit text') : t('Preview')}
          </Button>
        </div>
        <textarea
          ref={input}
          aria-label={t('Message')}
          hidden={preview}
          placeholder={
            ready
              ? t('Write a message. Share a little something…')
              : t('Invite a teammate to start sharing…')
          }
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={LIMITS.textLength}
          disabled={!ready}
          rows={3}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if ((event.ctrlKey || event.metaKey) && ['b', 'i'].includes(event.key.toLowerCase())) {
              event.preventDefault();
              format(event.key.toLowerCase() === 'b' ? '**' : '_');
            }
            if (event.key === 'Escape' && replyTo) {
              event.preventDefault();
              onCancelReply();
            }
            if (event.key === 'Enter' && (!event.shiftKey || event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void send();
            }
          }}
        />
        {preview && (
          <div className="composer-preview" aria-label={t('Message preview')}>
            <RichText text={draft} />
          </div>
        )}
        <div className="composer-actions">
          <span className="format-hint">{t('**bold** · _italic_ · `inline code`')}</span>
          <Button
            variant="contained"
            disabled={!ready || sending || !draft.trim()}
            endIcon={<SendRounded sx={{ fontSize: 16 }} />}
            onClick={() => void send()}
          >
            {sending ? t('Sending…') : t('Send')}
          </Button>
        </div>
      </div>
      <div className="composer-hint">
        {t('Enter to send · Shift + Enter for a new line · Files up to 20 MB')}
      </div>
      <CodeDialog
        open={codeOpen}
        onClose={() => setCodeOpen(false)}
        onSend={onSend}
        replyTo={replyTo}
        onSent={onCancelReply}
      />
    </div>
  );
}
