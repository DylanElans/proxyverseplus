<script setup lang="ts">
import { type RouteLocationRaw, useRouter } from "vue-router";
import { Message } from "@arco-design/web-vue";
import { onMounted, ref, toRaw } from "vue";
import {
  IconDesktop,
  IconSwap,
  IconPlus,
  IconTool,
} from "@arco-design/web-vue/es/icon";
import ThemeSwitcher from "../components/controls/ThemeSwitcher.vue";
import {
  ProfilesStorage,
  listProfiles,
  SystemProfile,
  ProxyProfile,
} from "../services/profile";
import { setProxy, getCurrentProxySetting } from "../services/proxy";
import { Host } from "@/adapters";

// 测速用
import IconScan from '@arco-design/web-vue/es/icon/icon-scan';

const activeSetting = ref<"" | "config" | "ip">("");

const router = useRouter();
const profiles = ref<ProfilesStorage>({});
const selectedKeys = defineModel<string[]>();

interface ProfileCountryInfo {
  code: string;
  name: string;
  flag: string;
  city?: string;
  ip?: string;
}

const COUNTRY_STORAGE_KEY = "profileCountries";
const profileCountries = ref<Record<string, ProfileCountryInfo>>({});

// 底部出口 IP
const currentExitInfo = ref<{
  ip: string;
  country: string;
  city: string;
  flag: string;
} | null>(null);

// Chrome 当前代理模式
const systemProxyMode = ref<string | null>(null);

const countryCodeToFlag = (code: string): string => {
  if (!code || code.length !== 2) return "🌐";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((c) => base + (c.charCodeAt(0) - 65))
  );
};

// 检测出口 IP
const detectExitCountry = async (profileID: string) => {
  try {
    const resp = await fetch("http://ip-api.com/json/?lang=en");
    const data = await resp.json();
    if (!data || data.status !== "success") return;

    const code = data.countryCode ?? "UN";
    const flag = countryCodeToFlag(code);
    const country = data.country ?? "Unknown";
    const city = data.city ?? data.regionName ?? country;
    const ip = data.query ?? "";

    profileCountries.value = {
      ...profileCountries.value,
      [profileID]: { code, name: country, flag, city, ip },
    };

    currentExitInfo.value = { ip, country, city, flag };

    chrome.storage.local.set({
      [COUNTRY_STORAGE_KEY]: profileCountries.value,
    });
  } catch (e) {
    console.error("detectExitCountry error:", e);
  }
};

// 检测代理模式
const refreshSystemProxyMode = () => {
  try {
    (chrome as any).proxy?.settings?.get(
      { incognito: false },
      (details: any) => {
        systemProxyMode.value = details?.value?.mode ?? null;
      }
    );
  } catch {
    systemProxyMode.value = null;
  }
};

onMounted(async () => {
  profiles.value = await listProfiles();

  const proxy = await getCurrentProxySetting();
  const profileID = proxy.activeProfile?.profileID;

  if (profileID) selectedKeys.value = [profileID];

  chrome.storage.local.get(COUNTRY_STORAGE_KEY, (result) => {
    const saved = result[COUNTRY_STORAGE_KEY] ?? {};
    profileCountries.value = saved;
    if (profileID && saved[profileID]) {
      const i = saved[profileID];
      currentExitInfo.value = {
        ip: i.ip ?? "",
        country: i.name,
        city: i.city ?? i.name,
        flag: i.flag,
      };
    }
  });

  if (profileID) detectExitCountry(profileID);
  refreshSystemProxyMode();
});

const jumpTo = (to: RouteLocationRaw) => {
  const path = router.resolve(to).fullPath;
  window.open(`/index.html#${path}`, import.meta.url);
};

const openIPCheck = () => chrome.tabs.create({ url: "https://ip.sb" });

// 切换代理
const setProxyByProfile = async (val: ProxyProfile) => {
  try {
    speedResult.value = null;   // 切换代理时清空测速结果
    loading.value = false;      // 可选：顺手把测速按钮 loading 关掉
    
    const raw = toRaw(val);

    await setProxy(raw);

    selectedKeys.value = [raw.profileID];
    detectExitCountry(raw.profileID);
    refreshSystemProxyMode();
  } catch (e: any) {
    Message.error({
      content: Host.getMessage("config_feedback_error_occurred", e.toString()),
    });
  }
};


//测速相关开始
const speedResult = ref<{ download: number; upload: number; ping: number } | null>(null);
const loading = ref(false);
const PING_TEST_URL = "https://speed.hetzner.de/100KB.bin";
const DOWNLOAD_TEST_URL = "https://speed.hetzner.de/1MB.bin";
// 这个接口要支持 POST，并且允许跨域
const UPLOAD_TEST_URL = "https://your-server.com/speed/upload";

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10000
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
};

const testPing = async (): Promise<number> => {
  const times: number[] = [];

  for (let i = 0; i < 3; i++) {
    const url = `${PING_TEST_URL}?ping=${Date.now()}_${i}`;
    const start = performance.now();

    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",
        cache: "no-store",
      },
      8000
    );

    // 读完响应，确保请求真正完成
    await res.arrayBuffer();

    const end = performance.now();
    times.push(end - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return Math.round(avg);
};


// 测速函数（SpeedOf.Me 并行下载）
const testProxySpeed = async () => {
  try {
    const testFiles = [250000, 500000, 1000000];
    const results = [];

    for (const size of testFiles) {      
      const url = `${DOWNLOAD_TEST_URL}?cache=${Date.now()}`;
      const start = performance.now();
      const res = await fetch(url, { cache: "no-store" });
      await res.arrayBuffer();
      const end = performance.now();

      const seconds = (end - start) / 1000;
      const speedMbps = (size * 8) / (seconds * 1_000_000);
      results.push(speedMbps);
    }

    const download = results.reduce((a, b) => a + b, 0) / results.length;

    const pingavg = await testPing();

    return { download: Math.round(download), upload: 0, ping: pingavg };
  } catch (e) {
    console.error('测速失败', e);
    return { download: 0, upload: 0, ping: 0 };
  }
};

// 点击按钮执行测速
const runSpeedTest = async () => {
  loading.value = true;
  speedResult.value = null;

  try {
    const result = await testProxySpeed();
    speedResult.value = result;

    if (result.download > 0) {
     // Message.success(`测速完成：下载 ${result.download} Mbps`);
    } else {
      Message.error("测速失败");
    }
  } catch (e) {
    console.error("runSpeedTest error:", e);
    Message.error("测速失败");
  } finally {
    loading.value = false;
  }
};

</script>

<template>
  <a-layout class="popup">
    <a-layout-header>
      <section class="logo">
        <img src="/full-logo.svg" />
      </section>
    </a-layout-header>

  <!-- Mac 风格极细分割线 -->
  <a-divider style="margin: 2px 0;" />

	<section class="settings">
	  <a-button-group type="text" size="large">
	    <a-button
	      :class="{ active: activeSetting === 'config' }"
	      @click="activeSetting = 'config'; jumpTo({ name: 'profile.home' })"
	    >
	      <template #icon><icon-tool /></template>
	      配  置
	    </a-button>
	    <a-button
	      :class="{ active: activeSetting === 'ip' }"
	      @click="activeSetting = 'ip'; openIPCheck()"
	    >
	      <template #icon><icon-desktop /></template>
	      IP检测
	    </a-button>        
      <a-button @click="runSpeedTest" :loading="loading">
      <template #icon><IconScan /></template>
      测速
      </a-button>

	  </a-button-group>

	</section>

  <!-- Mac 风格极细分割线 -->
  <a-divider style="margin: 4px 0;" />

    <a-layout-content class="profiles">
      <a-menu class="top-actions-menu" :selected-keys="selectedKeys">
        <!-- 直连（绕过系统） -->
        <a-menu-item
          :key="SystemProfile.DIRECT.profileID"
          @click.prevent="() => { activeSetting = ''; setProxyByProfile(SystemProfile.DIRECT) }"          
        >
          <template #icon>
            <span class="menu-icon-holder"><icon-swap /></span>
          </template>
          直连上网
        </a-menu-item>

        <!-- 系统代理（继承 OS） -->
        <a-menu-item
          :key="SystemProfile.SYSTEM.profileID"
          @click.prevent="() => { activeSetting = ''; setProxyByProfile(SystemProfile.SYSTEM) }"          
        >
          <template #icon>
            <span class="menu-icon-holder">
              <span
                v-if="systemProxyMode === 'system'"
                class="sys-dot sys-on"
              />
              <span
                v-else-if="
                  systemProxyMode === 'fixed_servers' ||
                  systemProxyMode === 'pac_script'
                "
                class="sys-dot sys-custom"
              />
              <span v-else class="sys-dot sys-off" />
            </span>
          </template>
           系统代理
        </a-menu-item>


	    <ThemeSwitcher size="large" />
	     </a-menu>

        <!-- 当前出口信息：放到“直连上网 / 系统代理”下面 -->
        <div v-if="currentExitInfo" class="exit-info top-exit-info">
          当前出口：
          <span class="exit-ip">{{ currentExitInfo.ip }}</span>          
          <span class="exit-city">
            {{ currentExitInfo.city || currentExitInfo.country }}
          </span>
         <span class="exit-flag">{{ currentExitInfo.flag }}</span>    
        </div>
        <!-- 测速结果 -->
        <div v-if="speedResult" class="exit-info top-exit-info">        
          测速结果：
          <span>download: {{ speedResult.download }} Mbs  ping: {{ speedResult.ping }} ms</span>
          <!-- 上传: {{ speedResult.upload }} Mbs -->
        </div>



        <!-- Mac 风格极细分割线 -->
        <a-divider style="margin: 4px 0;" />
        <a-menu class="profile-list-menu" :selected-keys="selectedKeys">

        <!-- 用户 profile 列表 -->
        <a-menu-item
          v-for="item in profiles"
          :key="item.profileID"
          @click.prevent="() => { activeSetting = ''; setProxyByProfile(item) }"
          class="custom-profiles"
          :style="{ '--indicator-color': item.color || '#999' }"          
        >
          <template #icon>
            <span
              v-if="profileCountries[item.profileID]"
              class="flag-icon"
              :title="profileCountries[item.profileID].name"
            >
              {{ profileCountries[item.profileID].flag }}
            </span>
            <span v-else class="color-indicator"></span>
          </template>

          <span class="profile-text">
            {{ item.profileName }}
            <span
              v-if="profileCountries[item.profileID]?.city"
              class="profile-city"
            >
              · {{ profileCountries[item.profileID].city }}
            </span>
          </span>
        </a-menu-item>
      </a-menu>
    </a-layout-content>

  </a-layout>
</template>

<style lang="scss">
/* popup 本身不滚动，高度由 index.html 决定 */
.popup {
  display: flex;
  flex-direction: column;
  width:  100%;     /* 控制主界面宽度 */
  height: auto;    /* 控制主界面高度 */
  max-height: 100%;
  overflow: hidden;
}

/* 生效 Mac 风格：中间列表滚动，细行高 */
.profiles {
    overflow-y: auto;
    height: auto;

  :deep(.arco-divider-horizontal) {
    margin: 4px 0;
    border-top: 0.5px solid rgba(255, 255, 255, 0.06);
  }

  .arco-menu-inner {
    padding-left: 0;

    .arco-menu-item {
      position: relative;
      padding: 6px 12px !important;   /* 行高更紧凑 */
      min-height: 32px !important;
      font-size: 13px;
      line-height: 16px;

      .profile-text {
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
      }

      .profile-city {
        font-size: 11px;
        color: var(--color-text-3);
      }

      .color-indicator {
        display: inline-block;
        width: 0.85em;
        height: 0.85em;
        border-radius: 50%;
        background-color: var(--indicator-color, #999);
        margin-right: 6px;
      }

      .flag-icon {
        font-size: 1.1em;
        margin-right: 6px;
        line-height: 1;
      }

      &.custom-profiles::before {
        content: "";
        display: block;
        height: 100%;
        width: 4px;
        background-color: var(--indicator-color, #999);
        position: absolute;
        left: 0;
        top: 0;
        border-radius: 0 3px 3px 0;
      }

      &:hover {
        background-color: rgba(var(--primary-6), 0.1) !important;
      }
    }

    .arco-menu-item.arco-menu-item-active {
      background-color: rgba(var(--primary-6), 0.25) !important;
      font-weight: 600;
      color: var(--color-text-1) !important;
      .profile-text,
      .profile-city {
        color: var(--color-text-1) !important;
        opacity: 1;
    }

      &.custom-profiles::before {
        background-color: rgb(var(--primary-6)) !important;
      }
    }
  }
}

/* 统一 icon 占位宽度，保证直连 & 系统代理左对齐 */
.menu-icon-holder {
  display: inline-flex;
  width: 20px;
  justify-content: center;
  align-items: center;
}

/* 系统代理圆点 */
.sys-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.sys-on {
  background-color: #4caf50;
}
.sys-custom {
  background-color: #ff9800;
}
.sys-off {
  background-color: #cccccc;
}

.logo {
  text-align: center;
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
  background-color: var(--color-bg-4);
  padding: 0.6em 0.4em;

  img {
    max-height: 2.6em;
  }
}

/* 顶部 2 个动作横向排列：直连 / 系统代理  */
.top-actions-menu {
  background: transparent;
  .arco-menu-item.arco-menu-item-active {
    color: var(--color-text-1) !important;
    font-weight: 600;
  }

  .arco-menu-inner {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 0.2em 0.6em 0.4em !important;
  }

  .arco-menu-item {
    flex: 1;
    justify-content: center;
    padding: 6px 8px !important;
    min-height: 32px !important;
    white-space: nowrap;
  }
}

.settings .arco-btn {
  color: var(--color-text-1) !important;
}

.settings .arco-btn.active {
  color: rgb(var(--primary-6)) !important;
}

.profile-list-menu {
  height: 260px;
  overflow-y: auto !important;
  padding-bottom: 4px;
}

/* 当前出口信息：显示在“直连上网 / 系统代理”下面 */
.top-exit-info {
  padding: 0 12px 4px;
  margin-top: -2px;
  font-size: 11px;
  color: var(--color-text-3);
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 4px;

  .exit-ip {
    font-family: monospace;
    color: #006400; /* 深绿色 */
  }

  .exit-flag {
    font-size: 13px;
    color: #006400; /* 深绿色 */
  }

  .exit-city {
    opacity: 0.9;
    color: #006400; /* 深绿色 */
  }
}

.settings {
  padding: 0.2em 0.6em 0.4em;
  text-align: center;
  border-top: 0.5px solid rgba(255, 255, 255, 0.08);
  background-color: var(--color-bg-5);
}
</style>
