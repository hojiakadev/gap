export const LIMITS = {
  fileBytes: 20 * 1024 * 1024,
  chunkBytes: 64 * 1024,
  textLength: 16_000,
  roomMs: 2 * 60 * 60 * 1000,
  members: 12,
  history: 150,
} as const;
export type RoomMode = 'pair' | 'team';
export interface Member {
  id: string;
  name: string;
}
export interface Room {
  code: string;
  mode: RoomMode;
  members: Member[];
  expiresAt: number;
}
export const CODE_LANGUAGES = [
  'plaintext',
  'typescript',
  'javascript',
  'python',
  'html',
  'css',
  'json',
  'bash',
  'sql',
  'go',
  'rust',
  'cpp',
  'java',
] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
export interface ReplyReference {
  id: string;
  senderName: string;
  preview: string;
}
export interface TextContent {
  kind: 'text' | 'code';
  text: string;
  language?: CodeLanguage;
  replyTo?: ReplyReference;
}
export interface FileMeta {
  id: string;
  name: string;
  size: number;
  mime: string;
}
export interface RelayMessage {
  id: string;
  sender: Member;
  at: number;
  content: TextContent;
}
export interface FileStart {
  sender: Member;
  file: FileMeta;
  at: number;
}
export interface FileChunk {
  id: string;
  index: number;
  data: ArrayBuffer;
}
export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type Ack<T = undefined> = (result: Result<T>) => void;
export interface ServerEvents {
  'room:members': (members: Member[]) => void;
  'room:ended': (reason: string) => void;
  'content:text': (message: RelayMessage) => void;
  'file:start': (event: FileStart) => void;
  'file:chunk': (event: FileChunk) => void;
  'file:complete': (id: string) => void;
  'file:cancel': (id: string) => void;
}
export interface ClientEvents {
  'room:create': (input: { name: string; mode: RoomMode }, ack: Ack<Room>) => void;
  'room:join': (input: { name: string; code: string }, ack: Ack<Room>) => void;
  'room:leave': (ack: Ack) => void;
  'room:end': (ack: Ack) => void;
  'content:text': (content: TextContent, ack: Ack<RelayMessage>) => void;
  'file:start': (file: FileMeta, ack: Ack) => void;
  'file:chunk': (chunk: FileChunk, ack: Ack) => void;
  'file:complete': (id: string, ack: Ack) => void;
  'file:cancel': (id: string) => void;
}
export const normalizeCode = (code: string) => code.replace(/[^a-z0-9]/gi, '').toLowerCase();
export const displayCode = (code: string) => code.match(/.{1,4}/g)?.join('-') ?? code;
