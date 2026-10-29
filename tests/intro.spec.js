const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const supabaseMock=fs.readFileSync(path.join(__dirname,'fixtures/supabase-mock.js'),'utf8');
const iconNames=['Trophy','SendHorizontal','LogIn','Menu','X','UserRound','UserPlus','LogOut','Settings','Users','GitBranch','Globe2','ClipboardList','CalendarDays','Gamepad2','ExternalLink','Eye','EyeOff','Pencil','Trash2','Check','XCircle','Upload','Image','Save','Shield','CircleDot','Clock3','Swords','LayoutDashboard','ScrollText','ChevronRight','Plus','LockKeyhole','UserCheck','UserX','ListChecks','CircleUserRound','ArrowRight','BadgeCheck','CircleCheck','CircleX','ClipboardPlus','ImagePlus','Images','LoaderCircle','ShieldCheck','Type','Search'];
const lucideMock='export function createIcons(){};'+iconNames.map(name=>`export const ${name}={};`).join('');

async function mockServices(page,mock=supabaseMock){
  await page.route('https://esm.sh/@supabase/**',route=>route.fulfill({contentType:'application/javascript',body:mock}));
  await page.route('https://esm.sh/lucide**',route=>route.fulfill({contentType:'application/javascript',body:lucideMock}));
}

test.describe('with motion enabled',()=>{
  test.use({reducedMotion:'no-preference',viewport:{width:390,height:844}});

  test('a short branded intro precedes usable content and follows custom branding',async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await mockServices(page,supabaseMock.replace("site_name:'AHLTV'","site_name:'RIVNE'"));
    await page.goto('/?mock=login',{waitUntil:'commit'});
    const intro=page.locator('#siteIntro');
    await expect(intro).toBeVisible({timeout:1000});
    const box=await intro.boundingBox();
    expect(box).toMatchObject({x:0,y:0,width:390,height:844});
    await expect(intro.locator('.brand-copy strong')).toHaveText('RIVNE');
    await expect(intro).toBeHidden({timeout:1700});
    await expect(page.locator('.event-card')).toHaveCount(2);
    await page.locator('#menuBtn').click();
    await expect(page.locator('#mobileDrawer')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('internal navigation skips the intro, reload plays it, and back stays fast',async({page})=>{
    await mockServices(page);
    await page.goto('/?mock=login');
    await expect(page.locator('#siteIntro')).toBeHidden();
    await page.locator('.hero-secondary').click();
    await expect(page).toHaveURL(/apply\.html/);
    expect(await page.evaluate(()=>({referrer:document.referrer,active:document.documentElement.classList.contains('intro-active')}))).toMatchObject({active:false});
    await page.reload({waitUntil:'commit'});
    await expect(page.locator('#siteIntro')).toBeVisible({timeout:1000});
    await expect(page.locator('#siteIntro')).toBeHidden({timeout:1700});
    await page.goBack();
    expect(await page.evaluate(()=>document.documentElement.classList.contains('intro-active'))).toBe(false);
    await expect(page.locator('#homeTitle')).toBeVisible();
  });

  test('direct entry works on the application, tournament and account pages',async({page})=>{
    await mockServices(page);
    for(const url of ['/apply.html?mock=login','/tournament.html?id=1&mock=login','/admin.html?mock=login']){
      await page.goto(url,{waitUntil:'commit'});
      await expect(page.locator('#siteIntro'),url).toBeVisible({timeout:1000});
      await expect(page.locator('#siteIntro'),url).toBeHidden({timeout:1700});
      await expect(page.locator('#menuBtn'),url).toBeVisible();
    }
  });

  test('scroll reveals, long sections and expanded details stay usable with motion',async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await mockServices(page);
    await page.setViewportSize({width:320,height:568});
    await page.goto('/?mock=long');
    await expect(page.locator('#siteIntro')).toBeHidden();
    const sections=[page.locator('.section-heading').first(),page.locator('.event-card').first(),page.locator('.journey'),page.locator('.home-cta')];
    for(const section of sections){
      await section.scrollIntoViewIfNeeded();
      await expect(section).toHaveClass(/is-visible/);
      await expect.poll(()=>section.evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
    }
    await page.locator('.event-disclosure summary').first().click();
    await expect(page.locator('.event-team-list').first()).toBeVisible();
    expect(await page.locator('.event-team-list').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('contentUnfold');
    await page.evaluate(()=>{
      const section=document.createElement('section');section.id='tall-motion-test';section.className='panel';section.style.height='20000px';document.querySelector('main').append(section);
      section.scrollIntoView({block:'start',behavior:'instant'});
    });
    await expect(page.locator('#tall-motion-test')).toHaveClass(/is-visible/);
    await expect.poll(()=>page.locator('#tall-motion-test').evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
    expect(errors).toEqual([]);
  });

  test('the overlay clears by itself even if the startup script stops early',async({page})=>{
    await mockServices(page);
    await page.route('**/intro.js?*',route=>route.fulfill({contentType:'application/javascript',body:"document.documentElement.classList.add('intro-active');"}));
    await page.goto('/?mock=login',{waitUntil:'commit'});
    await expect(page.locator('#siteIntro')).toBeVisible({timeout:1000});
    await expect(page.locator('#siteIntro')).toBeHidden({timeout:1700});
    await expect(page.locator('#siteIntro')).toHaveCount(1);
    await page.locator('#menuBtn').click();
    await expect(page.locator('#mobileDrawer')).toBeVisible();
  });

  test('the intro does not wait for slow third-party modules',async({page})=>{
    let release,requests=0;
    const stalled=new Promise(resolve=>{release=resolve});
    await page.route('https://esm.sh/**',async route=>{
      requests++;
      await stalled;
      await route.abort().catch(()=>{});
    });
    try{
      await page.goto('/?mock=login',{waitUntil:'commit'});
      await expect(page.locator('#siteIntro')).toBeVisible({timeout:1000});
      await expect(page.locator('#siteIntro')).toBeHidden({timeout:1700});
      await expect(page.locator('#homeTitle')).toBeVisible();
      expect(requests).toBeGreaterThan(0);
    }finally{release()}
  });

  test('failed startup and external modules never leave a cover on the site',async({page})=>{
    await page.route('**/intro.js?*',route=>route.abort());
    await page.route('https://esm.sh/**',route=>route.abort());
    await page.goto('/?mock=login');
    await expect(page.locator('#siteIntro')).toBeHidden();
    await expect(page.locator('#homeTitle')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.classList.contains('intro-active'))).toBe(false);
    await expect(page.locator('.hero-secondary')).toHaveAttribute('href','apply.html');
  });
});

test('reduced motion skips the intro and disables animated content',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await mockServices(page);
  await page.goto('/?mock=login');
  await expect(page.locator('#siteIntro')).toBeHidden();
  expect(await page.evaluate(()=>({active:document.documentElement.classList.contains('intro-active'),scroll:getComputedStyle(document.documentElement).scrollBehavior,animation:getComputedStyle(document.querySelector('main')).animationName}))).toEqual({active:false,scroll:'auto',animation:'none'});
  await expect(page.locator('#homeTitle')).toBeVisible();
  await page.locator('.event-disclosure summary').first().click();
  expect(await page.locator('.event-team-list').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});

test.describe('with JavaScript disabled',()=>{
  test.use({javaScriptEnabled:false,reducedMotion:'no-preference'});
  test('the decorative intro remains hidden and content is not blocked',async({page})=>{
    await page.goto('/');
    await expect(page.locator('#siteIntro')).toBeHidden();
    await expect(page.locator('#homeTitle')).toBeVisible();
    await expect(page.locator('.hero-secondary')).toHaveAttribute('href','apply.html');
  });
});
