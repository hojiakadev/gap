import { useTranslation } from 'react-i18next';
export function InfoPage({ privacy }: { privacy: boolean; onBack: () => void }) {
  const { t } = useTranslation();

  const sections = privacy
    ? [
        [
          t('A relay, with no saved history'),
          t(
            'Gap forwards your content through a Socket.IO server. The server keeps room membership and transfer metadata in memory, but never saves messages or file contents to a database or disk. New arrivals only see content shared after they join.',
          ),
        ],
        [
          t('Temporary means temporary'),
          t(
            'Your current device keeps the latest 150 shared items in memory while connected. Leaving, losing connection, or ending the tunnel clears that device’s content and file URLs. When the last person leaves, the room disappears immediately. Every tunnel also expires after two hours.',
          ),
        ],
        [
          t('An invitation is the key'),
          t(
            'Anyone with the invite link, code, or QR can join until the tunnel is full. Share invites with people you trust. Any participant can end the tunnel for everyone. There are no public room listings or accounts.',
          ),
        ],
        [
          t('Only your preferences stay'),
          t(
            'LocalStorage remembers only your display name, theme, and interface language. Messages, files, invite codes, and tunnel history are never written to LocalStorage. You can clear your name in preferences at any time.',
          ),
        ],
        [
          t('Know the boundaries'),
          t(
            'Gap is a server relay, not end-to-end encrypted. Use HTTPS when deploying to encrypt network traffic. People can download files, copy messages, or take screenshots; Gap cannot erase copies they choose to keep. Hosting infrastructure may record connection metadata according to its configuration.',
          ),
        ],
      ]
    : [
        [
          t('01 — Make a tunnel'),
          t(
            'Choose “Just us two” or “The whole team”, then enter your name before connecting. No account or password needed.',
          ),
        ],
        [
          t('02 — Bring your people'),
          t(
            'Copy the invite link, send the 12-character code, or let someone scan the QR with their camera. On the same Wi-Fi, open Gap using the computer’s local network address so other devices can reach it. A localhost link works only on the computer that opened it.',
          ),
        ],
        [
          t('03 — Share something good'),
          t(
            'Once a second person joins, send messages, links, code snippets, images, and any file up to 20 MB. You can attach or drag files into the tunnel. Files travel in small chunks; the progress bar shows the transfer.',
          ),
        ],
        [
          t('04 — Leave no history behind'),
          t(
            'Leave to clear this device, or end the tunnel to clear it for everyone. A tunnel disappears when everyone leaves and expires after two hours. Rejoining starts fresh; there is no saved history to restore.',
          ),
        ],
      ];
  return (
    <div className="info-content">
      <div className="eyebrow">
        {privacy ? t('LESS DATA. MORE PEACE OF MIND.') : t('A SHORTCUT TO EACH OTHER.')}
      </div>
      <h1>{privacy ? t('Here in the moment.') : t('A connection in seconds.')}</h1>
      {sections.map(([title, body]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{body}</p>
        </section>
      ))}
    </div>
  );
}
