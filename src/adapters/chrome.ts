/// <reference types="@types/chrome" />

import {
  BaseAdapter,
  BlockingResponse,
  BrowserFlavor,
  ProxyConfig,
  ProxyErrorDetails,
  ProxySettingResultDetails,
  WebAuthenticationChallengeDetails,
  WebRequestCompletedDetails,
  WebRequestErrorOccurredDetails,
} from "./base";

export class Chrome extends BaseAdapter {
  get flavor() {
    return BrowserFlavor.Chrome;
  }

  async set<T>(key: string, val: T): Promise<void> {
    return await chrome.storage.local.set({
      [key]: val,
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    const ret = await chrome.storage.local.get(key);
    return ret[key];
  }

  async setProxy(cfg: ProxyConfig): Promise<void> {
    await chrome.proxy.settings.set({
      value: cfg,
      scope: "regular",
    });
  }

  async clearProxy(): Promise<void> {
    await chrome.proxy.settings.clear({ scope: "regular" });
  }

  async getProxySettings(): Promise<ProxySettingResultDetails> {
    return (await chrome.proxy.settings.get({})) as any;
  }

  onProxyError(callback: (error: ProxyErrorDetails) => void): void {
    try {
      const api = chrome?.proxy?.onProxyError;
      if (api?.addListener) {
        api.addListener(callback);
      } else {
        console.warn("[Proxyverse] chrome.proxy.onProxyError unavailable");
      }
    } catch (e) {
      console.warn("[Proxyverse] failed to register proxy error listener", e);
    }
  }

  onProxyChanged(callback: (setting: ProxySettingResultDetails) => void): void {
    try {
      const api = chrome?.proxy?.settings?.onChange;
      if (api?.addListener) {
        api.addListener(callback);
      } else {
        console.warn("[Proxyverse] chrome.proxy.settings.onChange unavailable");
      }
    } catch (e) {
      console.warn("[Proxyverse] failed to register proxy change listener", e);
    }
  }

  async setBadge(text: string, color: string): Promise<void> {
    await chrome.action.setBadgeText({
      text: text.trimStart().substring(0, 2),
    });
    await chrome.action.setBadgeBackgroundColor({
      color: color,
    });
  }

  onWebRequestAuthRequired(
    callback: (
      details: WebAuthenticationChallengeDetails,
      callback?: (response: BlockingResponse) => void
    ) => void
  ): void {
    try {
      const api = chrome?.webRequest?.onAuthRequired;
      if (api?.addListener) {
        api.addListener(callback, { urls: ["<all_urls>"] }, ["asyncBlocking"]);
      } else {
        console.warn(
          "[Proxyverse] chrome.webRequest.onAuthRequired unavailable in this Chrome/MV3 environment"
        );
      }
    } catch (e) {
      console.warn("[Proxyverse] failed to register onAuthRequired listener", e);
    }
  }

  onWebRequestCompleted(
    callback: (details: WebRequestCompletedDetails) => void
  ): void {
    try {
      const api = chrome?.webRequest?.onCompleted;
      if (api?.addListener) {
        api.addListener(callback, { urls: ["<all_urls>"] });
      } else {
        console.warn("[Proxyverse] chrome.webRequest.onCompleted unavailable");
      }
    } catch (e) {
      console.warn("[Proxyverse] failed to register onCompleted listener", e);
    }
  }

  onWebRequestErrorOccurred(
    callback: (details: WebRequestErrorOccurredDetails) => void
  ): void {
    try {
      const api = chrome?.webRequest?.onErrorOccurred;
      if (api?.addListener) {
        api.addListener(callback, { urls: ["<all_urls>"] });
      } else {
        console.warn("[Proxyverse] chrome.webRequest.onErrorOccurred unavailable");
      }
    } catch (e) {
      console.warn("[Proxyverse] failed to register onErrorOccurred listener", e);
    }
  }

  currentLocale(): string {
    return chrome.i18n.getUILanguage();
  }

  getMessage(key: string, substitutions?: string | string[]): string {
    return chrome.i18n.getMessage(key, substitutions);
  }
}
