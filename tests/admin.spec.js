const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

// Exercise the real account UI without modifying a live Supabase project.
const supabaseMock=fs.readFileSync(path.join(__dirname,'fixtures/supabase-mock.js'),'utf8');
const iconNames=['Trophy','SendHorizontal','LogIn','Menu','X','UserRound','UserPlus','LogOut','Settings','Users','GitBranch','Globe2','ClipboardList','CalendarDays','Gamepad2','ExternalLink','Eye','EyeOff','Pencil','Trash2','Check','XCircle','Upload','Image','Save','Shield','CircleDot','Clock3','Swords','LayoutDashboard','ScrollText','ChevronRight','Plus','LockKeyhole','UserCheck','UserX','ListChecks','CircleUserRound','ArrowRight','BadgeCheck','CircleCheck','CircleX','ClipboardPlus','ImagePlus','Images','LoaderCircle','ShieldCheck'];
const lucideMock='export function createIcons(){};'+iconNames.map(name=>`export const ${name}={};`).join('');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const file={name:'test.png',mimeType:'image/png',buffer:png};

test('admin workflows, account access and responsive layouts',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let dismissNextDialog=false;
  page.on('dialog',dialog=>{
    if(dismissNextDialog){dismissNextDialog=false;return dialog.dismiss()}
    return dialog.accept();
  });
  await page.route('https://esm.sh/@supabase/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:supabaseMock}));
  await page.route('https://esm.sh/lucide**',route=>route.fulfill({status:200,contentType:'application/javascript',body:lucideMock}));
  await page.route('https://example.com/**',route=>route.fulfill({status:200,contentType:'image/png',body:png}));
  const load=async mode=>page.goto(`/admin.html?mock=${mode}`);
  const tab=async id=>{
    if(page.viewportSize().width<=850)await page.locator('#adminSectionSelect').selectOption(id);
    else await page.locator(`[data-tab="${id}"]`).click();
    await expect(page.locator(`#${id}`)).toBeVisible();
  };

  await test.step('overview, filters, keyboard details and application actions',async()=>{
    await load('admin');
    await expect(page.locator('#overviewTournaments')).toHaveText('3');
    await expect(page.locator('#overviewPending')).toHaveText('2');
    await expect(page.locator('#overviewApproved')).toHaveText('2');
    await page.locator('.overview-stat[data-application-status="pending"]').click();
    await expect(page.locator('[data-application-filter="pending"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.application')).toHaveCount(2);
    await page.locator('#applicationSearch').fill('Night');
    await expect(page.locator('.application')).toHaveCount(1);
    await page.locator('#applicationTournamentFilter').selectOption('1');
    await expect(page.locator('#emptyState')).toContainText('Нічого не знайдено');
    await page.locator('#clearApplicationFilters').click();
    await expect(page.locator('.application')).toHaveCount(5);
    await page.locator('[data-application-filter="pending"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-application-filter="pending"]')).toBeFocused();
    await page.locator('[data-application-filter="all"]').click();
    const nova=page.locator('.application').filter({hasText:'Nova Esports'});
    await nova.locator('summary').focus();await page.keyboard.press('Enter');
    await expect(nova.locator('details')).toHaveAttribute('open','');
    await expect(nova.locator('.admin-roster-row')).toHaveCount(6);
    await expect(nova).toContainText('Готові грати ввечері');
    await page.evaluate(()=>window.__mock.delay=250);
    await nova.locator('[data-app-action="approved"]').click();
    await page.locator('#applicationSearch').fill('Nova');
    await expect(nova.locator('[data-app-action="approved"]')).toBeDisabled();
    await expect(page.locator('#overviewPending')).toHaveText('1');
    await expect(nova.locator('.application-status')).toHaveText('Прийнята');
    await page.evaluate(()=>window.__mock.delay=12);
    await page.locator('#applicationSearch').fill('');
    await nova.locator('[data-app-action="rejected"]').click();
    await expect(nova.locator('.application-status')).toHaveText('Відхилена');
    await nova.locator('[data-app-action="pending"]').click();
    await expect(nova.locator('.application-status')).toHaveText('Очікує');
    await nova.locator('summary').click();
    await nova.locator('[data-app-action="delete"]').click();
    await expect(page.locator('.application')).toHaveCount(4);
  });

  await test.step('tournament editing, upload recovery and preserved selections',async()=>{
    await tab('manualTeamsTab');await page.locator('#manualTeamTournament').selectOption('2');
    await tab('matchesTab');await page.locator('#bracketTournament').selectOption('2');
    await tab('tournamentsTab');
    await page.locator('#tournamentSearch').fill('autumn');await expect(page.locator('.admin-tournament-card')).toHaveCount(1);
    await page.locator('#tournamentSearch').fill('');
    await page.evaluate(()=>window.__mock.failNext={table:'tournaments',action:'update',message:'denied'});
    await page.locator('[data-status-id="1"]').selectOption('live');
    await expect(page.locator('#tournamentListMessage')).toContainText('Не вдалося');
    await expect(page.locator('[data-status-id="1"]')).toHaveValue('registration');
    await page.locator('[data-status-id="1"]').selectOption('live');
    await expect(page.locator('#tournamentListMessage')).toContainText('Статус турніру оновлено');
    await expect(page.locator('#manualTeamTournament')).toHaveValue('2');
    await expect(page.locator('#bracketTournament')).toHaveValue('2');
    await page.locator('[data-edit-tournament="1"]').click();
    await expect(page.locator('#tournamentEditor')).toHaveAttribute('open','');
    await page.locator('#tournamentForm [name=name]').fill('Оновлений турнір');
    dismissNextDialog=true;
    await page.locator('[data-edit-tournament="2"]').click();
    await expect(page.locator('#tournamentForm [name=name]')).toHaveValue('Оновлений турнір');
    await page.locator('#saveTournamentBtn').click();
    await expect(page.locator('#tournamentListMessage')).toContainText('Турнір оновлено');
    await expect(page.locator('#tournamentEditor')).not.toHaveAttribute('open','');
    await page.locator('#createTournamentBtn').click();
    await page.locator('#tournamentForm [name=name]').fill('Новий турнір');
    await page.locator('#tournamentLogoFile').setInputFiles(file);
    await expect(page.locator('#tournamentLogoPreview img')).toHaveAttribute('src',/^blob:/);
    await page.evaluate(()=>window.__mock.failUpload=true);
    await page.locator('#saveTournamentBtn').click();
    await expect(page.locator('#tournamentMessage')).toContainText('логотип не завантажено');
    expect(await page.evaluate(()=>window.__mock.tables.tournaments.length)).toBe(4);
    await page.locator('#saveTournamentBtn').click();
    await expect(page.locator('#tournamentListMessage')).toContainText('Турнір оновлено');
    expect(await page.evaluate(()=>window.__mock.tables.tournaments.length)).toBe(4);
    await page.locator('#createTournamentBtn').click();
    await page.locator('#tournamentForm [name=name]').fill('Чернетка');
    dismissNextDialog=true;
    await page.locator('#cancelTournamentEdit').click();
    await expect(page.locator('#tournamentForm [name=name]')).toHaveValue('Чернетка');
    await page.locator('#cancelTournamentEdit').click();
    await expect(page.locator('#tournamentEditor')).not.toHaveAttribute('open','');
  });

  await test.step('teams, brackets, site settings and user permissions',async()=>{
    await tab('manualTeamsTab');
    await page.locator('#manualTeamTournament').selectOption('1');
    await page.locator('#manualTeamName').fill('Test Manual');
    await page.locator('#manualTeamLogoFile').setInputFiles(file);
    await expect(page.locator('#manualTeamLogoPreview img')).toHaveAttribute('src',/^blob:/);
    await page.locator('#manualTeamSubmitBtn').click();
    await expect(page.locator('#manualTeamMessage')).toContainText('Команду додано');
    await page.locator('.manual-team-row').filter({hasText:'Test Manual'}).locator('[data-delete-manual-team]').click();
    await expect(page.locator('.manual-team-row').filter({hasText:'Test Manual'})).toHaveCount(0);
    await tab('matchesTab');await page.locator('#bracketTournament').selectOption('2');
    for(const suffix of ['', '2']){
      await page.locator(`#bracketImageFile${suffix}`).setInputFiles(file);
      await expect(page.locator(`#bracketImagePreview${suffix} img`)).toHaveAttribute('src',/^blob:/);
      await page.locator(`#saveBracketImageBtn${suffix}`).click();
      await expect(page.locator('#bracketMessage')).toContainText(`Сітку ${suffix||'1'} збережено`);
    }
    await page.locator('#removeBracketImageBtn').click();
    await expect(page.locator('#bracketMessage')).toContainText('Сітку 1 прибрано');
    await tab('siteTab');await page.locator('#siteLogoFile').setInputFiles(file);
    await expect(page.locator('#siteLogoPreview img')).toHaveAttribute('src',/^blob:/);
    await page.locator('#siteSettingsForm [name=site_name]').fill('Тестовий сайт');
    await page.locator('#saveSiteSettingsBtn').click();
    await expect(page.locator('#siteSettingsMessage')).toContainText('збережено');
    await tab('usersTab');await page.locator('#userSearch').fill('captain');
    await expect(page.locator('.user-row')).toHaveCount(1);
    await page.locator('[data-user-id="user-1"]').click();
    await expect(page.locator('.user-row .role-badge')).toHaveText('Адміністратор');
    await page.locator('[data-user-id="user-1"]').click();
    await expect(page.locator('.user-row .role-badge')).toHaveText('Користувач');
  });

  await test.step('empty/error states, captain cabinet and login',async()=>{
    await load('empty');await expect(page.locator('#overviewTournaments')).toHaveText('0');
    await tab('applicationsTab');await expect(page.locator('#emptyStateText')).toHaveText('Заявок поки немає.');
    await load('errors');await expect(page.locator('#overviewTournamentsNote')).toContainText('Не вдалося');
    await expect(page.locator('#overviewTournaments')).toHaveText('—');
    await tab('applicationsTab');await expect(page.locator('#applications')).toContainText('Не вдалося завантажити');
    await load('auth-error');await expect(page.locator('#loginView')).toBeVisible();
    await expect(page.locator('#loginMessage')).toContainText('Не вдалося перевірити права');
    await expect(page.locator('#userView')).toBeHidden();
    await load('unsafe');await expect(page.locator('#overviewTournaments')).toHaveText('3');
    await tab('applicationsTab');
    const unsafe=page.locator('.application').first();
    await expect(unsafe).toContainText('<img src=x');
    await unsafe.locator('summary').click();
    await expect(unsafe.locator('script, a[href^="javascript:"], img')).toHaveCount(0);
    expect(await page.evaluate(()=>window.__xss)).toBeUndefined();
    await load('user');await expect(page.locator('#userView')).toBeVisible();
    await expect(page.locator('#dashboardView')).toBeHidden();
    await expect(page.locator('#userApplicationsCount')).toHaveText('5');
    await load('login');await expect(page.locator('#loginView')).toBeVisible();
    await page.locator('#email').fill('admin@ahltv.ua');await page.locator('#password').fill('password123');
    await page.locator('#authBtn').click();await expect(page.locator('#dashboardView')).toBeVisible();
    await page.locator('#logoutBtn').click();await expect(page.locator('#loginView')).toBeVisible();
  });

  await test.step('responsive navigation and long content',async()=>{
    await load('long');await expect(page.locator('#overviewTournaments')).toHaveText('3');
    for(const width of [320,390,700,768,850,1024,1440]){
      await page.setViewportSize({width,height:900});
      for(const id of ['overviewTab','tournamentsTab','applicationsTab','manualTeamsTab','matchesTab','usersTab','siteTab']){
        await tab(id);
        if(id==='tournamentsTab'&&await page.locator('#tournamentEditor').getAttribute('open')===null)await page.locator('#tournamentEditor summary').click();
        if(id==='applicationsTab'&&await page.locator('.application-details').first().getAttribute('open')===null)await page.locator('.application-details summary').first().click();
        const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
        expect(dimensions.scroll,`${width}px, ${id}`).toBeLessThanOrEqual(dimensions.width+1);
      }
    }
  });
  expect(errors).toEqual([]);
});
