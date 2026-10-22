import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n';
import { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import ReplyRounded from '@mui/icons-material/ReplyRounded';
import { formatBytes, copyText } from '../../lib/format';
import { RichText } from './RichText';
import { plainText } from '../../lib/textFormatting';
import type { ContentItem } from './useTunnel';
import type { ReplyReference } from '../../../shared/protocol';
export function Message({
  item,
  own,
  notify,
  onReply,
  onJump,
}: {
  item: ContentItem;
  own: boolean;
  notify: (message: string) => void;
  onReply: (reply: ReplyReference) => void;
  onJump: (id: string) => void;
}) {
  const { t } = useTranslation();

  const [failedImage, setFailedImage] = useState(false);
  const { content } = item;
  const copy = (text: string) => {
    void copyText(text)
      .then(() => notify(t('Copied to clipboard.')))
      .catch((error) => notify(error.message));
  };
  const reply = content.kind === 'file' ? undefined : content.replyTo;
  return (
    <article
      id={`message-${item.id}`}
      className={`message ${own ? 'own' : ''} ${content.kind === 'code' ? 'code-message' : ''}`}
    >
      <div className="message-meta">
        <b>{own ? t('You') : item.sender.name}</b>
        <span>
          {new Date(item.at).toLocaleTimeString(currentLocale(), {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <div className="message-bubble">
        {reply && (
          <button
            className="reply-quote"
            onClick={() => onJump(reply.id)}
            aria-label={t('View message from {{name}}', { name: reply.senderName })}
          >
            <b>{reply.senderName}</b>
            <span>{plainText(reply.preview)}</span>
          </button>
        )}
        {content.kind === 'file' ? (
          <>
            {!failedImage && /^image\/(png|jpeg|gif|webp)$/.test(content.file.mime) && (
              <img src={content.url} alt={content.file.name} onError={() => setFailedImage(true)} />
            )}
            <div className="file-message">
              <InsertDriveFileOutlined />
              <div style={{ flex: 1 }}>
                <div className="file-message-name">{content.file.name}</div>
                <small>
                  {formatBytes(content.file.size)} · {t('Ready to save')}
                </small>
              </div>
              <Tooltip title={t('Download file')}>
                <IconButton
                  component="a"
                  href={content.url}
                  download={content.file.name}
                  size="small"
                  aria-label={t('Download {{name}}', { name: content.file.name })}
                >
                  <DownloadRounded fontSize="small" />
                </IconButton>
              </Tooltip>
            </div>
          </>
        ) : content.kind === 'code' ? (
          <div className="code-block">
            <div className="code-block-header">
              <span>
                <i />{' '}
                {content.language === 'plaintext' || !content.language
                  ? t('Plain text')
                  : content.language}
              </span>
              <button onClick={() => copy(content.text)} aria-label={t('Copy code')}>
                <ContentCopyRounded sx={{ fontSize: 14 }} />
                {t('Copy code')}
              </button>
            </div>
            <pre>
              <code>{content.text}</code>
            </pre>
            <div className="code-block-footer">
              {t('lineCount', { count: content.text.split('\n').length })}
            </div>
          </div>
        ) : (
          <RichText text={content.text} />
        )}
      </div>
      <div className="message-actions">
        <Tooltip title={t('Reply')}>
          <IconButton
            size="small"
            aria-label={
              own ? t('Reply to your message') : t('Reply to {{name}}', { name: item.sender.name })
            }
            onClick={() =>
              onReply({
                id: item.id,
                senderName: item.sender.name,
                preview: (content.kind === 'file'
                  ? content.file.name
                  : content.kind === 'text'
                    ? plainText(content.text)
                    : content.text
                ).slice(0, 200),
              })
            }
          >
            <ReplyRounded sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        {content.kind === 'text' && (
          <Tooltip title={t('Copy content')}>
            <IconButton
              size="small"
              aria-label={t('Copy content')}
              onClick={() => copy(content.text)}
            >
              <ContentCopyRounded sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </div>
    </article>
  );
}
