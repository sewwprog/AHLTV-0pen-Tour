const params=new URLSearchParams(location.search);
const mode=params.get('mock')||'admin';
const now='2026-10-20T15:30:00Z';
const tournamentRows=[
  {id:1,name:'AHLTV Open Tour: Season 04',short_name:'OPEN TOUR',game:'CS2',format:'BO3',max_teams:16,status:'registration',registration_open:true,is_visible:true,starts_at:'2026-11-12T18:00:00Z',description:'Головний турнір сезону',rules_text:'Чесна гра',logo_url:null,created_at:now,bracket_image_url:null,bracket_image_url_2:null},
  {id:2,name:'Rivne Autumn Cup',short_name:'AUTUMN CUP',game:'CS2',format:'BO1',max_teams:8,status:'live',registration_open:false,is_visible:true,starts_at:'2026-10-18T18:00:00Z',description:'Осінній кубок',rules_text:'Правила кубка',logo_url:null,created_at:now,bracket_image_url:'https://example.com/bracket.png',bracket_image_url_2:null},
  {id:3,name:'Sunday Invitational',short_name:'SUNDAY',game:'CS2',format:'BO3',max_teams:32,status:'finished',registration_open:false,is_visible:false,starts_at:null,description:'',rules_text:'',logo_url:null,created_at:now,bracket_image_url:null,bracket_image_url_2:null}
];
const reg=(id,name,tag,status,tournament_id)=>({id,team_name:name,team_tag:tag,status,tournament_id,captain_nick:['Kravets','Viper','Sova','Fox','Maks'][id%5],captain_email:`captain${id}@example.com`,contact:`@captain${id}`,team_logo_url:null,players:['Ace','Blaze','Sova','Rush','Maks'],player_steam_links:['https://steamcommunity.com/id/ace'],substitutes:['Vlad'],substitute_steam_links:['https://steamcommunity.com/id/vlad'],note:id===1?'Готові грати ввечері':'',user_id:'user-1',created_at:now});
const registrations=[reg(1,'Nova Esports','NOVA','pending',1),reg(2,'Rivne Five','RF','approved',1),reg(3,'Night Owls','OWL','pending',2),reg(4,'Delta Team','DLT','rejected',2),reg(5,'Fox Academy','FOX','approved',1)];
const manual=[{id:11,tournament_id:1,team_name:'Manual Team',team_logo_url:null,created_at:now}];
const user={id:mode==='user'?'user-1':'admin-1',email:mode==='user'?'captain@example.com':'admin@ahltv.ua',created_at:now};
window.__mock={mode,session:mode==='login'?null:{user,access_token:'test-token'},tables:{admin_users:mode==='user'?[]:[{user_id:'admin-1'}],site_settings:[{id:1,site_name:'AHLTV',site_subtitle:'TOURNAMENTS',home_title:'Турніри',home_description:'Турніри для команд',footer_text:'Tournament Platform',logo_url:null}],tournaments:mode==='empty'?[]:tournamentRows,team_registrations:mode==='empty'?[]:registrations,manual_tournament_teams:mode==='empty'?[]:manual},users:[{id:'admin-1',email:'admin@ahltv.ua',created_at:now,is_admin:true,is_self:true},{id:'user-1',email:'captain@example.com',created_at:now,is_admin:false,is_self:false}],errors:mode==='errors'?{tournaments:true,team_registrations:true,manual_tournament_teams:true}:mode==='auth-error'?{admin_users:true}:{},failNext:null,uploads:[],history:[]};
if(mode==='unsafe'){
  const item=window.__mock.tables.team_registrations[0];
  item.team_name='<img src=x onerror="window.__xss=true">';
  item.team_logo_url='javascript:alert(1)';
  item.contact='<script>window.__xss=true</script>';
  item.player_steam_links=['javascript:alert(1)'];
}
if(mode==='long'){
  window.__mock.tables.tournaments[0].name='Надзвичайно довга назва турніру для перевірки адаптивності та перенесення слів без обрізання '.repeat(2);
  window.__mock.tables.team_registrations[0].team_name='ДужеДовгаНазваКомандиБезПробілів'.repeat(3);
  window.__mock.tables.team_registrations[0].captain_email='verylongemailaddress'.repeat(4)+'@example.com';
  window.__mock.session.user.email='verylongadministratoraddress'.repeat(3)+'@example.com';
}
const clone=o=>JSON.parse(JSON.stringify(o));
function enrich(name,row){
  const copy=clone(row);
  if(['team_registrations','manual_tournament_teams'].includes(name)){
    const t=window.__mock.tables.tournaments.find(t=>t.id===row.tournament_id);
    copy.tournaments=t?{name:t.name,short_name:t.short_name,starts_at:t.starts_at,status:t.status}:null;
  }
  return copy;
}
class Query{
 constructor(name){this.name=name;this.action='select';this.filters=[];this.returning=false;this.singleMode=false;}
 select(){if(this.action!=='select')this.returning=true;return this}
 eq(field,value){this.filters.push([field,value]);return this}
 order(){return this}
 insert(data){this.action='insert';this.payload=data;return this}
 update(data){this.action='update';this.payload=data;return this}
 delete(){this.action='delete';return this}
 single(){this.singleMode=true;return this.execute()}
 maybeSingle(){this.singleMode=true;return this.execute()}
 then(resolve,reject){return this.execute().then(resolve,reject)}
 async execute(){
  await new Promise(resolve=>setTimeout(resolve,window.__mock.delay??12));
  const m=window.__mock;
  m.history.push({table:this.name,action:this.action,payload:clone(this.payload||{}),filters:clone(this.filters)});
  if((this.action==='select'&&m.errors[this.name])||(m.failNext&&m.failNext.table===this.name&&m.failNext.action===this.action)){
   const message=m.failNext?.message||'mock database error';if(m.failNext&&m.failNext.table===this.name&&m.failNext.action===this.action)m.failNext=null;
   return {data:null,error:{message,code:'mock_error'}};
  }
  const list=m.tables[this.name]||[];
  const matches=row=>this.filters.every(([field,value])=>row[field]===value);
  let result;
  if(this.action==='select') result=list.filter(matches).map(row=>enrich(this.name,row));
  else if(this.action==='insert'){
   const row={id:Math.max(0,...list.map(x=>Number(x.id)||0))+1,created_at:now,...this.payload};list.unshift(row);result=[enrich(this.name,row)];
  }else if(this.action==='update'){
   result=list.filter(matches);result.forEach(row=>Object.assign(row,this.payload));result=result.map(row=>enrich(this.name,row));
  }else{
   result=list.filter(matches);m.tables[this.name]=list.filter(row=>!matches(row));
   if(this.name==='tournaments'){
    const ids=result.map(x=>x.id);m.tables.team_registrations=m.tables.team_registrations.filter(x=>!ids.includes(x.tournament_id));m.tables.manual_tournament_teams=m.tables.manual_tournament_teams.filter(x=>!ids.includes(x.tournament_id));
   }
  }
  return {data:this.singleMode?(result[0]||null):result,error:null};
 }
}
const originalFetch=window.fetch.bind(window);
window.fetch=async (url,options={})=>{
 if(String(url).includes('/functions/v1/admin-users')){
  if(options.method==='POST'){
   const data=JSON.parse(options.body);const user=window.__mock.users.find(u=>u.id===data.user_id);
   if(user)user.is_admin=data.make_admin;
   window.__mock.history.push({table:'admin-users',action:'POST',payload:data});
  }
  return new Response(JSON.stringify({users:window.__mock.users}),{status:200,headers:{'Content-Type':'application/json'}});
 }
 return originalFetch(url,options);
};
export function createClient(){
 return {
  auth:{
   async getSession(){return {data:{session:window.__mock.session},error:null}},
   onAuthStateChange(callback){return {data:{subscription:{unsubscribe(){}}}}},
   async signInWithPassword({email}){window.__mock.session={user:{id:'admin-1',email},access_token:'test-token'};return {data:window.__mock.session,error:null}},
   async signOut(){window.__mock.session=null;return {error:null}}
  },
  from(name){return new Query(name)},
  storage:{from(bucket){return {async upload(path,file){window.__mock.uploads.push({bucket,path,name:file.name});if(window.__mock.failUpload){window.__mock.failUpload=false;return {error:{message:'mock upload error'}}}return {data:{path},error:null}},getPublicUrl(path){return {data:{publicUrl:`https://example.com/${path}`}}}}}},
  async rpc(){return {data:true,error:null}}
 };
}
