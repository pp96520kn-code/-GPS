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
function accept(previous,p){if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||!Number.isFinite(p.t)||!Number.isFinite(p.accuracy)||Math.abs(p.lat)>90||Math.abs(p.lng)>180||p.accuracy<0||p.accuracy>35)return {ok:false,reason:'定位精度較差，等待較穩定的訊號（≤ 35 公尺）。'};if(!previous)return {ok:true,meters:0,break:true,speedKmh:0};const dt=(p.t-previous.t)/1000;if(dt<=0)return {ok:false,reason:'略過重複的定位時間。'};if(dt>30)return {ok:true,meters:0,break:true,speedKmh:0};const d=distance(previous,p);if(d/dt>8)return {ok:false,reason:'偵測到定位跳動，已略過這個點。'};if(d<Math.max(4,Math.min(12,(p.accuracy+previous.accuracy)*0.25)))return {ok:false,stationary:true,reason:'位置變化很小，已過濾可能的 GPS 飄移。'};return {ok:true,meters:d,break:false,speedKmh:d/dt*3.6};}
const api={distance,calories,activityForSpeed,accept};if(typeof module!=='undefined')module.exports=api;else root.MoveCore=api;
})(typeof window!=='undefined'?window:globalThis);
