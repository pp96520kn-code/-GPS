'use strict';
(()=>{
  const API='https://api.open-meteo.com/v1/elevation';
  const CACHE_KEY='campus-move-elevation-cache-v1';
  const MAX_SAMPLES=100;
  const SVG='http://www.w3.org/2000/svg';
  const $=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const svgNode=(tag,attrs={})=>{const node=document.createElementNS(SVG,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;};

  function loadCache(){
    try{const value=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');return value&&typeof value==='object'?value:{};}catch{return {};}
  }

  function saveCache(id,entry){
    try{
      const cache=loadCache();
      cache[id]=entry;
      const keep=Object.entries(cache).sort((a,b)=>(b[1]?.savedAt||0)-(a[1]?.savedAt||0)).slice(0,30);
      localStorage.setItem(CACHE_KEY,JSON.stringify(Object.fromEntries(keep)));
    }catch{}
  }

  function routeSamples(record){
    const points=(record.points||[]).filter(point=>Number.isFinite(Number(point.lat))&&Number.isFinite(Number(point.lng))&&Math.abs(Number(point.lat))<=90&&Math.abs(Number(point.lng))<=180);
    if(points.length<2)throw new Error('這筆紀錄沒有足夠的有效路線點，無法建立高度圖。');
    const cumulative=[0];
    for(let i=1;i<points.length;i++){
      const sameSegment=(points[i].segment??0)===(points[i-1].segment??0);
      const distance=sameSegment?MoveCore.distance(points[i-1],points[i]):0;
      cumulative.push(cumulative[i-1]+(Number.isFinite(distance)?Math.max(0,distance):0));
    }
    const count=Math.min(MAX_SAMPLES,points.length);
    const lastDistance=cumulative[cumulative.length-1];
    const workoutMeters=Math.max(0,Number(record.meters)||0);
    const output=[];
    let cursor=0;
    for(let i=0;i<count;i++){
      const fraction=count===1?0:i/(count-1);
      let index;
      if(lastDistance>0){
        const target=lastDistance*fraction;
        while(cursor+1<points.length&&cumulative[cursor+1]<target)cursor++;
        index=cursor+1<points.length&&Math.abs(cumulative[cursor+1]-target)<Math.abs(cumulative[cursor]-target)?cursor+1:cursor;
      }else index=Math.round(fraction*(points.length-1));
      let distance=lastDistance>0?cumulative[index]/lastDistance*(workoutMeters||lastDistance):fraction*workoutMeters;
      if(!Number.isFinite(distance))distance=0;
      output.push({lat:Number(points[index].lat),lng:Number(points[index].lng),distance});
    }
    return output;
  }

  function signature(samples){
    const value=samples.map(point=>point.lat.toFixed(5)+','+point.lng.toFixed(5)).join(';');
    let hash=2166136261;
    for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);
    return (hash>>>0).toString(16)+'-'+samples.length;
  }

  async function getProfile(record,samples){
    const id=String(record.id);
    const routeSignature=signature(samples);
    const cached=loadCache()[id];
    if(cached?.signature===routeSignature&&Array.isArray(cached.elevations)&&cached.elevations.length===samples.length)return {samples,elevations:cached.elevations};
    const url=new URL(API);
    url.searchParams.set('latitude',samples.map(point=>point.lat.toFixed(5)).join(','));
    url.searchParams.set('longitude',samples.map(point=>point.lng.toFixed(5)).join(','));
    let response;
    try{response=await fetch(url,{method:'GET',cache:'force-cache'});}catch{throw new Error('地形服務連線失敗，請確認網路後重試。');}
    let payload;
    try{payload=await response.json();}catch{throw new Error('地形服務沒有回傳有效資料。');}
    if(!response.ok||!Array.isArray(payload.elevation))throw new Error(payload.reason||'目前無法取得這條路線的地形高度，請稍後重試。');
    const elevations=payload.elevation.map(value=>value===null?NaN:Number(value));
    if(elevations.length!==samples.length||elevations.some(value=>!Number.isFinite(value)))throw new Error('部分路段沒有地形高度資料，請稍後重試。');
    saveCache(id,{signature:routeSignature,elevations,savedAt:Date.now()});
    return {samples,elevations};
  }

  function smooth(values){
    return values.map((_,index)=>{
      const slice=values.slice(Math.max(0,index-1),Math.min(values.length,index+2));
      return slice.reduce((sum,value)=>sum+value,0)/slice.length;
    });
  }

  function elevationStats(values){
    const filtered=smooth(values);
    let ascent=0,descent=0;
    for(let i=1;i<filtered.length;i++){
      const change=filtered[i]-filtered[i-1];
      if(change>3)ascent+=change;
      else if(change< -3)descent-=change;
    }
    return {ascent:Math.round(ascent),descent:Math.round(descent),low:Math.round(Math.min(...values)),high:Math.round(Math.max(...values)),filtered};
  }

  function makeChart(samples,values,record){
    const width=720,height=280,left=62,right=18,top=20,bottom=238;
    const plotWidth=width-left-right,plotHeight=bottom-top;
    const stats=elevationStats(values);
    const padding=Math.max(4,(stats.high-stats.low)*.12);
    const range=Math.max(10,stats.high-stats.low+padding*2);
    const rawStep=range/4;
    const step=Math.max(1,Math.ceil(rawStep/5)*5);
    const minElevation=Math.floor((stats.low-padding)/step)*step;
    let maxElevation=Math.ceil((stats.high+padding)/step)*step;
    if(maxElevation<=minElevation)maxElevation=minElevation+step;
    const distanceMax=Math.max(Number(record.meters)||0,samples[samples.length-1]?.distance||0,1);
    const x=distance=>left+Math.max(0,Math.min(1,distance/distanceMax))*plotWidth;
    const y=value=>bottom-(value-minElevation)/(maxElevation-minElevation)*plotHeight;
    const svg=svgNode('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':'沿路線距離與地形高度變化折線圖'});
    const title=svgNode('title');title.textContent='沿路線距離與地形高度變化';svg.append(title);
    for(let altitude=minElevation;altitude<=maxElevation;altitude+=step){
      const yy=y(altitude);
      svg.append(svgNode('line',{x1:left,y1:yy,x2:width-right,y2:yy,class:'elevation-gridline'}));
      const label=svgNode('text',{x:left-9,y:yy+4,'text-anchor':'end',class:'elevation-axis-label'});label.textContent=String(altitude);svg.append(label);
    }
    for(let tick=0;tick<=4;tick++){
      const fraction=tick/4,xx=left+fraction*plotWidth;
      svg.append(svgNode('line',{x1:xx,y1:top,x2:xx,y2:bottom,class:'elevation-gridline vertical'}));
      const label=svgNode('text',{x:xx,y:bottom+22,'text-anchor':tick===0?'start':tick===4?'end':'middle',class:'elevation-axis-label'});
      label.textContent=(distanceMax*fraction/1000).toFixed(distanceMax>=10000?1:2);
      svg.append(label);
    }
    const points=stats.filtered.map((altitude,index)=>[x(samples[index].distance),y(altitude)]);
    const linePath=points.map(([px,py],index)=>(index?'L':'M')+px.toFixed(1)+' '+py.toFixed(1)).join(' ');
    const areaPath=linePath+` L ${points[points.length-1][0].toFixed(1)} ${bottom} L ${points[0][0].toFixed(1)} ${bottom} Z`;
    svg.append(svgNode('path',{d:areaPath,class:'elevation-area'}));
    svg.append(svgNode('path',{d:linePath,class:'elevation-line'}));
    const yTitle=svgNode('text',{x:15,y:top+plotHeight/2,transform:`rotate(-90 15 ${top+plotHeight/2})`,'text-anchor':'middle',class:'elevation-axis-title'});yTitle.textContent='地形高度（公尺）';svg.append(yTitle);
    const xTitle=svgNode('text',{x:left+plotWidth/2,y:height-5,'text-anchor':'middle',class:'elevation-axis-title'});xTitle.textContent='路線距離（公里）';svg.append(xTitle);
    const distance=(Number(record.meters)||0)/1000;
    const summary=$('div','elevation-summary');
    for(const text of [`路線 ${distance.toFixed(2)} km`,`累積爬升 +${stats.ascent} m`,`累積下降 −${stats.descent} m`,`高度 ${stats.low}–${stats.high} m`])summary.append($('span','',text));
    const figure=$('figure','elevation-figure');
    figure.append(svg);
    const caption=$('figcaption','elevation-attribution');
    caption.append(document.createTextNode('地形來源：Copernicus DEM GLO-90（約 90 公尺網格），透過 '));
    const openMeteo=$('a','', 'Open-Meteo Elevation API');openMeteo.href='https://open-meteo.com/en/docs/elevation-api';openMeteo.target='_blank';openMeteo.rel='noopener';
    const copernicus=$('a','', 'Copernicus');copernicus.href='https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM';copernicus.target='_blank';copernicus.rel='noopener';
    caption.append(openMeteo,document.createTextNode(' 查詢；資料由 '),copernicus,document.createTextNode(' 提供，僅供路線起伏參考。'));
    return {summary,figure,caption};
  }

  function create(record,actions){
    if(record.demo||!Array.isArray(record.points)||record.points.length<2)return null;
    const button=$('button','elevation-toggle','高度折線圖');
    button.type='button';
    button.setAttribute('aria-expanded','false');
    const panel=$('section','elevation-panel');
    panel.hidden=true;
    panel.setAttribute('aria-label','運動地形高度折線圖');
    const status=$('p','elevation-status','尚未載入地形資料。');
    const chart=$('div','elevation-chart');
    panel.append(status,chart);
    button.onclick=async()=>{
      panel.hidden=!panel.hidden;
      button.setAttribute('aria-expanded',String(!panel.hidden));
      if(panel.hidden)return;
      if(panel.dataset.loaded==='true')return;
      if(panel.dataset.loading==='true')return;
      panel.dataset.loading='true';
      status.textContent='正在依路線抽樣查詢地形高度…';
      chart.replaceChildren();
      try{
        const samples=routeSamples(record);
        const profile=await getProfile(record,samples);
        const parts=makeChart(profile.samples,profile.elevations,record);
        chart.append(parts.summary,parts.figure,parts.caption);
        status.textContent='地形高度圖已載入。';
        panel.dataset.loaded='true';
      }catch(error){
        status.textContent=error?.message||'無法取得地形高度資料，請稍後重試。';
      }finally{delete panel.dataset.loading;}
    };
    actions.append(button);
    return panel;
  }

  window.ElevationProfile={
    create,
    remove(recordId){const cache=loadCache();delete cache[String(recordId)];try{localStorage.setItem(CACHE_KEY,JSON.stringify(cache));}catch{}},
    clear(){try{localStorage.removeItem(CACHE_KEY);}catch{}}
  };
})();
