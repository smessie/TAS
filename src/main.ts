import "mdb-vue-ui-kit/css/mdb.min.css";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";

import "./assets/main.css";
import moment from "moment";

const app = createApp(App);

app.use(router);

app.mount("#app");

app.config.globalProperties.$filters = {
  formatDate(value: string) {
    return moment(String(value)).format("MM/DD/YYYY HH:mm");
  },
};
