<script setup lang="ts">
import { computed } from "vue";
import "@arco-design/web-vue/es/resize-box/style/index.css";
import {
  IconSettings,
  IconRelation,
  IconPlus,
  IconEdit,
  IconSwap,
  IconDragDot,
} from "@arco-design/web-vue/es/icon";
import { onMounted, ref } from "vue";

import {
  ProfilesStorage,
  listProfiles,
  onProfileUpdate,
  saveManyProfiles,
  deleteProfile,
  saveProfile,
} from "../services/profile";

import ThemeSwitcher from "../components/controls/ThemeSwitcher.vue";

//script 增加
import draggable from "vuedraggable";

const dragList = ref([]);
const showSortModal = ref(false);

//打开排序时初始化
const sortCache = ref<any[]>([]);
const openSortModal = () => {
  const source =
    sortCache.value.length > 0 ? sortCache.value : sortedProfiles.value;
  dragList.value = source.map((p: any) => ({ ...p }));
  showSortModal.value = true;
};

const sortedProfiles = computed(() => {
  return [...Object.values(profiles.value)].sort((a: any, b: any) => {
    return Number(a.order ?? 9999) - Number(b.order ?? 9999);
  });
});

const confirmSort = async () => {
  dragList.value.forEach((p: any, index) => {
    p.order = index;

    if (p.proxyRules) {
      if (Array.isArray(p.proxyRules.bypassList)) {
      } else if (typeof p.proxyRules.bypassList === "string") {
        p.proxyRules.bypassList = p.proxyRules.bypassList
          .split("\n")
          .map((x: string) => x.trim())
          .filter(Boolean);
      } else {
        p.proxyRules.bypassList = [];
      }
    }
  });

  sortCache.value = dragList.value.map((p: any) => ({ ...p }));
  await saveManyProfiles(dragList.value as any);
  profiles.value = await listProfiles();
  showSortModal.value = false;
};

const resetSort = () => {
  sortCache.value = [];
  dragList.value = sortedProfiles.value.map((p: any) => ({ ...p }));
};

const profiles = ref<ProfilesStorage>({});

// 强制主界面刷新 profiles
onMounted(async () => {
  profiles.value = await listProfiles();
});

onProfileUpdate((p) => {
  profiles.value = p;
});
</script>

<template>
  <a-layout class="config-layout">
    <a-layout-sider :resize-directions="['right']" class="sidebar">
      <div class="sidebar-container">
        <section class="logo">
          <img src="/full-logo.svg" />
        </section>

        <section class="settings">
          <a-button-group type="text" size="large">
            <a-tooltip :content="$t('nav_preference')" position="bottom">
              <a-button
                class="btn-preference"
                @click="$router.push({ name: 'preference' })"
              >
                <template #icon>
                  <icon-settings size="large" />
                </template>
              </a-button>
            </a-tooltip>
            <a-tooltip content="排序代理" position="bottom">
              <a-button class="btn-sort" @click.stop="openSortModal">
                <template #icon>
                  <icon-swap />
                </template>
              </a-button>
            </a-tooltip>
            <ThemeSwitcher size="large" />
          </a-button-group>
        </section>

        <section class="menu">
          <a-menu :selected-keys="[$route.path]">
            <RouterLink :to="{ name: 'profile.home' }" v-if="false">
              <a-menu-item
                :key="$router.resolve({ name: 'profile.home' }).path"
              >
                <template #icon><icon-relation /></template>
                {{ $t("mode_auto_switch") }}
              </a-menu-item>
            </RouterLink>

            <RouterLink :to="{ name: 'profile.create' }">
              <a-menu-item
                :key="$router.resolve({ name: 'profile.create' }).path"
              >
                <template #icon><icon-plus /></template>
                {{ $t("mode_profile_create") }}
              </a-menu-item>
            </RouterLink>

            <RouterLink
              v-for="item in sortedProfiles"
              :key="item.profileID"
              :to="{ name: 'profile.custom', params: { id: item.profileID } }"
            >
              <a-menu-item
                :key="
                  $router.resolve({
                    name: 'profile.custom',
                    params: { id: item.profileID },
                  }).path
                "
                class="custom-profiles"
                :style="{ '--indicator-color': item.color }"
              >
                <template #icon><span class="color-indicator"></span></template>
                {{ item.profileName }}
                <icon-edit class="icon-edit" />
              </a-menu-item>
            </RouterLink>
          </a-menu>
        </section>
      </div>
    </a-layout-sider>

    <a-layout class="content-wrapper">
      <a-layout-content>
        <RouterView :key="$route.fullPath" />
      </a-layout-content>
      <a-layout-footer>
        <a-typography-text type="secondary"
          >made by
          <a-link :hoverable="false" href="https://byte.vet">ByteVet</a-link>
          with ❤️</a-typography-text
        >
      </a-layout-footer>
    </a-layout>
  </a-layout>

  <!-- 拖拽 UI -->
  <a-modal v-model:visible="showSortModal" title="拖拽排序代理" width="500px">
    <div style="margin-bottom: 10px; color: red">
      {{ debugText }}
    </div>
    <draggable v-model="dragList" item-key="profileID" animation="200">
      <template #item="{ element }">
        <div class="drag-item">
          <IconDragDot style="margin-right: 8px" />
          {{ element.profileName }}
        </div>
      </template>
    </draggable>

    <template #footer>
      <a-button type="primary" @click="confirmSort">确定</a-button>
      <a-button @click="resetSort">重置</a-button>
      <a-button @click="showSortModal = false">关闭</a-button>
    </template>
  </a-modal>
</template>

<style lang="scss">
.config-layout {
  background-color: var(--color-bg-1);

  .sidebar {
    background-color: var(--color-bg-3);

    width: 24em;
    min-width: 18em;
    max-width: 36em;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    min-height: 100vh;

    > .arco-layout-content {
      flex: 1;
    }

    > .arco-layout-footer {
      text-align: center;
      padding: 0.5em;
    }
  }
}

.sidebar-container {
  .logo {
    text-align: center;
    line-height: 64px;
    padding-bottom: 1em;

    img {
      vertical-align: middle;
      max-height: 48px;
    }
  }

  .settings {
    padding: 0.5em;
    text-align: center;
    border-top: var(--color-border-1) 1px solid;
    border-bottom: var(--color-border-1) 1px solid;

    .arco-btn {
      color: var(--color-text-2);
    }
  }
}

.custom-profiles {
  .color-indicator {
    display: inline-block;
    width: 1em;
    height: 1em;
    background-color: var(--indicator-color);

    border-radius: 0.5em;
    vertical-align: top;
    box-shadow: 0px 1px 4px var(--color-border-3);
  }

  .icon-edit {
    display: none;
  }

  &:hover .icon-edit {
    display: inline-block;
  }
}

.drag-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 6px;
  background: var(--color-bg-2);
  border-radius: 6px;
  cursor: move;
}

.drag-item:hover {
  background: rgba(var(--primary-6), 0.15);
}

.btn-preference {
  margin-right: 16px; // 与后面的按钮间距
}

.btn-sort {
  margin-right: 16px; // 如果后面还有按钮
}
</style>
