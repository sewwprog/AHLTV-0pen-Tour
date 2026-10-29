const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const supabaseMock=fs.readFileSync(path.join(__dirname,'fixtures/supabase-mock.js'),'utf8');
const iconNames=['Trophy','SendHorizontal','LogIn','Menu','X','UserRound','UserPlus','LogOut','Settings','Users','GitBranch','Globe2','ClipboardList','CalendarDays','Gamepad2','ExternalLink','Eye','EyeOff','Pencil','Trash2','Check','XCircle','Upload','Image','Save','Shield','CircleDot','Clock3','Swords','LayoutDashboard','ScrollText','ChevronRight','Plus','LockKeyhole','UserCheck','UserX','ListChecks','CircleUserRound','ArrowRight','BadgeCheck','CircleCheck','CircleX','ClipboardPlus','ImagePlus','Images','LoaderCircle','ShieldCheck','Type','Search'];
const lucideMock='export function createIcons(){};'+iconNames.map(name=>`export const ${name}={};`).join('');
const radius=locator=>locator.evaluate(el=>getComputedStyle(el).borderTopLeftRadius);

test('sharper corners stay consistent across pages and breakpoints without squaring circular accents',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://esm.sh/@supabase/**',route=>route.fulfill({contentType:'application/javascript',body:supabaseMock}));
  await page.route('https://esm.sh/lucide**',route=>route.fulfill({contentType:'application/javascript',body:lucideMock}));
  await page.route('https://example.com/**',route=>route.fulfill({status:200,body:''}));
  await page.goto('/?mock=login');
  await expect(page.locator('.event-card')).toHaveCount(2);

  for(const width of [320,390,700,701,1440]){
    await page.setViewportSize({width,height:844});
    expect(await radius(page.locator('.home-hero')),`${width}px hero`).toBe('8px');
    expect(await radius(page.locator('.event-card').first()),`${width}px card`).toBe('6px');
    expect(await radius(page.locator('.hero-primary')),`${width}px button`).toBe('4px');
    expect(await radius(page.locator('.hero-kicker-dot')),`${width}px dot`).toBe('50%');
    expect(await radius(page.locator('.event-status>span').first()),`${width}px status`).toBe('50%');
    const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    expect(dimensions.scroll,`${width}px`).toBeLessThanOrEqual(dimensions.width+1);
    if(width<=700){
      await page.locator('#menuBtn').click();
      expect(await radius(page.locator('#mobileDrawer')),`${width}px sheet`).toBe('12px');
      expect(await radius(page.locator('#mobileDrawer nav a').first()),`${width}px menu item`).toBe('6px');
      expect(await radius(page.locator('#drawerClose')),`${width}px close`).toBe('4px');
      expect(await radius(page.locator('.drawer-grip')),`${width}px grip`).toBe('99px');
      expect((await page.locator('#drawerClose').boundingBox()).height).toBeGreaterThanOrEqual(44);
      await page.locator('#drawerClose').click();
    }
  }

  await page.setViewportSize({width:390,height:844});
  await page.goto('/apply.html?tournament=1&mock=user');
  await expect(page.locator('#applicationContent')).toBeVisible();
  await expect(page.locator('#tournamentSelect')).not.toHaveValue('');
  expect(await radius(page.locator('.apply-title'))).toBe('8px');
  expect(await radius(page.locator('.apply-panel').first())).toBe('8px');
  expect(await radius(page.locator('#tournamentSelect'))).toBe('4px');

  await page.goto('/tournament.html?id=1&mock=login');
  await expect(page.locator('#tournamentHero h1')).toBeVisible();
  expect(await radius(page.locator('#tournamentHero'))).toBe('8px');
  expect(await radius(page.locator('.detail-logo'))).toBe('6px');

  await page.goto('/admin.html?mock=admin');
  await expect(page.locator('#overviewTournaments')).toHaveText('3');
  expect(await radius(page.locator('.overview-intro'))).toBe('6px');
  expect(await radius(page.locator('.overview-stat').first())).toBe('6px');
  expect(await radius(page.locator('#adminSectionSelect'))).toBe('4px');
  await page.locator('#adminSectionSelect').selectOption('applicationsTab');
  await expect(page.locator('.application')).toHaveCount(5);
  expect(await radius(page.locator('.application').first())).toBe('6px');
  expect(await radius(page.locator('.application-filter').first())).toBe('6px');
  await page.setViewportSize({width:1440,height:900});
  expect(await radius(page.locator('.admin-sidebar'))).toBe('8px');
  expect(await radius(page.locator('#logoutBtn'))).toBe('4px');
  expect(errors).toEqual([]);
});
