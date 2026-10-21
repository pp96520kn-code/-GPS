(function(root){
const rad=n=>n*Math.PI/180;
function distance(a,b){const dlat=rad(b.lat-a.lat),dlon=rad(b.lng-a.lng);const h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
function calories(met,kg,seconds){return met*3.5*kg/200*seconds/60;}
function activityForSpeed(speedKmh,previousMet){
  const previous=previousMet||1.5;
  let met;
  if(previous<=1.5){met=speedKmh<2.5?1.5:speedKmh<5.8?3.5:speedKmh<6.8?4.8:7.5;}
  else if(speedKmh<1.2)met=1.5;
  else if(speedKmh<(previous<=3.5?5.8:5.2))met=3.5;
  else if(speedKmh<(previous>=7.5?6.2:6.8))met=4.8;
  else met=7.5;
  const name=met===1.5?'靜止／慢移':met===3.5?'舒適步行':met===4.8?'快走':'慢跑';
  return {met,name};
}
function smoothPath(points){if(points.length<3)return points;return points.map((point,index)=>{if(index===0||index===points.length-1)return point;const previous=points[index-1],next=points[index+1],latitude=rad(point[0]);const ax=(point[1]-previous[1])*Math.cos(latitude),ay=point[0]-previous[0],bx=(next[1]-point[1])*Math.cos(latitude),by=next[0]-point[0];const denominator=Math.hypot(ax,ay)*Math.hypot(bx,by);if(!denominator)return point;const angle=Math.acos(Math.max(-1,Math.min(1,(ax*bx+ay*by)/denominator)));if(angle>Math.PI/3)return point;return [(previous[0]+2*point[0]+next[0])/4,(previous[1]+2*point[1]+next[1])/4];});}
function accept(previous,p){if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||!Number.isFinite(p.t)||!Number.isFinite(p.accuracy)||Math.abs(p.lat)>90||Math.abs(p.lng)>180||p.accuracy<0||p.accuracy>35)return {ok:false,reason:'定位精度較差，等待較穩定的訊號（≤ 35 公尺）。'};if(!previous)return {ok:true,meters:0,break:true,speedKmh:0};const dt=(p.t-previous.t)/1000;if(dt<=0)return {ok:false,reason:'略過重複的定位時間。'};if(dt>30)return {ok:true,meters:0,break:true,speedKmh:0};const d=distance(previous,p);if(d/dt>8)return {ok:false,reason:'偵測到定位跳動，已略過這個點。'};const movementFloor=Math.max(4,Math.min(12,(p.accuracy+previous.accuracy)*0.25));if(d<movementFloor)return {ok:false,stationary:true,reason:'位置變化很小，已過濾可能的 GPS 飄移。'};return {ok:true,meters:d,break:false,speedKmh:d/dt*3.6};}
const api={distance,calories,activityForSpeed,smoothPath,accept};if(typeof module!=='undefined')module.exports=api;else root.MoveCore=api;
})(typeof window!=='undefined'?window:globalThis);
