const {defineConfig}=require('@playwright/test');

const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
module.exports=defineConfig({
  testDir:'./tests',
  timeout:120_000,
  workers:1,
  reporter:'list',
  use:{
    baseURL:'http://127.0.0.1:4174',
    headless:true,
    reducedMotion:'reduce',
    launchOptions:executablePath?{
      executablePath,
      args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage','--disable-site-isolation-trials']
    }:{}
  },
  webServer:{
    command:'python3 -m http.server 4174 --bind 127.0.0.1',
    url:'http://127.0.0.1:4174/admin.html',
    reuseExistingServer:!process.env.CI
  }
});
