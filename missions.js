'use strict';
(()=>{
  const RECORD_KEY='campus-move-history-v1';
  const TASK_KEY='campus-move-personal-tasks-v1';
  const $=id=>document.getElementById(id);
  const dateParts=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const part=(parts,type)=>parts.find(item=>item.type===type).value;
  const monthKey=date=>{const p=dateParts(date);return part(p,'year')+'-'+part(p,'month');};
  const monthLabel=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'long'});
  const todayMonth=monthKey(new Date());
  $('missionsPeriod').textContent=monthLabel.format(new Date());

  const achievements=[
    {id:'distance5',name:'累積 5 公里',description:'本月 GPS 運動距離達 5 km',metric:'meters',target:5000,points:10},
    {id:'distance15',name:'累積 15 公里',description:'本月 GPS 運動距離達 15 km',metric:'meters',target:15000,points:25},
    {id:'calories500',name:'燃燒 500 kcal',description:'本月估算消耗熱量達 500 kcal',metric:'kcal',target:500,points:10},
    {id:'calories1500',name:'燃燒 1,500 kcal',description:'本月估算消耗熱量達 1,500 kcal',metric:'kcal',target:1500,points:30},
    {id:'days5',name:'運動 5 天',description:'本月至少 5 天各完成 10 分鐘 GPS 運動',metric:'days',target:5,points:20}
  ];

  function loadRecords(){
    try{const records=JSON.parse(localStorage.getItem(RECORD_KEY)||'[]');return Array.isArray(records)?records:[];}catch{return [];}
  }

  function loadTasks(){
    try{
      const stored=JSON.parse(localStorage.getItem(TASK_KEY)||'null');
      return stored?.month===todayMonth&&Array.isArray(stored.tasks)?stored.tasks:[];
    }catch{return [];}
  }

  function saveTasks(tasks){
    try{localStorage.setItem(TASK_KEY,JSON.stringify({month:todayMonth,tasks}));return true;}catch{return false;}
  }

  function calculateStats(records){
    const stats={meters:0,kcal:0,days:0};
    const activeDays=new Set();
    for(const record of records){
      if(record?.demo!==false||record.state!=='finished'||!String(record.mode||'').startsWith('GPS')||!Array.isArray(record.points)||record.points.length<2)continue;
      const date=new Date(record.date);
      if(!Number.isFinite(date.getTime())||monthKey(date)!==todayMonth)continue;
      stats.meters+=Math.max(0,Number(record.meters)||0);
      stats.kcal+=Math.max(0,Number(record.kcal)||0);
      if((Number(record.seconds)||0)>=600){
        const parts=dateParts(date);
        activeDays.add(part(parts,'year')+'-'+part(parts,'month')+'-'+part(parts,'day'));
      }
    }
    stats.days=activeDays.size;
    return stats;
  }

  function valueText(metric,current,target){
    if(metric==='meters')return (current/1000).toFixed(1)+' / '+(target/1000).toFixed(1)+' km';
    if(metric==='kcal')return Math.floor(current)+' / '+target+' kcal';
    return Math.floor(current)+' / '+target+' 天';
  }

  function progressTrack(title,current,target){
    const track=document.createElement('div');
    track.className='achievement-track';
    track.setAttribute('role','progressbar');
    track.setAttribute('aria-label',title+'進度');
    track.setAttribute('aria-valuemin','0');
    track.setAttribute('aria-valuemax',String(target));
    track.setAttribute('aria-valuenow',String(Math.min(current,target)));
    const fill=document.createElement('span');
    fill.style.width=Math.min(100,current/target*100)+'%';
    track.append(fill);
    return track;
  }

  function renderAchievements(stats){
    const root=$('achievementGrid');
    root.replaceChildren();
    let earned=0;
    let completed=0;
    for(const achievement of achievements){
      const current=Number(stats[achievement.metric])||0;
      const done=current>=achievement.target;
      if(done){earned+=achievement.points;completed++;}
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
      const progress=document.createElement('small');
      progress.textContent=(done?'✓ 已達成 · ':'')+valueText(achievement.metric,current,achievement.target);
      card.append(top,title,description,progressTrack(achievement.name,current,achievement.target),progress);
      root.append(card);
    }
    $('missionPoints').textContent=String(earned);
    return completed;
  }

  let tasks=loadTasks();

  function renderPersonalTasks(stats){
    const root=$('personalTaskList');
    root.replaceChildren();
    const completed=tasks.filter(task=>(Number(stats[task.metric])||0)>=Number(task.target)).length;
    $('personalTaskPoints').textContent=String(tasks.reduce((sum,task)=>sum+((Number(stats[task.metric])||0)>=Number(task.target)?Number(task.points)||0:0),0));
    $('addPersonalTask').disabled=tasks.length>=10;
    if(!tasks.length){
      const empty=document.createElement('p');
      empty.className='personal-task-empty';
      empty.textContent='本月還沒有個人任務，設定一個想挑戰的目標吧。';
      root.append(empty);
      return completed;
    }
    for(const task of tasks){
      const current=Number(stats[task.metric])||0;
      const done=current>=task.target;
      const card=document.createElement('article');
      card.className='personal-task-card'+(done?' is-complete':'');
      const copy=document.createElement('div');
      copy.className='personal-task-copy';
      const title=document.createElement('strong');
      title.textContent=task.title;
      const difficulty=document.createElement('small');
      difficulty.textContent=({easy:'入門',medium:'進階',hard:'挑戰'}[task.difficulty]||'個人')+' · '+task.points+' 個人分';
      copy.append(title,difficulty);
      const progress=document.createElement('small');
      progress.textContent=(done?'✓ 已達成 · ':'')+valueText(task.metric,current,task.target);
      const remove=document.createElement('button');
      remove.className='personal-task-delete';
      remove.type='button';
      remove.textContent='刪除';
      remove.setAttribute('aria-label','刪除個人任務 '+task.title);
      remove.onclick=()=>{
        const next=tasks.filter(item=>item.id!==task.id);
        if(!saveTasks(next)){$('missionMessage').textContent='無法儲存變更，請確認瀏覽器允許網站儲存資料。';return;}
        tasks=next;
        renderMissions();
        $('missionMessage').textContent='個人任務已刪除。';
      };
      card.append(copy,progressTrack(task.title,current,task.target),progress,remove);
      root.append(card);
    }
    return completed;
  }

  function renderMissions(updatedRecords){
    const stats=calculateStats(Array.isArray(updatedRecords)?updatedRecords:loadRecords());
    const fixedCompleted=renderAchievements(stats);
    const personalCompleted=renderPersonalTasks(stats);
    $('missionSummary').textContent='完成 '+fixedCompleted+' / 5 項固定任務 · 個人任務 '+personalCompleted+' / '+tasks.length+' 項達成';
  }

  function updateTargetFields(){
    const metric=$('personalTaskMetric').value;
    const input=$('personalTaskTarget');
    if(metric==='meters'){
      $('personalTaskTargetLabel').textContent='目標距離';
      $('personalTaskUnit').textContent='km';
      input.min='1';input.max='100';input.step='0.1';input.value='5';
    }else if(metric==='kcal'){
      $('personalTaskTargetLabel').textContent='目標熱量';
      $('personalTaskUnit').textContent='kcal';
      input.min='100';input.max='10000';input.step='1';input.value='500';
    }else{
      $('personalTaskTargetLabel').textContent='目標天數';
      $('personalTaskUnit').textContent='天';
      input.min='1';input.max='31';input.step='1';input.value='5';
    }
  }

  $('personalTaskMetric').addEventListener('change',updateTargetFields);
  $('personalTaskForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(tasks.length>=10){$('missionMessage').textContent='本月最多新增 10 個個人任務。';return;}
    const metric=$('personalTaskMetric').value;
    const entered=Number($('personalTaskTarget').value);
    const target=metric==='meters'?Math.round(entered*1000):Math.round(entered);
    const difficulty=$('personalTaskDifficulty').value;
    const points={easy:10,medium:20,hard:30}[difficulty]||10;
    const next=[...tasks,{id:window.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2),title:$('personalTaskTitle').value.trim(),metric,target,difficulty,points}];
    if(!saveTasks(next)){$('missionMessage').textContent='無法儲存任務，請確認瀏覽器允許網站儲存資料。';return;}
    tasks=next;
    $('personalTaskTitle').value='';
    renderMissions();
    $('missionMessage').textContent='個人任務已新增，完成的 GPS 運動會自動更新進度。';
  });

  window.refreshMissions=updatedRecords=>renderMissions(updatedRecords);
  window.addEventListener('storage',event=>{
    if(event.key===RECORD_KEY){renderMissions();return;}
    if(event.key===TASK_KEY){tasks=loadTasks();renderMissions();}
  });
  renderMissions();
})();
