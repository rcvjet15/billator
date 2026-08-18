"use client";

import { useCallback, useState } from "react";

import { api, type PushSubscriptionLike } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/**
 * Browser-side helper for enabling Web Push notifications: requests
 * permission, subscribes via the Push API, and stores the subscription.
 * Requires a secure context (HTTPS or localhost).
 */
export function usePush() {
  const toast = useToast();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSecure = typeof window !== "undefined" && window.isSecureContext === true;
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const setSettingsSubscribed = useCallback(async (value: boolean) => {
    await api.updateSettings({ notifications: { subscribed: value } } as never).catch(() => undefined);
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported || !isSecure) return;
    setBusy(true);
    try {
      if (Notification.permission !== "granted") {
        const p = await Notification.requestPermission();
        setPermission(p);
        if (p !== "granted") {
          toast.show("warning", "Notification permission not granted.");
          return;
        }
      }

      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await api.pushPublicKey();
      if (!publicKey) {
        toast.show("error", "Push is not configured on the server (missing VAPID key).");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      } as PushSubscriptionOptionsInit);

      const raw = sub.toJSON() as PushSubscriptionLike;
      await api.pushSubscribe(raw);
      setSubscribed(true);
      await setSettingsSubscribed(true);
      toast.show("success", "Notifications enabled.");
    } catch (err) {
      console.error("[push] subscribe failed", err);
      toast.show("error", "Failed to enable notifications.", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [supported, isSecure, setSettingsSubscribed, toast]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await api.pushUnsubscribe();
      setSubscribed(false);
      await setSettingsSubscribed(false);
      toast.show("success", "Notifications disabled.");
    } catch (err) {
      toast.show("error", "Failed to disable notifications.", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [setSettingsSubscribed, toast]);

  const sendTest = useCallback(async () => {
    const res = await api.pushTest();
    if (res.ok) toast.show("success", "Test notification sent.");
    else toast.show("error", "No subscription stored to send a test to.");
  }, [toast]);

  return { permission, subscribed, busy, supported, isSecure, subscribe, unsubscribe, sendTest };
}

/** Convert a base64url VAPID public key (string) to a Uint8Array. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
  return out;
}
