// ES2024 Map / Math.sumPrecise polyfills.
// This MUST run before pdf.js is imported anywhere in the bundle, otherwise
// pdf.js 6.x throws "getOrInsertComputed is not a function" and renders nothing.
import './utils/polyfills.js';

import { createApp } from 'vue';
import './style.css';
import 'highlight.js/styles/github-dark.css';
import App from './App.vue';

createApp(App).mount('#app');
