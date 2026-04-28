import {
  BlockingResponse,
  Host,
  WebAuthenticationChallengeDetails,
  WebResponseDetails,
} from "./adapters";
import { WebRequestErrorOccurredDetails } from "./adapters/base";
import { setIndicator } from "./services/indicator";
import { getAuthInfos, getCurrentProxySetting } from "./services/proxy";

// indicator
async function initIndicator() {
  await setIndicator(await getCurrentProxySetting());

  try {
    Host.onProxyChanged(async () => {
      await setIndicator(await getCurrentProxySetting());
    });
  } catch (e) {
    console.warn("[Proxyverse] failed to register proxy change handler", e);
  }
}

initIndicator().catch(console.error);

// proxy auth provider
class ProxyAuthProvider {
  // requests[requestID] = request attempts. 0 means the 1st attempt
  static requests: Record<string, number> = {};

  static onCompleted(
    details: WebResponseDetails | WebRequestErrorOccurredDetails
  ) {
    if (ProxyAuthProvider.requests[details.requestId]) {
      delete ProxyAuthProvider.requests[details.requestId];
    }
  }

  static onAuthRequired(
    details: WebAuthenticationChallengeDetails,
    callback?: (response: BlockingResponse) => void
  ) {
    if (!details.isProxy) {
      callback && callback({});
      return;
    }

    if (ProxyAuthProvider.requests[details.requestId] === undefined) {
      // 0 means the 1st attempt
      ProxyAuthProvider.requests[details.requestId] = 0;
    } else {
      ProxyAuthProvider.requests[details.requestId]++;
    }

    getAuthInfos(details.challenger.host, details.challenger.port).then(
      (authInfos) => {
        const auth = authInfos.at(
          ProxyAuthProvider.requests[details.requestId]
        );
        if (!auth) {
          callback && callback({ cancel: true });
          return;
        }

        callback &&
          callback({
            authCredentials: {
              username: auth.username,
              password: auth.password,
            },
          });
      }
    );
  }
}

try {
  Host.onWebRequestAuthRequired(ProxyAuthProvider.onAuthRequired);
} catch (e) {
  console.warn("[Proxyverse] failed to register onAuthRequired", e);
}

try {
  Host.onWebRequestCompleted(ProxyAuthProvider.onCompleted);
} catch (e) {
  console.warn("[Proxyverse] failed to register onCompleted", e);
}

try {
  Host.onWebRequestErrorOccurred(ProxyAuthProvider.onCompleted);
} catch (e) {
  console.warn("[Proxyverse] failed to register onErrorOccurred", e);
}

try {
  Host.onProxyError(console.warn);
} catch (e) {
  console.warn("[Proxyverse] failed to register onProxyError", e);
}
