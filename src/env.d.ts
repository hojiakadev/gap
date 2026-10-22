/** Private IPv4 interfaces supplied only by the local Vite dev server. */
declare const __GAP_LAN_HOSTS__: string[];

interface ImportMetaEnv {
  readonly VITE_RELAY_URL?: string;
}
