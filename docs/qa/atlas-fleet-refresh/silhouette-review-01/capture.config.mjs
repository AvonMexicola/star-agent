export default {
 testDir: new URL('.', import.meta.url).pathname, testMatch:'capture.spec.mjs',
 timeout:120000, workers:1, reporter:'list',
 outputDir:new URL('test-output', import.meta.url).pathname,
 use:{baseURL:'http://127.0.0.1:5395',viewport:{width:1440,height:900},deviceScaleFactor:1,
 launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist','--disable-dev-shm-usage']}}
};
