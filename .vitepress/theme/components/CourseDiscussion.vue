<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useData, useRoute } from "vitepress";

const route = useRoute();
const { frontmatter, isDark } = useData();
const giscusHost = ref<HTMLElement>();

const giscusConfig = {
  repo: "ricoNext/Agent101",
  repoId: "R_kgDOTsKqZg",
  category: "课程讨论",
  categoryId: "DIC_kwDOTsKqZs4DDICc",
};

const isLessonPage = computed(() =>
  /^\/course\/core\/chapter-[^/]+\/lesson-[^/]+(?:\.html)?$/.test(route.path),
);

const isFoundationArticle = computed(
  () =>
    route.path.startsWith("/foundations/") &&
    route.path !== "/foundations/" &&
    route.path !== "/foundations/index.html",
);

const isDiscussionEnabled = computed(() => {
  if (typeof frontmatter.value.discussion === "boolean") {
    return frontmatter.value.discussion;
  }

  return isLessonPage.value || isFoundationArticle.value;
});

function getGiscusTheme() {
  return isDark.value ? "dark_dimmed" : "light";
}

async function renderGiscus() {
  await nextTick();

  if (!isDiscussionEnabled.value || !giscusHost.value) {
    return;
  }

  giscusHost.value.replaceChildren();

  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.async = true;
  script.crossOrigin = "anonymous";
  script.setAttribute("data-repo", giscusConfig.repo);
  script.setAttribute("data-repo-id", giscusConfig.repoId);
  script.setAttribute("data-category", giscusConfig.category);
  script.setAttribute("data-category-id", giscusConfig.categoryId);
  script.setAttribute("data-mapping", "pathname");
  script.setAttribute("data-strict", "0");
  script.setAttribute("data-reactions-enabled", "1");
  script.setAttribute("data-emit-metadata", "0");
  script.setAttribute("data-input-position", "bottom");
  script.setAttribute("data-theme", getGiscusTheme());
  script.setAttribute("data-lang", "zh-CN");
  script.setAttribute("data-loading", "lazy");

  giscusHost.value.append(script);
}

function updateGiscusTheme() {
  const iframe = giscusHost.value?.querySelector<HTMLIFrameElement>(
    "iframe.giscus-frame",
  );

  iframe?.contentWindow?.postMessage(
    {
      giscus: {
        setConfig: {
          theme: getGiscusTheme(),
        },
      },
    },
    "https://giscus.app",
  );
}

onMounted(renderGiscus);

watch(
  () => [route.path, isDiscussionEnabled.value],
  () => renderGiscus(),
);

watch(isDark, updateGiscusTheme);
</script>

<template>
  <section
    v-if="isDiscussionEnabled"
    class="course-discussion"
    aria-labelledby="course-discussion-title"
  >
    <h2 id="course-discussion-title" class="course-discussion__title">
      课程讨论
    </h2>
    <div ref="giscusHost" class="giscus" />
  </section>
</template>

<style scoped>
.course-discussion {
  margin-top: 48px;
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 24px;
}

.course-discussion__title {
  margin: 0 0 24px;
  color: var(--vp-c-text-1);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0;
}

.giscus {
  min-height: 150px;
}
</style>
