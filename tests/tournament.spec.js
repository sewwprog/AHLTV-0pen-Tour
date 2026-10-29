const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const supabaseMock=fs.readFileSync(path.join(__dirname,'fixtures/supabase-mock.js'),'utf8');
const iconNames=['Trophy','SendHorizontal','LogIn','Menu','X','UserRound','UserPlus','LogOut','Settings','Users','GitBranch','Globe2','ClipboardList','CalendarDays','Gamepad2','ExternalLink','Eye','EyeOff','Pencil','Trash2','Check','XCircle','Upload','Image','Save','Shield','CircleDot','Clock3','Swords','LayoutDashboard','ScrollText','ChevronRight','Plus','LockKeyhole','UserCheck','UserX','ListChecks','CircleUserRound','ArrowRight','BadgeCheck','CircleCheck','CircleX','ClipboardPlus','ImagePlus','Images','LoaderCircle','ShieldCheck','Type','Search'];
const lucideMock='export function createIcons(){};'+iconNames.map(name=>`export const ${name}={};`).join('');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');

async function mockServices(page,{patch='',failTeams=false}={}){
  let mock=supabaseMock.replace('const clone=o=>',`${patch}\nconst clone=o=>`);
  if(failTeams)mock=mock.replace("if(name==='get_public_teams'){",`if(name==='get_public_teams')throw new Error('mock team failure');\n   if(name==='get_public_teams'){`);
  await page.route('https://esm.sh/@supabase/**',route=>route.fulfill({contentType:'application/javascript',body:mock}));
  await page.route('https://esm.sh/lucide**',route=>route.fulfill({contentType:'application/javascript',body:lucideMock}));
  // A popup's first request must be intercepted at the context level.
  await page.context().route('https://example.com/**',route=>route.fulfill({contentType:'image/png',body:png}));
}

async function expectNoHorizontalOverflow(page,label){
  const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  expect(dimensions.scroll,label).toBeLessThanOrEqual(dimensions.width+1);
}

async function expectSectionClearOfNavigation(page,id){
  const geometry=await page.evaluate(sectionId=>({
    header:document.querySelector('.site-header').getBoundingClientRect().bottom,
    nav:document.querySelector('.detail-tabs').getBoundingClientRect().toJSON(),
    section:document.getElementById(sectionId).getBoundingClientRect().toJSON(),
    viewport:innerHeight
  }),id);
  expect(geometry.nav.top).toBeGreaterThanOrEqual(geometry.header-1);
  expect(geometry.section.top).toBeGreaterThanOrEqual(geometry.nav.bottom-2);
  expect(geometry.section.top).toBeLessThan(geometry.viewport);
}

test('phone details show real tournament data, easy section links and the correct application',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  await mockServices(page);
  await page.goto('/tournament.html?id=1&mock=user');

  await expect(page.locator('#tournamentHero h1')).toHaveText('AHLTV Open Tour: Season 04');
  await expect(page.locator('.detail-heading p')).toHaveText('Головний турнір сезону');
  await expect(page.locator('.tournament-meta')).toContainText('CS2');
  await expect(page.locator('.tournament-meta')).toContainText('BO3');
  await expect(page.locator('.tournament-meta')).toContainText('3 / 16 команд');
  await expect(page.locator('.detail-status-pill')).toHaveText('РЕЄСТРАЦІЯ ВІДКРИТА');
  await expect(page.locator('.tournament-meta')).toContainText('2026');
  await expect(page.locator('#detailTeamsCount')).toHaveText('3 / 16');
  await expect(page.locator('#detailTeamsCount')).toHaveAttribute('aria-label','3 з 16 команд');
  await expect(page.locator('.detail-team-card')).toHaveCount(3);
  await expect(page.locator('#detailTeams')).toContainText('Rivne Five');
  await expect(page.locator('#detailTeams')).toContainText('Fox Academy');
  await expect(page.locator('#detailTeams')).toContainText('Manual Team');
  await expect(page.locator('#detailTeams')).not.toContainText('Nova Esports'); // pending, not approved
  await expect(page.locator('#rulesContent')).toHaveText('Чесна гра');
  await expect(page.locator('.public-bracket-image.is-empty')).toHaveCount(2);
  await expect(page.locator('.detail-back')).toHaveAttribute('href','./#tournamentsSection');
  await expect(page.locator('.detail-apply')).toHaveAttribute('href','apply.html?tournament=1');

  for(const control of await page.locator('.detail-back, .detail-apply, .detail-tabs a').all()){
    const box=await control.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator('.detail-tabs a').first()).toHaveAttribute('aria-current','location');
  for(const id of ['bracketSection','rulesSection','teamsSection']){
    const link=page.locator(`.detail-tabs a[href="#${id}"]`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(link).toHaveAttribute('aria-current','location');
    await expectSectionClearOfNavigation(page,id);
  }

  // The highlighted link also follows ordinary scrolling and keyboard navigation.
  await page.mouse.wheel(0,1000);
  await expect(page.locator('.detail-tabs a[href="#rulesSection"]')).toHaveAttribute('aria-current','location');
  const bracketLink=page.getByRole('navigation',{name:'Розділи турніру'}).getByRole('link',{name:'Сітка'});
  await page.keyboard.press('Tab');
  await bracketLink.focus();
  await expect(bracketLink).toBeFocused();
  expect(await bracketLink.evaluate(el=>el.matches(':focus-visible'))).toBe(true);
  expect(parseFloat(await bracketLink.evaluate(el=>getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Enter');
  await expect(bracketLink).toHaveAttribute('aria-current','location');
  await page.mouse.wheel(0,-1000);
  await expect(page.locator('.detail-tabs a[href="#teamsSection"]')).toHaveAttribute('aria-current','location');
  await page.locator('.detail-apply').click();
  await expect(page).toHaveURL(/apply\.html\?tournament=1/);
  await expect(page.locator('#tournamentSelect')).toHaveValue('1');
  await page.goBack();
  await page.locator('.detail-back').click();
  await expect(page).toHaveURL(/\/#tournamentsSection$/);
  await expect(page.locator('#tournamentsSection')).toBeVisible();
  expect(errors).toEqual([]);
});

test('team search and sorting remain usable on a narrow phone',async({page})=>{
  await page.setViewportSize({width:320,height:800});
  await mockServices(page);
  await page.goto('/tournament.html?id=1');
  const search=page.getByRole('searchbox',{name:'Пошук команди'});
  const sort=page.getByRole('combobox',{name:'Сортувати команди'});
  await expect(search).toBeVisible();
  await expect(sort).toBeVisible();
  for(const control of [search,sort])expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(await search.evaluate(el=>getComputedStyle(el).fontSize)).toBe('16px'); // avoids iOS input zoom
  await expect(page.locator('.detail-progress-track')).toHaveAttribute('aria-valuenow','19');
  await expect(page.locator('.detail-font-badge')).toHaveText('Manrope');
  await search.fill('rf');
  await expect(page.locator('.detail-team-card')).toHaveCount(1);
  await expect(page.locator('.detail-team-card').first()).toContainText('Rivne Five');
  await search.fill('FOX');
  await expect(page.locator('.detail-team-card')).toHaveCount(1);
  await expect(page.locator('.detail-team-card').first()).toContainText('Fox Academy');
  await search.fill('відсутня');
  await expect(page.locator('#detailTeams')).toContainText('Не знайдено команд за запитом');
  await expect(page.locator('#detailTeamsCount')).toHaveText('3 / 16');
  await search.fill('');
  await sort.selectOption('-name');
  await expect(page.locator('.detail-team-card').first()).toContainText('Rivne Five');
  await expect(page.locator('.detail-team-card').last()).toContainText('Fox Academy');
  await sort.selectOption('name');
  await expect(page.locator('.detail-team-card').first()).toContainText('Fox Academy');
  await expectNoHorizontalOverflow(page,'team search and sort');
});

test('closed registration, one image and empty teams remain clear and usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mockServices(page);
  await page.goto('/tournament.html?id=2');
  await expect(page.locator('#tournamentHero h1')).toHaveText('Rivne Autumn Cup');
  await expect(page.locator('.detail-status-pill')).toHaveText('LIVE');
  await expect(page.locator('.detail-registration-closed')).toBeVisible();
  await expect(page.locator('.detail-registration-closed')).toContainText('Реєстрація зараз недоступна');
  await expect(page.locator('.detail-apply')).toHaveCount(0);
  await expect(page.locator('#detailTeamsCount')).toHaveText('0 / 8');
  await expect(page.locator('#detailTeams')).toContainText('Підтверджених команд ще немає');
  await expect(page.locator('.detail-teams-toolbar')).toBeHidden();
  await expect(page.locator('.detail-progress-track')).toHaveAttribute('aria-valuenow','0');
  await expect(page.locator('#rulesContent')).toHaveText('Правила кубка');

  const first=page.locator('.public-bracket-image').first();
  const second=page.locator('.public-bracket-image').nth(1);
  await expect(first).toHaveClass(/has-image/);
  await expect(second).toHaveClass(/is-empty/);
  await expect(second).toContainText('Фото ще не додано');
  await expect(first.locator('img')).toHaveAttribute('alt','Сітка 1 турніру Rivne Autumn Cup');
  const open=first.locator('.bracket-open-btn');
  await expect(open).toHaveAttribute('href','https://example.com/bracket.png');
  await expect(open).toHaveAttribute('target','_blank');
  await expect(open).toHaveAttribute('rel','noopener noreferrer');
  await expect(open).toHaveAccessibleName('Відкрити сітку 1 повністю у новій вкладці');
  expect((await open.boundingBox()).height).toBeGreaterThanOrEqual(44);
  const [popup]=await Promise.all([page.waitForEvent('popup'),open.click()]);
  await popup.waitForLoadState();
  expect(popup.url()).toBe('https://example.com/bracket.png');
  await popup.close();
  await expectNoHorizontalOverflow(page,'closed registration');
});

test('both bracket images and empty rules work without hiding either slot',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mockServices(page,{patch:`
    Object.assign(window.__mock.tables.tournaments[0],{
      bracket_image_url:'https://example.com/first.png',
      bracket_image_url_2:'https://example.com/second.png',
      rules_text:''
    });
  `});
  await page.goto('/tournament.html?id=1');
  await expect(page.locator('.public-bracket-image.has-image')).toHaveCount(2);
  for(const [index,url] of ['https://example.com/first.png','https://example.com/second.png'].entries()){
    const slot=page.locator('.public-bracket-image').nth(index);
    await expect(slot.locator('img')).toHaveAttribute('alt',`Сітка ${index+1} турніру AHLTV Open Tour: Season 04`);
    await expect(slot.locator('a')).toHaveCount(2);
    await expect(slot.locator('.bracket-zoom')).toHaveAttribute('href',url);
    const link=slot.locator('.bracket-open-btn');
    await expect(link).toHaveAttribute('href',url);
    await expect(link).toHaveAttribute('target','_blank');
    await expect(link).toHaveAttribute('rel','noopener noreferrer');
    const box=await slot.boundingBox();
    expect(box.width).toBeGreaterThan(300);
  }
  const dialog=page.locator('#bracketLightbox');
  const firstPreview=page.locator('.public-bracket-image').first().locator('.bracket-zoom');
  await firstPreview.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-hidden','false');
  await expect(dialog).not.toHaveAttribute('inert','');
  await expect(dialog.locator('img')).toHaveAttribute('src','https://example.com/first.png');
  await expect(dialog.locator('img')).toHaveAttribute('alt','Сітка 1 турніру AHLTV Open Tour: Season 04');
  await expect(page.locator('#bracketLightboxClose')).toBeFocused();
  expect(await page.evaluate(()=>getComputedStyle(document.body).overflow)).toBe('hidden');
  await page.keyboard.press('Tab');
  await expect(page.locator('#bracketLightboxClose')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(dialog).toHaveAttribute('inert','');
  await expect(firstPreview).toBeFocused();
  await page.locator('.public-bracket-image').nth(1).locator('.bracket-zoom').click();
  await expect(dialog.locator('img')).toHaveAttribute('src','https://example.com/second.png');
  await dialog.click({position:{x:5,y:5}});
  await expect(dialog).toBeHidden();
  await expect(page.locator('#rulesContent')).toContainText('Правила для цього турніру ще не додані');
  await expectNoHorizontalOverflow(page,'two images');
});

test('registration availability follows both status and the registration flag',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mockServices(page,{patch:`
    const item=window.__mock.tables.tournaments[0];
    const variant=params.get('variant');
    if(variant==='registration-closed')Object.assign(item,{status:'registration',registration_open:false});
    if(variant==='upcoming')Object.assign(item,{status:'upcoming',registration_open:true,starts_at:null});
    if(variant==='live-open')Object.assign(item,{status:'live',registration_open:true});
    if(variant==='finished')Object.assign(item,{status:'finished',registration_open:true});
  `});
  for(const [variant,status,open] of [
    ['registration-closed','РЕЄСТРАЦІЯ ЗАКРИТА',false],
    ['upcoming','НЕЗАБАРОМ',false],
    ['live-open','LIVE',true],
    ['finished','ЗАВЕРШЕНО',false]
  ]){
    await page.goto(`/tournament.html?id=1&variant=${variant}`);
    await expect(page.locator('.detail-status-pill')).toHaveText(status);
    await expect(page.locator('.detail-apply')).toHaveCount(open?1:0);
    await expect(page.locator('.detail-registration-closed')).toHaveCount(open?0:1);
    if(open)await expect(page.locator('.detail-apply')).toHaveAttribute('href','apply.html?tournament=1');
    else await expect(page.locator('.detail-registration-closed')).toBeVisible();
    if(variant==='upcoming')await expect(page.locator('.tournament-meta')).toContainText('Дату не вказано');
  }
});

test('chosen title font, countdown, progress and formatted rules are preserved',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mockServices(page,{patch:`
    Object.assign(window.__mock.tables.tournaments[0],{
      name_font:'unbounded',status:'upcoming',starts_at:'2099-01-01T12:00:00Z',
      rules_text:'- Чесна гра\\n- Поважай суперників\\n\\n1. Перший матч\\n2. Фінал'
    });
  `});
  await page.goto('/tournament.html?id=1');
  const title=page.locator('#tournamentHero h1');
  await expect(title).toHaveText('AHLTV Open Tour: Season 04');
  expect(await title.evaluate(el=>getComputedStyle(el).fontFamily)).toContain('Unbounded');
  expect(await title.evaluate(el=>getComputedStyle(el).fontWeight)).toBe('800');
  await expect(page.locator('.detail-font-badge')).toHaveText('Unbounded');
  await expect(page.locator('.tournament-meta')).toContainText('до початку');
  await expect(page.locator('.detail-progress-track')).toHaveAttribute('aria-valuenow','19');
  await expect(page.locator('.rules-list')).toHaveCount(2);
  await expect(page.locator('.rules-list').first().locator('li')).toHaveText(['Чесна гра','Поважай суперників']);
  await expect(page.locator('.rules-list').nth(1).locator('li')).toHaveText(['Перший матч','Фінал']);
  await expectNoHorizontalOverflow(page,'custom font and rules');
});

test('real tournament and team logos remain visible with descriptive alternatives',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mockServices(page,{patch:`
    window.__mock.tables.tournaments[0].logo_url='https://example.com/tournament.png';
    window.__mock.tables.team_registrations[1].team_logo_url='https://example.com/team.png';
  `});
  await page.goto('/tournament.html?id=1');
  await expect(page.locator('.detail-logo')).toHaveClass(/has-logo/);
  await expect(page.locator('.detail-logo img')).toHaveAttribute('alt','Логотип AHLTV Open Tour: Season 04');
  const team=page.locator('.detail-team-card').filter({hasText:'Rivne Five'});
  await expect(team.locator('.detail-team-logo')).toHaveClass(/has-logo/);
  await expect(team.locator('img')).toHaveAttribute('alt','Логотип Rivne Five');
  await expect(team.locator('img')).toHaveAttribute('src','https://example.com/team.png');
  await expectNoHorizontalOverflow(page,'logos');
});

test('long details wrap without clipping on phones, landscape and desktop',async({page})=>{
  await page.setViewportSize({width:320,height:800});
  await mockServices(page,{patch:`
    Object.assign(window.__mock.tables.tournaments[0],{
      game:'ДужеДовгаНазваГриБезПробілів',
      format:'ДовгийФорматБезПробілів',
      description:'ДужеДовгийОписБезПробілів'.repeat(12),
      rules_text:'Перше правило\\nДругий рядок\\n\\n'+ 'ДовгеПравилоБезПробілів'.repeat(16)
    });
  `});
  await page.goto('/tournament.html?id=1&mock=long');
  const longName=page.locator('.detail-team-name').filter({hasText:'ДужеДовгаНазваКомандиБезПробілів'});
  await expect(longName).toBeVisible();
  await expect(page.locator('#rulesContent p')).toHaveCount(2);
  await expect(page.locator('#rulesContent p').first().locator('br')).toHaveCount(1);

  for(const width of [320,360,390,414,568,700]){
    await page.setViewportSize({width,height:844});
    await expectNoHorizontalOverflow(page,`${width}px`);
    for(const selector of ['.detail-heading h1','.detail-heading p','.tournament-meta','.detail-team-name','#rulesContent']){
      const locator=selector==='.detail-team-name'?longName:page.locator(selector).first();
      const size=await locator.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,overflow:getComputedStyle(el).overflow,wrap:getComputedStyle(el).overflowWrap}));
      expect(size.scroll,`${width}px ${selector}`).toBeLessThanOrEqual(size.client+1);
    }
    const nameStyle=await longName.evaluate(el=>({whiteSpace:getComputedStyle(el).whiteSpace,wrap:getComputedStyle(el).overflowWrap,box:el.getBoundingClientRect().toJSON()}));
    expect(nameStyle.whiteSpace).toBe('normal');
    expect(nameStyle.wrap).toBe('anywhere');
    expect(nameStyle.box.height).toBeGreaterThan(30);
  }
  await page.setViewportSize({width:568,height:320});
  await page.locator('.detail-tabs a[href="#bracketSection"]').click();
  await expectSectionClearOfNavigation(page,'bracketSection');
  await expectNoHorizontalOverflow(page,'landscape');

  for(const width of [701,1440]){
    await page.setViewportSize({width,height:900});
    await expect(page.locator('.detail-back')).toBeHidden();
    await expect(page.locator('.tournament-detail-page .page-topline')).toBeVisible();
    await expect(page.locator('.detail-apply')).toBeVisible();
    const logoWidth=await page.locator('.detail-logo').evaluate(el=>parseFloat(getComputedStyle(el).width));
    expect(logoWidth).toBe(92);
    const teamColumns=await page.locator('.detail-teams').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(teamColumns).toBe(2);
    for(const selector of ['.detail-heading p','.detail-team-name','#rulesContent']){
      const locator=selector==='.detail-team-name'?longName:page.locator(selector).first();
      const size=await locator.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
      expect(size.scroll,`${width}px ${selector}`).toBeLessThanOrEqual(size.client+1);
    }
    await expectNoHorizontalOverflow(page,`${width}px desktop`);
  }
});

test('missing or failed data has an understandable state; a team error does not hide the tournament',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  await mockServices(page,{failTeams:true});
  await page.goto('/tournament.html?id=1');
  await expect(page.locator('#tournamentHero h1')).toHaveText('AHLTV Open Tour: Season 04');
  await expect(page.locator('#detailTeamsCount')).toHaveText('—');
  await expect(page.locator('#detailTeams')).toContainText('Не вдалося завантажити команди');
  await expect(page.locator('.detail-teams-toolbar')).toBeHidden();
  await expect(page.locator('.detail-progress')).toHaveCount(0);
  await expect(page.locator('.tournament-meta')).toContainText('до 16 команд');
  await expect(page.locator('.detail-apply')).toHaveAttribute('href','apply.html?tournament=1');
  await expect(page.locator('#rulesContent')).toHaveText('Чесна гра');

  for(const [url,message] of [
    ['/tournament.html','Турнір не знайдено'],
    ['/tournament.html?id=3','Турнір не знайдено або він прихований'],
    ['/tournament.html?id=1&mock=errors','Не вдалося завантажити турнір']
  ]){
    await page.goto(url);
    await expect(page.locator('#tournamentHero')).toContainText(message);
    await expect(page.locator('.detail-tabs')).toBeHidden();
    await expect(page.locator('#teamsSection')).toBeHidden();
    await expect(page.locator('#bracketSection')).toBeHidden();
    await expect(page.locator('#rulesSection')).toBeHidden();
    await expect(page.locator('.detail-back')).toBeVisible();
    await expectNoHorizontalOverflow(page,url);
  }
  expect(errors).toEqual([]);
});

test('untrusted details remain text and unsafe image URLs never become links or images',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mockServices(page,{patch:`
    const item=window.__mock.tables.tournaments[0];
    Object.assign(item,{
      name:'<img src=x onerror="window.__xss=true">',
      description:'<script>window.__xss=true</script>',
      max_teams:'<img src=x onerror="window.__xss=true">',
      logo_url:'javascript:alert(1)',
      bracket_image_url:'javascript:alert(1)',
      bracket_image_url_2:'https://example.com/safe.png',
      rules_text:'<img src=x onerror="window.__xss=true">'
    });
    const team=window.__mock.tables.team_registrations[1];
    team.team_name='<svg onload="window.__xss=true">';
    team.team_logo_url='javascript:alert(1)';
  `});
  await page.goto('/tournament.html?id=1');
  await expect(page.locator('#tournamentHero h1')).toContainText('<img src=x');
  await expect(page.locator('#tournamentHero .detail-heading p')).toContainText('<script>');
  await expect(page.locator('#detailTeams')).toContainText('<svg onload=');
  await expect(page.locator('#rulesContent')).toContainText('<img src=x');
  await expect(page.locator('#tournamentHero img, #tournamentHero script, #detailTeams img, #detailTeams svg, #rulesContent img')).toHaveCount(0);
  await expect(page.locator('.public-bracket-image').first()).toHaveClass(/is-empty/);
  await expect(page.locator('.public-bracket-image').nth(1).locator('a').first()).toHaveAttribute('href','https://example.com/safe.png');
  expect(await page.evaluate(()=>window.__xss)).toBeUndefined();
  await expectNoHorizontalOverflow(page,'untrusted content');
});

test('deep links, sticky navigation and reduced motion work after content is loaded',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mockServices(page,{patch:'window.__mock.delay=400;'});
  await page.goto('/tournament.html?id=1#bracketSection');
  await expect(page.locator('#tournamentHero h1')).toBeVisible();
  await expect(page.locator('.detail-tabs a[href="#bracketSection"]')).toHaveAttribute('aria-current','location');
  await expectSectionClearOfNavigation(page,'bracketSection');
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
});

test.describe('touch interaction',()=>{
  test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  test('section links and the shared mobile menu respond to taps',async({page})=>{
    await mockServices(page);
    await page.goto('/tournament.html?id=1');
    await expect(page.locator('#tournamentHero h1')).toBeVisible();
    await page.locator('.detail-tabs a[href="#bracketSection"]').tap();
    await expect(page.locator('.detail-tabs a[href="#bracketSection"]')).toHaveAttribute('aria-current','location');
    await expectSectionClearOfNavigation(page,'bracketSection');
    await page.locator('#menuBtn').tap();
    await expect(page.locator('#mobileDrawer')).toBeVisible();
    await page.locator('#drawerClose').tap();
    await expect(page.locator('#mobileDrawer')).toBeHidden();
    await expectNoHorizontalOverflow(page,'touch');
  });
});

test('section navigation works with motion enabled',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:390,height:844});
  await mockServices(page);
  await page.goto('/tournament.html?id=1');
  await expect(page.locator('#siteIntro')).toBeHidden({timeout:1700});
  await expect(page.locator('#tournamentHero h1')).toBeVisible();
  const rules=page.locator('.detail-tabs a[href="#rulesSection"]');
  await rules.click();
  await expect(rules).toHaveAttribute('aria-current','location');
  await expect(page.locator('#rulesSection')).toBeInViewport();
  await expectSectionClearOfNavigation(page,'rulesSection');
  await expect(page.locator('#rulesContent')).toBeVisible();
});
