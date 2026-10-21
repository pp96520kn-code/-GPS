'use strict';
(()=>{
  const RECORD_KEY='campus-move-history-v1';
  const SETTINGS_KEY='campus-move-local-competition-v1';
  const ALIAS_KEY='campus-move-competition-alias-v1';
  const $=id=>document.getElementById(id);
  const now=new Date();
  const monthKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const monthName=new Intl.DateTimeFormat('zh-TW',{year:'numeric',month:'long'}).format(now);

  function loadRecords(){
    try{
      const stored=JSON.parse(localStorage.getItem(RECORD_KEY)||'[]');
      return Array.isArray(stored)?stored:[];
    }catch{return [];}
  }

  function newCode(){
    const bytes=new Uint8Array(5);
    if(window.crypto?.getRandomValues)window.crypto.getRandomValues(bytes);
    else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
    return Array.from(bytes,b=>b.toString(36).padStart(2,'0')).join('').slice(0,8).toUpperCase();
  }

  let settings={};
  try{settings=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')||{};}catch{}
  if(settings.month!==monthKey||!settings.code){
    settings={month:monthKey,code:newCode()};
    try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}
  }

  $('competitionPeriod').textContent=monthName;
  $('competitionCode').textContent=settings.code;

  let records=loadRecords();
  const savedAlias=(localStorage.getItem(ALIAS_KEY)||'').trim();
  const recentAlias=records.find(record=>!record.demo&&String(record.alias||'').trim())?.alias?.trim()||'';
  let playerName=savedAlias||recentAlias||'我';
  $('competitionAlias').value=playerName;
  const workoutAlias=$('alias');
  if(workoutAlias&&!workoutAlias.value)workoutAlias.value=playerName;

  const achievements=[
    {name:'累積 5 公里',description:'本月 GPS 運動距離達 5 km',kind:'distance',target:5000,points:10},
    {name:'累積 15 公里',description:'本月 GPS 運動距離達 15 km',kind:'distance',target:15000,points:25},
    {name:'燃燒 500 kcal',description:'本月估算消耗熱量達 500 kcal',kind:'calories',target:500,points:10},
    {name:'燃燒 1,500 kcal',description:'本月估算消耗熱量達 1,500 kcal',kind:'calories',target:1500,points:30},
    {name:'運動 5 天',description:'本月至少 5 天完成 10 分鐘 GPS 運動',kind:'days',target:5,points:20}
  ];

  function isThisMonth(record){
    const date=new Date(record.date);
    return Number.isFinite(date.getTime())&&date.getFullYear()===now.getFullYear()&&date.getMonth()===now.getMonth();
  }

  function dateKey(record){
    const date=new Date(record.date);
    return date.getFullYear()+'-'+date.getMonth()+'-'+date.getDate();
  }

  function groupKey(name){return name.trim().toLocaleLowerCase('zh-TW');}

  function getLeaderboard(){
    const groups=new Map();
    for(const record of records){
      if(record.demo||!isThisMonth(record))continue;
      const name=String(record.alias||'').trim()||playerName;
      const key=groupKey(name);
      if(!groups.has(key))groups.set(key,{name,meters:0,kcal:0,days:new Set()});
      const person=groups.get(key);
      person.meters+=Number(record.meters)||0;
      person.kcal+=Number(record.kcal)||0;
      if((Number(record.seconds)||0)>=600)person.days.add(dateKey(record));
    }
    const myKey=groupKey(playerName);
    if(!groups.has(myKey))groups.set(myKey,{name:playerName,meters:0,kcal:0,days:new Set()});

    const rows=[...groups.values()].map(person=>{
      person.distance=person.meters;
      person.days=person.days.size;
      person.achievements=achievements.filter(item=>person[item.kind]>=item.target);
      person.points=person.achievements.reduce((sum,item)=>sum+item.points,0);
      return person;
    });
    rows.sort((a,b)=>b.points-a.points||b.meters-a.meters||b.kcal-a.kcal||a.name.localeCompare(b.name,'zh-TW'));
    return rows;
  }

  function renderAchievements(person){
    const root=$('achievementGrid');
    root.replaceChildren();
    for(const achievement of achievements){
      const current=person[achievement.kind];
      const done=current>=achievement.target;
      const card=document.createElement('article');
      card.className='achievement-card'+(done?' is-complete':'');
      const top=document.createElement('div');
      top.className='achievement-card-top';
      const difficulty=document.createElement('span');
      difficulty.className='achievement-difficulty '+(achievement.points>=30?'hard':achievement.points>=20?'medium':'easy');
      difficulty.textContent=achievement.points>=30?'挑戰':achievement.points>=20?'進階':'入門';
      const points=document.createElement('strong');
      points.textContent='+'+achievement.points+' 分';
      top.append(difficulty,points);
      const title=document.createElement('h3');
      title.textContent=achievement.name;
      const description=document.createElement('p');
      description.textContent=achievement.description;
      const track=document.createElement('div');
      track.className='achievement-track';
      track.setAttribute('role','progressbar');
      track.setAttribute('aria-label',achievement.name+'進度');
      track.setAttribute('aria-valuemin','0');
      track.setAttribute('aria-valuemax',String(achievement.target));
      track.setAttribute('aria-valuenow',String(Math.min(current,achievement.target)));
      const fill=document.createElement('span');
      fill.style.width=Math.min(100,current/achievement.target*100)+'%';
      track.append(fill);
      const progress=document.createElement('small');
      let currentText;
      if(achievement.kind==='distance')currentText=(current/1000).toFixed(1)+' / '+(achievement.target/1000)+' km';
      else if(achievement.kind==='calories')currentText=Math.floor(current)+' / '+achievement.target+' kcal';
      else currentText=current+' / '+achievement.target+' 天';
      progress.textContent=done?'✓ 已達成 · '+currentText:currentText;
      card.append(top,title,description,track,progress);
      root.append(card);
    }
  }

  function renderLeaderboard(){
    const rows=getLeaderboard();
    const root=$('competitionLeaderboard');
    const mine=groupKey(playerName);
    root.replaceChildren();
    const myRow=rows.find(row=>groupKey(row.name)===mine);
    $('competitionPoints').textContent=String(myRow?.points||0);
    $('competitionRank').textContent='第 '+(rows.findIndex(row=>groupKey(row.name)===mine)+1)+' 名 / '+rows.length+' 位本機參賽者';
    for(let index=0;index<rows.length;index++){
      const row=rows[index];
      const item=document.createElement('li');
      item.className='leaderboard-row'+(groupKey(row.name)===mine?' is-me':'');
      const rank=document.createElement('span');
      rank.className='leaderboard-rank';
      rank.textContent=String(index+1).padStart(2,'0');
      const name=document.createElement('strong');
      name.textContent=row.name;
      const completed=document.createElement('small');
      completed.textContent=row.achievements.length+' / 5 成就';
      const points=document.createElement('b');
      points.textContent=row.points+' 分';
      const identity=document.createElement('div');
      identity.className='leaderboard-identity';
      identity.append(name,completed);
      item.append(rank,identity,points);
      root.append(item);
    }
  }

  window.refreshCompetition=(updatedRecords)=>{
    records=Array.isArray(updatedRecords)?updatedRecords:loadRecords();
    const mine=getLeaderboard().find(row=>groupKey(row.name)===groupKey(playerName));
    renderAchievements(mine);
    renderLeaderboard();
  };

  window.addEventListener('storage',event=>{
    if(event.key===RECORD_KEY)window.refreshCompetition();
  });

  $('saveCompetitionAlias').onclick=()=>{
    const name=$('competitionAlias').value.trim().slice(0,24);
    if(!name){$('competitionMessage').textContent='請輸入競賽代號。';return;}
    playerName=name;
    try{localStorage.setItem(ALIAS_KEY,name);}catch{}
    if(workoutAlias)workoutAlias.value=name;
    $('competitionMessage').textContent='競賽代號已儲存在此裝置。';
    window.refreshCompetition();
  };

  $('copyCompetitionInvite').onclick=async()=>{
    const url=new URL(location.href);
    url.hash='competition';
    const invite='邀請你參加 PACE '+monthName+' 月運動挑戰\n本機原型代碼：'+settings.code+'\n'+url.href+'\n目前資料只儲存在建立者裝置，尚未支援跨裝置加入與同步。';
    try{
      await navigator.clipboard.writeText(invite);
      $('competitionMessage').textContent='邀請資訊已複製。此代碼目前只供本機原型預覽。';
    }catch{$('competitionMessage').textContent='無法自動複製，請手動複製代碼：'+settings.code;}
  };

  window.refreshCompetition();
})();
