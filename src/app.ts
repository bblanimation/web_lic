import Vue from 'vue';
import ElementUI from 'element-ui';
import locale from 'element-ui/lib/locale/lang/en';
// import 'element-ui/lib/theme-chalk/index.css';  // TODO: Make this work
import './components/element_extensions';

import UI from './ui.vue';
import _ from './util';
import {tr} from './translations';

Vue.use(ElementUI, {locale});

Vue.config.performance = false;

Vue.use({
	install(vue) {
		// Add a 'tr' method to every component, which makes translating strings in template HTML easier
		vue.prototype.tr = tr;
		vue.prototype._ = _;
	},
});

const app = new Vue({
	render: h => {
		return h(UI, {ref: 'app'});
	},
}).$mount('#app');

declare global {
	interface Window {__lic: any;}
}

window.__lic.app = app.$refs.app;
