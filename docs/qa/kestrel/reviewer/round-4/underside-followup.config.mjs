export default {
 testDir:'.',testMatch:'underside-followup.spec.mjs',timeout:60000,workers:1,reporter:'list',
 outputDir:'./underside-followup-output',
 use:{baseURL:'http://127.0.0.1:5292',viewport:{width:1440,height:900},
  launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist','--disable-dev-shm-usage']}}
};
