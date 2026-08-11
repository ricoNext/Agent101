import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import CourseDiscussion from "./components/CourseDiscussion.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "doc-after": () => h(CourseDiscussion),
    }),
};
