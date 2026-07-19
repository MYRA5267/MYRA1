import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type NativeMediaCommand =
  | { command: "play" | "pause" | "next" | "previous" | "flow" | "like" }
  | { command: "seek"; position: number };

export type NativeMediaState = {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork?: string;
  playing: boolean;
  liked: boolean;
  duration: number;
  position: number;
};

interface MyraMediaPlugin {
  update(state: NativeMediaState): Promise<void>;
  stop(): Promise<void>;
  requestPermissions(): Promise<Record<string, string>>;
  addListener(
    eventName: "mediaCommand",
    listener: (event: NativeMediaCommand) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "mediaError",
    listener: (event: { message?: string }) => void,
  ): Promise<PluginListenerHandle>;
}

export const isNativeAndroid = Capacitor.getPlatform() === "android";
export const MyraMedia = registerPlugin<MyraMediaPlugin>("MyraMedia");

const artworkCache = new Map<string, Promise<string | undefined>>();

/**
 * Android MediaMetadata cannot decode our generated SVG data URLs directly.
 * Convert them once per cover and keep the result cached; PNG/JPEG/WebP and
 * remote covers can be forwarded without touching the main thread.
 */
export function prepareNativeArtwork(source: string): Promise<string | undefined> {
  if (!source) return Promise.resolve(undefined);
  const cached = artworkCache.get(source);
  if (cached) return cached;

  const task = new Promise<string | undefined>((resolve) => {
    if (!source.startsWith("data:image/svg+xml")) {
      resolve(source);
      return;
    }

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          resolve(undefined);
          return;
        }
        context.fillStyle = "#080609";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png", 0.92));
      } catch {
        resolve(undefined);
      }
    };
    image.onerror = () => resolve(undefined);
    image.src = source;
  });

  artworkCache.set(source, task);
  return task;
}
