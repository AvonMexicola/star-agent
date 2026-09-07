export default {
 testDir:'/tmp/star-agent-atlas-refresh/docs/qa/atlas-fleet-refresh/baseline-review',
 testMatch:'capture.spec.mjs',timeout:180000,workers:1,reporter:'list',
 outputDir:'/tmp/atlas-refresh-review-capture-output',
 use:{baseURL:'http://localhost:5250',viewport:{width:1440,height:900},
  launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist','--disable-dev-shm-usage']}}
};
