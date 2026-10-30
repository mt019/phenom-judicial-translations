import {createApp,createSSRApp} from 'vue';import {bootSitePalette,STATIC_QUERY_HYDRATION} from '@phenomcanvas/ui-vue';
import './tailwind.css';import '@phenomcanvas/ui-vue/legacy/0.1.31/styles.css';import App from './App.jsx';import {makeRouter} from './router.js';
bootSitePalette();const router=makeRouter();const root=document.getElementById('root');const app=(root.hasChildNodes()?createSSRApp:createApp)(App);app.provide(STATIC_QUERY_HYDRATION,true);app.use(router);await router.isReady();app.mount(root);
