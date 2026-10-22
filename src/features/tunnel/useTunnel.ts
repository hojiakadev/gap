import { normalizeName } from '../../../shared/names';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { uuid } from '../../lib/uuid';
import {
  LIMITS,
  type ClientEvents,
  type FileMeta,
  type FileStart,
  type RelayMessage,
  type Result,
  type Room,
  type RoomMode,
  type ServerEvents,
  type TextContent,
} from '../../../shared/protocol';
export interface ContentItem extends Omit<RelayMessage, 'content'> {
  content: TextContent | { kind: 'file'; file: FileMeta; url: string };
}
interface Receiving {
  event: FileStart;
  chunks: ArrayBuffer[];
  bytes: number;
}
export function useTunnel(notify: (message: string) => void) {
  const socketRef = useRef<Socket<ServerEvents, ClientEvents> | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [transfer, setTransfer] = useState<{ name: string; progress: number } | null>(null);
  const roomRef = useRef<Room | null>(null);
  const urls = useRef(new Set<string>());
  const receiving = useRef(new Map<string, Receiving>());
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const generation = useRef(0);
  const activeSend = useRef(false);
  const clear = useCallback(() => {
    generation.current++;
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current.clear();
    receiving.current.clear();
    roomRef.current = null;
    setRoom(null);
    setItems([]);
    setTransfer(null);
  }, []);
  const append = useCallback(
    (item: ContentItem) =>
      setItems((previous) => {
        const next = [...previous, item];
        if (next.length > LIMITS.history) {
          const removed = next.shift();
          if (removed?.content.kind === 'file') {
            URL.revokeObjectURL(removed.content.url);
            urls.current.delete(removed.content.url);
          }
        }
        return next;
      }),
    [],
  );
  useEffect(() => {
    const socket: Socket<ServerEvents, ClientEvents> = io(
      import.meta.env.VITE_RELAY_URL?.trim() || undefined,
      {
        autoConnect: true,
        reconnection: true,
      },
    );
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      setConnectionIssue(false);
    });
    socket.on('connect_error', () => setConnectionIssue(true));
    socket.on('disconnect', () => {
      setConnected(false);
      if (roomRef.current) {
        clear();
        notifyRef.current(
          'Connection lost. This device’s tunnel contents were cleared. Rejoin to receive new content.',
        );
      }
    });
    socket.on('room:members', (members) => {
      if (roomRef.current) {
        roomRef.current = { ...roomRef.current, members };
        setRoom(roomRef.current);
      }
    });
    socket.on('room:ended', (reason) => {
      clear();
      window.history.replaceState(null, '', window.location.pathname);
      notifyRef.current(reason);
    });
    socket.on('content:text', append);
    socket.on('file:start', (event) => {
      const reserved = [...receiving.current.values()].reduce(
        (sum, entry) => sum + entry.event.file.size,
        0,
      );
      if (receiving.current.size >= 8 || reserved + event.file.size > LIMITS.fileBytes * 2) {
        notifyRef.current(
          'Too many incoming files. Ask your teammate to resend when transfers finish.',
        );
        return;
      }
      receiving.current.set(event.file.id, { event, chunks: [], bytes: 0 });
      setTransfer({ name: event.file.name, progress: 0 });
    });
    socket.on('file:chunk', (chunk) => {
      const entry = receiving.current.get(chunk.id);
      if (!entry) return;
      if (
        chunk.index !== entry.chunks.length ||
        entry.bytes + chunk.data.byteLength > entry.event.file.size
      ) {
        receiving.current.delete(chunk.id);
        return;
      }
      entry.chunks.push(chunk.data);
      entry.bytes += chunk.data.byteLength;
      setTransfer({
        name: entry.event.file.name,
        progress: Math.round((entry.bytes / Math.max(1, entry.event.file.size)) * 100),
      });
    });
    socket.on('file:complete', (id) => {
      const entry = receiving.current.get(id);
      if (!entry) return;
      receiving.current.delete(id);
      setTransfer(null);
      if (entry.bytes !== entry.event.file.size) {
        notifyRef.current('The incoming file was incomplete. Ask your teammate to resend it.');
        return;
      }
      // Never render executable content. Only allow a small set of raster images inline.
      const mime = /^image\/(png|jpeg|gif|webp)$/.test(entry.event.file.mime)
        ? entry.event.file.mime
        : 'application/octet-stream';
      const url = URL.createObjectURL(new Blob(entry.chunks, { type: mime }));
      urls.current.add(url);
      append({
        id,
        sender: entry.event.sender,
        at: entry.event.at,
        content: { kind: 'file', file: entry.event.file, url },
      });
    });
    socket.on('file:cancel', (id) => {
      if (receiving.current.delete(id)) {
        setTransfer(null);
        notifyRef.current('An incoming file transfer was interrupted.');
      }
    });
    return () => {
      socket.disconnect();
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
      receiving.current.clear();
    };
  }, [append, clear]);
  const createOrJoin = async (name: string, mode?: RoomMode, code?: string) => {
    if (!normalizeName(name)) {
      notify('Enter a name between 1 and 32 characters.');
      return;
    }
    const socket = socketRef.current;
    if (!socket?.connected) {
      notify('The relay is connecting. Please try again in a moment.');
      return;
    }
    setBusy(true);
    try {
      const result: Result<Room> = mode
        ? await socket.timeout(8000).emitWithAck('room:create', { name, mode })
        : await socket.timeout(8000).emitWithAck('room:join', { name, code: code ?? '' });
      if (!result.ok) throw new Error(result.error);
      clear();
      roomRef.current = result.data;
      setRoom(result.data);
      window.history.replaceState(null, '', `#/join/${result.data.code}`);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not connect to the tunnel. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  const sendText = async (content: TextContent) => {
    try {
      const result = await socketRef.current!.timeout(8000).emitWithAck('content:text', content);
      if (!result.ok) throw new Error(result.error);
      append(result.data);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Message could not be sent.');
      return false;
    }
  };
  const sendFile = async (file: File) => {
    if (activeSend.current) {
      notify('Wait for your current file to finish sending.');
      return;
    }
    if (file.size > LIMITS.fileBytes) {
      notify('This file is too large. Choose a file up to 20 MB.');
      return;
    }
    if (!roomRef.current || roomRef.current.members.length < 2) {
      notify('Invite a teammate before sharing files.');
      return;
    }
    const socket = socketRef.current!;
    const session = generation.current;
    const meta: FileMeta = {
      id: uuid(),
      name: file.name.slice(0, 255),
      size: file.size,
      mime: file.type.slice(0, 100),
    };
    activeSend.current = true;
    try {
      let result = await socket.timeout(10_000).emitWithAck('file:start', meta);
      if (!result.ok) throw new Error(result.error);
      for (let offset = 0, index = 0; offset < file.size; offset += LIMITS.chunkBytes, index++) {
        if (session !== generation.current)
          throw new Error('The tunnel closed before this transfer finished.');
        const data = await file.slice(offset, offset + LIMITS.chunkBytes).arrayBuffer();
        result = await socket
          .timeout(10_000)
          .emitWithAck('file:chunk', { id: meta.id, index, data });
        if (!result.ok) throw new Error(result.error);
        setTransfer({
          name: file.name,
          progress: Math.round(
            (Math.min(offset + LIMITS.chunkBytes, file.size) / Math.max(1, file.size)) * 100,
          ),
        });
      }
      result = await socket.timeout(10_000).emitWithAck('file:complete', meta.id);
      if (!result.ok) throw new Error(result.error);
      if (session !== generation.current || !roomRef.current) return;
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      append({
        id: meta.id,
        sender: roomRef.current.members.find((m) => m.id === socket.id)!,
        at: Date.now(),
        content: { kind: 'file', file: meta, url },
      });
    } catch (error) {
      socket.emit('file:cancel', meta.id);
      notify(error instanceof Error ? error.message : 'File could not be sent.');
    } finally {
      activeSend.current = false;
      setTransfer(null);
    }
  };
  const leave = async (end: boolean) => {
    // Closing the transport is a safe fallback if a leave acknowledgement is lost.
    try {
      await socketRef.current!.timeout(4000).emitWithAck(end ? 'room:end' : 'room:leave');
    } catch {
      socketRef.current?.disconnect();
      socketRef.current?.connect();
    }
    clear();
    window.history.replaceState(null, '', window.location.pathname);
  };
  return {
    connected,
    connectionIssue,
    room,
    items,
    busy,
    transfer,
    selfId: socketRef.current?.id,
    createOrJoin,
    sendText,
    sendFile,
    leave,
  };
}
