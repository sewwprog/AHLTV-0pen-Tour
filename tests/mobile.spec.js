const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const supabaseMock=fs.readFileSync(path.join(__dirname,'fixtures/supabase-mock.js'),'utf8');
const iconNames=['Trophy','SendHorizontal','LogIn','Menu','X','UserRound','UserPlus','LogOut','Settings','Users','GitBranch','Globe2','ClipboardList','CalendarDays','Gamepad2','ExternalLink','Eye','EyeOff','Pencil','Trash2','Check','XCircle','Upload','Image','Save','Shield','CircleDot','Clock3','Swords','LayoutDashboard','ScrollText','ChevronRight','Plus','LockKeyhole','UserCheck','UserX','ListChecks','CircleUserRound','ArrowRight','BadgeCheck','CircleCheck','CircleX','ClipboardPlus','ImagePlus','Images','LoaderCircle','ShieldCheck'];
const lucideMock='export function createIcons(){};'+iconNames.map(name=>`export const ${name}={};`).join('');

test('mobile home and navigation work at phone, landscape and desktop sizes',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://esm.sh/@supabase/**',route=>route.fulfill({contentType:'application/javascript',body:supabaseMock}));
  await page.route('https://esm.sh/lucide**',route=>route.fulfill({contentType:'application/javascript',body:lucideMock}));
  await page.route('https://example.com/**',route=>route.fulfill({status:200,body:''}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?mock=login');
  await expect(page.locator('.event-card')).toHaveCount(2);

  await test.step('the real tournament list is prioritised and its controls still work',async()=>{
    const tournamentTop=await page.locator('#tournamentsSection').evaluate(el=>el.getBoundingClientRect().top);
    const journeyTop=await page.locator('.journey').evaluate(el=>el.getBoundingClientRect().top);
    expect(tournamentTop).toBeLessThan(journeyTop);
    await expect(page.locator('.hero-primary')).toHaveAttribute('href','#tournamentsSection');
    await page.locator('.hero-primary').click();
    const sectionTop=await page.locator('#tournamentsSection').evaluate(el=>el.getBoundingClientRect().top);
    expect(sectionTop).toBeGreaterThanOrEqual(60);
    const card=page.locator('.event-card').first();
    const summary=card.locator('.event-disclosure summary').first();
    await summary.focus();await page.keyboard.press('Enter');
    await expect(card.locator('.event-disclosure').first()).toHaveAttribute('open','');
    await expect(card.locator('.event-team')).not.toHaveCount(0);
    await card.locator('.event-matches summary').click();
    await expect(card.locator('.event-match')).toContainText('Nova Esports');
    await expect(card.locator('.event-actions .primary-btn')).toHaveAttribute('href','apply.html?tournament=1');
    await expect(card.locator('.event-actions .secondary-btn')).toHaveAttribute('href','tournament.html?id=1');
    for(const control of await card.locator('.event-actions a, .event-disclosure summary').all()){
      const box=await control.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await card.locator('.event-actions .secondary-btn').click();
    await expect(page).toHaveURL(/tournament\.html\?id=1/);
    await expect(page.locator('#tournamentHero h1')).toHaveText('AHLTV Open Tour: Season 04');
    await page.goBack();
    await page.locator('.event-card').first().locator('.event-actions .primary-btn').click();
    await expect(page).toHaveURL(/apply\.html\?tournament=1/);
    await expect(page.locator('#tournamentSelect')).toHaveValue('1');
    await page.goBack();
    await expect(page.locator('.event-card')).toHaveCount(2);
  });

  await test.step('menu is a labelled, accessible modal and returns focus',async()=>{
    const button=page.locator('#menuBtn'),drawer=page.locator('#mobileDrawer');
    await expect(button).toHaveText('Меню');
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expect(drawer).toHaveAttribute('inert','');
    await button.click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute('aria-hidden','false');
    await expect(button).toHaveAttribute('aria-expanded','true');
    await expect(drawer.locator('a[href="./"]')).toHaveAttribute('aria-current','page');
    for(const control of await drawer.locator('a, #drawerClose').all()){
      const box=await control.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator('#drawerClose')).toBeFocused();
    expect(await page.evaluate(()=>getComputedStyle(document.body).overflow)).toBe('hidden');
    await page.keyboard.press('Shift+Tab');
    await expect(drawer.locator('a[href="admin.html"]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#drawerClose')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveAttribute('inert','');
    await expect(drawer).toHaveAttribute('aria-hidden','true');
    await expect(button).toHaveAttribute('aria-expanded','false');
    await expect(button).toBeFocused();
    await button.click();
    await page.locator('#drawerBackdrop').click({position:{x:10,y:10}});
    await expect(drawer).toBeHidden();
  });

  await test.step('menu keeps working on the application, tournament and account pages',async()=>{
    for(const [url,current] of [['/apply.html?mock=login','apply.html'],['/tournament.html?id=1&mock=login',null],['/admin.html?mock=login','admin.html']]){
      await page.goto(url);
      await page.locator('#menuBtn').click();
      const drawer=page.locator('#mobileDrawer');
      await expect(drawer.locator('a')).toHaveCount(3);
      await expect(drawer.locator('a[href="./"]')).toBeVisible();
      await expect(drawer.locator('a[href="apply.html"]')).toBeVisible();
      await expect(drawer.locator('a[href="admin.html"]')).toContainText('Увійти');
      if(current)await expect(drawer.locator(`a[href="${current}"]`)).toHaveAttribute('aria-current','page');
      await page.locator('#drawerClose').click();
      await expect(drawer).toHaveAttribute('aria-hidden','true');
    }
    await page.locator('#email').fill('admin@ahltv.ua');
    await page.locator('#password').fill('password123');
    await page.locator('#authBtn').click();
    await expect(page.locator('#dashboardView')).toBeVisible();
    await expect(page.locator('#mobileDrawer [data-account-label]')).toHaveText('Акаунт');
    await page.locator('#logoutBtn').click();
    await expect(page.locator('#loginView')).toBeVisible();
    await expect(page.locator('#mobileDrawer [data-account-label]')).toHaveText('Увійти');
    await page.goto('/?mock=user');
    await page.locator('#menuBtn').click();
    await expect(page.locator('#mobileDrawer a[href="admin.html"]')).toContainText('Акаунт');
    await expect(page.locator('#mobileDrawer a[href="admin.html"]')).toContainText('Твої заявки');
    await page.locator('#mobileDrawer a[href="apply.html"]').click();
    await expect(page).toHaveURL(/apply\.html/);
  });

  await test.step('small screens, long content, landscape and desktop resize',async()=>{
    await page.goto('/?mock=long');
    await expect(page.locator('.event-card')).toHaveCount(2);
    await page.locator('.event-disclosure summary').first().click();
    await page.locator('.event-matches summary').first().click();
    await expect(page.locator('.event-team-name').first()).toContainText('ДужеДовгаНазваКоманди');
    await expect(page.locator('.event-match b').first()).toContainText('ДужеДовгаНазваКоманди');
    for(const width of [320,360,390,414,568,700]){
      await page.setViewportSize({width,height:844});
      const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
      expect(dimensions.scroll,`${width}px`).toBeLessThanOrEqual(dimensions.width+1);
      await page.locator('#menuBtn').click();
      await expect(page.locator('#mobileDrawer')).toBeVisible();
      const drawerSize=await page.locator('#mobileDrawer').boundingBox();
      expect(drawerSize.width,`${width}px drawer`).toBeLessThanOrEqual(width+1);
      await page.locator('#drawerClose').click();
    }
    await page.setViewportSize({width:568,height:320});
    await page.locator('#menuBtn').click();
    await page.locator('#mobileDrawer a[href="admin.html"]').scrollIntoViewIfNeeded();
    await expect(page.locator('#mobileDrawer a[href="admin.html"]')).toBeInViewport();
    await page.setViewportSize({width:701,height:800});
    await expect(page.locator('#menuBtn')).toBeHidden();
    await expect(page.locator('#mobileDrawer')).toHaveAttribute('aria-hidden','true');
    await expect(page.locator('.main-nav')).toBeVisible();
    expect(await page.evaluate(()=>document.body.classList.contains('drawer-open'))).toBe(false);
  });

  await test.step('empty and failed tournament loads remain clear',async()=>{
    await page.goto('/?mock=empty');
    await expect(page.locator('.home-empty')).toContainText('Турнірів поки немає');
    await page.goto('/?mock=errors');
    await expect(page.locator('.home-empty')).toContainText('Не вдалося завантажити турніри');
  });
  expect(errors).toEqual([]);
});
