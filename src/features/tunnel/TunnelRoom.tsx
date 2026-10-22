import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ForumOutlined from '@mui/icons-material/ForumOutlined';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import { LIMITS, type ReplyReference } from '../../../shared/protocol';
import { InviteCard } from './InviteCard';
import { Message } from './Message';
import { Composer } from './Composer';
import type { useTunnel } from './useTunnel';
interface Props {
  tunnel: ReturnType<typeof useTunnel>;
  notify: (message: string) => void;
}
export function TunnelRoom({ tunnel, notify }: Props) {
  const { t } = useTranslation();

  const { room, items, selfId, transfer, sendText, sendFile, leave } = tunnel;
  const [replyTo, setReplyTo] = useState<ReplyReference | null>(null);
  const [ending, setEnding] = useState(false);
  const [dialog, setDialog] = useState<'leave' | 'end' | null>(null);
  const [dragging, setDragging] = useState(false);
  const [now, setNow] = useState(Date.now());
  const fileInput = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [items, transfer]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  if (!room) return null;
  const ready = room.members.length >= 2;
  const jumpToMessage = (id: string) => {
    const element = document.getElementById(`message-${id}`);
    if (!element) {
      notify(t('This message is no longer in this device’s temporary history.'));
      return;
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('message-highlight');
    setTimeout(() => element.classList.remove('message-highlight'), 1600);
  };
  return (
    <div
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        dragDepth.current++;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        if (--dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) void sendFile(file);
      }}
    >
      {dragging && (
        <div className="drop-overlay">
          <CloudUploadOutlined />
          <h2>{t('Drop it into the conversation.')}</h2>
          <p>{t('One file at a time · Up to 20 MB')}</p>
        </div>
      )}
      <div className="room-heading">
        <div>
          <h1>{t(room.mode === 'team' ? 'Team tunnel' : 'Pair tunnel')}</h1>
        </div>
        <Button
          size="small"
          color="inherit"
          startIcon={<ArrowBackRounded />}
          onClick={() => setDialog('leave')}
        >
          {t('Leave tunnel')}
        </Button>
      </div>
      <div className="room-layout">
        <section className="conversation" aria-label={t('Live conversation')}>
          <div className="conversation-toolbar">
            <h2>
              {t('Messages')}{' '}
              <Chip
                label={t('LIVE')}
                size="small"
                sx={{
                  ml: 1,
                  height: 22,
                  fontSize: 10,
                  bgcolor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              />
            </h2>
            <span>
              {t('connectedCount', {
                count: room.members.length,
                total: room.mode === 'pair' ? 2 : LIMITS.members,
              })}
            </span>
          </div>
          <div
            className="message-list"
            ref={list}
            role="log"
            aria-label={t('Shared content')}
            aria-live="polite"
          >
            {!items.length ? (
              <div className="empty-conversation">
                <div className="empty-icon">
                  <ForumOutlined />
                </div>
                <h3>{ready ? t('No messages yet.') : t('Invite a teammate to start sharing.')}</h3>
                <p>
                  {ready
                    ? t('Send a message or drop a file.')
                    : t('Copy the invite link or share the QR code.')}
                </p>
              </div>
            ) : (
              items.map((item) => (
                <Message
                  key={item.id}
                  item={item}
                  own={item.sender.id === selfId}
                  notify={notify}
                  onReply={setReplyTo}
                  onJump={jumpToMessage}
                />
              ))
            )}
          </div>
          {transfer && (
            <div style={{ padding: '8px 18px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: 'var(--muted)',
                  marginBottom: 7,
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '80%',
                  }}
                >
                  {t('Transferring {{name}}', { name: transfer.name })}
                </span>
                <span>{transfer.progress}%</span>
              </div>
              <LinearProgress
                variant="determinate"
                value={transfer.progress}
                sx={{ height: 3, borderRadius: 2 }}
              />
            </div>
          )}
          <Composer
            ready={ready}
            transferring={!!transfer}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onAttach={() => fileInput.current?.click()}
            onSend={sendText}
            notify={notify}
          />
        </section>
        <aside className="room-aside">
          <InviteCard code={room.code} expiresAt={room.expiresAt} now={now} notify={notify} />
          <div className="people-card">
            <h2 className="aside-title">
              {t('Participants')}{' '}
              <span style={{ fontWeight: 400, color: 'var(--muted)' }}>
                · {room.members.length}
              </span>
            </h2>
            {room.members.map((member) => (
              <div className="person" key={member.id}>
                <div className="profile-avatar">{member.name[0].toUpperCase()}</div>
                <div>
                  {member.name}
                  {member.id === selfId ? ` ${t('(you)')}` : ''}
                  <small>{t('Here, right now')}</small>
                </div>
                <span className="status-dot" />
              </div>
            ))}
          </div>
          <Button
            color="error"
            size="small"
            startIcon={<CloseRounded sx={{ fontSize: 14 }} />}
            sx={{ fontSize: 12 }}
            onClick={() => setDialog('end')}
          >
            {t('End tunnel for everyone')}
          </Button>
        </aside>
      </div>
      <input
        ref={fileInput}
        type="file"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void sendFile(file);
          event.target.value = '';
        }}
      />
      <Dialog
        open={!!dialog}
        onClose={() => {
          if (!ending) setDialog(null);
        }}
      >
        <DialogTitle>
          {dialog === 'end' ? t('Ready to close this little space?') : t('Heading out?')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 13, lineHeight: 1.8 }}>
            {dialog === 'end'
              ? t(
                  'This ends the tunnel for everyone and clears shared content from connected devices. Saved downloads and copied content will remain. There’s no undo.',
                )
              : t(
                  'Your messages and files on this device will be cleared. Your teammates can keep sharing while they’re connected. Save anything you need before leaving.',
                )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={ending}>
            {t('Stay a little longer')}
          </Button>
          <Button
            color={dialog === 'end' ? 'error' : 'primary'}
            disabled={ending}
            onClick={async () => {
              setEnding(true);
              await leave(dialog === 'end');
            }}
          >
            {ending ? t('Closing…') : dialog === 'end' ? t('End tunnel') : t('Leave tunnel')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
