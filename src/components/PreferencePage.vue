<script setup lang="ts">
import { Host } from "@/adapters";
import { config2json, json2config } from "@/services/config/schema";
import { listProfiles, saveManyProfiles } from "@/services/profile";
import { useFileDialog } from "@vueuse/core";
import { Notification } from "@arco-design/web-vue";
import {
  IconSettings,
  IconDownload,
  IconImport,
} from "@arco-design/web-vue/es/icon";

// for import
const { open, reset, onChange } = useFileDialog({
  multiple: false,
  accept: "application/json",
  directory: false,
});

onChange(async (file) => {
  if (!file || file.length === 0) {
    return;
  }

  const profiles = json2config(await file[0].text());

  profiles.forEach((p: any, index: number) => {
    if (p.order === undefined || p.order === null) {
      p.order = index;
    }
  });

  // 按 order 排序
  profiles.sort((a: any, b: any) => (a.order ?? 9999) - (b.order ?? 9999));

  const COLORS = [
    "#409EFF", // 蓝
    "#67C23A", // 绿
    "#E6A23C", // 橙
    "#F56C6C", // 红
    "#9B59B6", // 紫
    "#1ABC9C", // 青绿
    "#E74C3C", // 深红
    "#2ECC71", // 鲜绿
    "#3498DB", // 深蓝
    "#F39C12", // 深橙
    "#8E44AD", // 深紫
    "#16A085", // 深青
    "#C0392B", // 酒红
    "#27AE60", // 森林绿
    "#2980B9", // 海蓝
    "#D35400", // 焦橙
    "#7F8C8D", // 灰（备用）
  ];

  const usedColors = new Set<string>();

  const colorDistance = (a: string, b: string) => {
    const ar = parseInt(a.slice(1, 3), 16);
    const ag = parseInt(a.slice(3, 5), 16);
    const ab = parseInt(a.slice(5, 7), 16);

    const br = parseInt(b.slice(1, 3), 16);
    const bg = parseInt(b.slice(3, 5), 16);
    const bb = parseInt(b.slice(5, 7), 16);

    return Math.sqrt(
      Math.pow(ar - br, 2) + Math.pow(ag - bg, 2) + Math.pow(ab - bb, 2),
    );
  };

  const getNextColor = (
    used: Set<string>,
    index: number,
    prevColor?: string,
  ) => {
    const minDistance = 100;

    for (let i = 0; i < COLORS.length; i++) {
      const color = COLORS[(index + i) % COLORS.length];

      if (used.has(color)) continue;

      if (!prevColor || colorDistance(color, prevColor) >= minDistance) {
        return color;
      }
    }

    for (let i = 0; i < COLORS.length; i++) {
      const color = COLORS[(index + i) % COLORS.length];
      if (!used.has(color)) return color;
    }

    return COLORS[index % COLORS.length];
  };

  let prevColor = "";

  profiles.forEach((p, index) => {
    if (
      !p.color ||
      usedColors.has(p.color) ||
      (prevColor && colorDistance(p.color, prevColor) < 90)
    ) {
      p.color = getNextColor(usedColors, index, prevColor);
    }

    usedColors.add(p.color);
    prevColor = p.color;
  });

  await saveManyProfiles(profiles);
  Notification.success({
    content: Host.getMessage(
      "preferences_feedback_n_profiles_being_imported",
      profiles.length.toString(),
    ),
  });
  reset();
});

const exportProfiles = async () => {
  const profiles = await listProfiles();
  if (!profiles) {
    Notification.warning({
      content: Host.getMessage(
        "preferences_feedback_no_profile_to_be_exported",
      ),
    });
    return;
  }

  const sortedProfiles = Object.fromEntries(
    Object.values(profiles)
      .sort(
        (a: any, b: any) => Number(a.order ?? 9999) - Number(b.order ?? 9999),
      )
      .map((p: any) => [p.profileID, p]),
  );
  try {
    const jsonStr = config2json(sortedProfiles as any);

    // download
    const obj = new Blob([jsonStr], { type: "application/json" });
    const fileURL = URL.createObjectURL(obj);

    const downloadLink = document.createElement("a");
    downloadLink.href = fileURL;
    downloadLink.download = "proxyverse.json";
    document.body.appendChild(downloadLink);
    downloadLink.click();

    // cleanup
    URL.revokeObjectURL(fileURL);
    document.body.removeChild(downloadLink);
  } catch (e: any) {
    Notification.error({
      content: Host.getMessage("config_feedback_error_occurred", e.toString()),
    });
  }
};
</script>

<template>
  <a-page-header
    :show-back="false"
    :style="{ background: 'var(--color-bg-2)' }"
  >
    <template #title>
      <a-space>
        <icon-settings />
        <span>{{ $t("nav_preference") }}</span>
      </a-space>
    </template>

    <section>
      <a-divider orientation="left">{{
        $t("preferences_section_import_export")
      }}</a-divider>

      <a-typography-paragraph type="secondary">{{
        $t("preferences_section_import_export_desc")
      }}</a-typography-paragraph>

      <a-space>
        <a-button @click.prevent="exportProfiles">
          <template #icon>
            <icon-download />
          </template>
          {{ $t("preferences_action_profile_export") }}
        </a-button>

        <a-popconfirm
          :content="$t('preferences_tips_profile_overwrite')"
          @ok="open"
        >
          <a-button>
            <template #icon>
              <icon-import />
            </template>
            {{ $t("preferences_action_profile_import") }}
          </a-button>
        </a-popconfirm>
      </a-space>
    </section>
  </a-page-header>
</template>
