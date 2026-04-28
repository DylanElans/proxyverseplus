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
</script>

<template>
  <a-layout class="popup">
    <a-layout-header>
      <section class="logo">
        <img src="/full-logo.svg" />
      </section>
    </a-layout-header>

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

	</a-menu>

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

	    <a-divider direction="vertical" />
	    <ThemeSwitcher size="large" />
	  </a-button-group>

	  <div v-if="currentExitInfo" class="exit-info">
	    当前出口 IP：
	    <span class="exit-ip">{{ currentExitInfo.ip }}</span>
	    <span class="exit-flag">{{ currentExitInfo.flag }}</span>
	    <span class="exit-city">
	      {{ currentExitInfo.city || currentExitInfo.country }}
	    </span>
	  </div>
	</section>


        <!-- Mac 风格极细分割线 -->
        <a-divider />
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

.settings {
  padding: 0.2em 0.6em 0.4em;
  text-align: center;
  border-top: 0.5px solid rgba(255, 255, 255, 0.08);
  background-color: var(--color-bg-5);

  .exit-info {
    margin-top: 4px;
    font-size: 11px;
    color: var(--color-text-3);
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 4px;

    .exit-ip {
      font-family: monospace;
      font-size: 11px;
    }

    .exit-flag {
      font-size: 13px;
    }

    .exit-city {
      opacity: 0.9;
    }
  }
}
</style>
