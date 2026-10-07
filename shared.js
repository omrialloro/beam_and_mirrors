// shared.js — ray-tracing physics + draw primitives used by both the main
// app window (script.js) and the popup display window (display.js), so the
// two stay visually identical. Loaded as a plain classic <script> (no build
// step / no modules) before either script.js or display.js.

const SPEED_SCALE = 0.01, MIN_ENERGY = 0.04, HIT_RADIUS = 18;

function segIntersect(px, py, dx, dy, ax, ay, bx, by) {
  const ex=bx-ax,ey=by-ay,denom=dx*ey-dy*ex;
  if (Math.abs(denom)<1e-10) return null;
  const tx=ax-px,ty=ay-py,t=(tx*ey-ty*ex)/denom,u=(tx*dy-ty*dx)/denom;
  if (t>1e-4&&u>=0&&u<=1) return {t,ix:px+dx*t,iy:py+dy*t};
  return null;
}
function reflect(dx,dy,nx,ny){const l=Math.sqrt(nx*nx+ny*ny),nnx=nx/l,nny=ny/l,d=dx*nnx+dy*nny;return{dx:dx-2*d*nnx,dy:dy-2*d*nny};}
function edgeEnd(ox,oy,dx,dy,W,H){let t=Infinity;if(dx>0)t=Math.min(t,(W-ox)/dx);if(dx<0)t=Math.min(t,(0-ox)/dx);if(dy>0)t=Math.min(t,(H-oy)/dy);if(dy<0)t=Math.min(t,(0-oy)/dy);return t;}
function traceRay(ox,oy,dirDeg,spinners,excl,er,eg,eb,depth,segs,W,H){
  if(depth>24||(er<MIN_ENERGY&&eg<MIN_ENERGY&&eb<MIN_ENERGY))return;
  const rad=(dirDeg-90)*Math.PI/180,dx=Math.cos(rad),dy=Math.sin(rad);
  let nearest=null,ni=-1;
  for(let i=0;i<spinners.length;i++){
    if(i===excl)continue;
    const s=spinners[i],cos=Math.cos(s.angle),sin=Math.sin(s.angle),half=s.length/2;
    const h=segIntersect(ox,oy,dx,dy,s.x-cos*half,s.y-sin*half,s.x+cos*half,s.y+sin*half);
    if(h&&(!nearest||h.t<nearest.t)){nearest=h;ni=i;}
  }
  const te=edgeEnd(ox,oy,dx,dy,W,H);
  if(!nearest||nearest.t>=te){segs.push({x1:ox,y1:oy,x2:ox+dx*te,y2:oy+dy*te,er,eg,eb,last:true});return;}
  segs.push({x1:ox,y1:oy,x2:nearest.ix,y2:nearest.iy,er,eg,eb,last:false});
  const s=spinners[ni],lR=s.leakR,lG=s.leakG,lB=s.leakB,cos=Math.cos(s.angle),sin=Math.sin(s.angle);
  const ref=reflect(dx,dy,-sin,cos);
  traceRay(nearest.ix,nearest.iy,(Math.atan2(ref.dy,ref.dx)*180/Math.PI+90+360)%360,spinners,ni,er*(1-lR),eg*(1-lG),eb*(1-lB),depth+1,segs,W,H);
  if(lR>0||lG>0||lB>0)traceRay(nearest.ix,nearest.iy,(Math.atan2(dy,dx)*180/Math.PI+90+360)%360,spinners,ni,er*lR,eg*lG,eb*lB,depth+1,segs,W,H);
}

// All draw* helpers take an explicit dctx (rather than closing over a single
// live canvas context) so the same functions render identically to the main
// window, the popup display window, and the offscreen video-capture canvas.
function drawSegs(dctx,segs,base,ghost,wMult){
  wMult = wMult || 1;
  for(const seg of segs){
    const sc=ghost?0.45:base,bright=Math.max(seg.er,seg.eg,seg.eb);
    if(bright<0.01)continue;
    const r=Math.round(seg.er*255),g=Math.round(seg.eg*255),b=Math.round(seg.eb*255);
    dctx.save();dctx.lineCap='round';
    dctx.strokeStyle=`rgba(${r},${g},${b},${sc*bright*0.15})`;dctx.lineWidth=7;dctx.shadowBlur=0;
    dctx.beginPath();dctx.moveTo(seg.x1,seg.y1);dctx.lineTo(seg.x2,seg.y2);dctx.stroke();
    dctx.strokeStyle=`rgba(${r},${g},${b},${sc*bright*0.6})`;dctx.lineWidth=1.2*wMult;dctx.shadowColor=`rgb(${r},${g},${b})`;dctx.shadowBlur=(ghost?2:5)*wMult;
    dctx.beginPath();dctx.moveTo(seg.x1,seg.y1);dctx.lineTo(seg.x2,seg.y2);dctx.stroke();
    dctx.strokeStyle=`rgba(${Math.min(255,r+80)},${Math.min(255,g+80)},${Math.min(255,b+80)},${sc*bright*0.7})`;dctx.lineWidth=0.5*wMult;dctx.shadowBlur=0;
    dctx.beginPath();dctx.moveTo(seg.x1,seg.y1);dctx.lineTo(seg.x2,seg.y2);dctx.stroke();
    if(!seg.last){dctx.shadowColor=`rgb(${r},${g},${b})`;dctx.shadowBlur=(ghost?4:8)*wMult;dctx.fillStyle=`rgba(${r},${g},${b},${sc*bright*0.85})`;dctx.beginPath();dctx.arc(seg.x2,seg.y2,2,0,Math.PI*2);dctx.fill();}
    dctx.restore();
  }
}

function drawMirror(dctx,x,y,angle,length,hue,leakR,leakG,leakB,alpha,sel,brightness){
  if(brightness<=0)return;
  const cos=Math.cos(angle),sin=Math.sin(angle),half=length/2;
  dctx.save();dctx.globalAlpha=alpha*brightness;
  if(sel){dctx.strokeStyle='rgba(170,136,255,0.5)';dctx.lineWidth=10;dctx.shadowBlur=0;dctx.beginPath();dctx.moveTo(x-cos*half,y-sin*half);dctx.lineTo(x+cos*half,y+sin*half);dctx.stroke();}
  dctx.strokeStyle=`hsl(${hue},100%,70%)`;dctx.lineWidth=1.5;dctx.shadowColor=`hsl(${hue},100%,70%)`;dctx.shadowBlur=6;
  dctx.beginPath();dctx.moveTo(x-cos*half,y-sin*half);dctx.lineTo(x+cos*half,y+sin*half);dctx.stroke();
  const ml=Math.max(leakR,leakG,leakB);
  if(ml>0){dctx.globalAlpha=alpha*brightness*ml*0.5;dctx.strokeStyle=`rgb(${Math.round(leakR*220+35)},${Math.round(leakG*220+35)},${Math.round(leakB*220+35)})`;dctx.lineWidth=3;dctx.shadowBlur=0;dctx.beginPath();dctx.moveTo(x-cos*half,y-sin*half);dctx.lineTo(x+cos*half,y+sin*half);dctx.stroke();}
  dctx.globalAlpha=alpha*brightness;dctx.fillStyle=sel?'#aa88ff':`hsl(${hue},100%,85%)`;dctx.shadowBlur=0;
  dctx.beginPath();dctx.arc(x,y,sel?3:1.5,0,Math.PI*2);dctx.fill();
  dctx.restore();
}

function drawBeamDot(dctx,o,sel){
  const pr=Math.round(o.r*255),pg=Math.round(o.g*255),pb=Math.round(o.b*255);
  dctx.save();
  if(sel){dctx.strokeStyle='rgba(170,136,255,0.6)';dctx.lineWidth=1;dctx.shadowBlur=0;dctx.beginPath();dctx.arc(o.x,o.y,HIT_RADIUS*0.7,0,Math.PI*2);dctx.stroke();}
  dctx.shadowColor=`rgb(${pr},${pg},${pb})`;dctx.shadowBlur=6;dctx.fillStyle=`rgba(${pr},${pg},${pb},0.9)`;
  dctx.beginPath();dctx.arc(o.x,o.y,2.5,0,Math.PI*2);dctx.fill();dctx.restore();
}

// Advances mirror/beam physics by dt and draws the composition onto dctx.
// Shared by: the main window's live rAF loop, the popup display window's
// rAF loop, and the offline video-capture loop — so output is identical
// regardless of which canvas/window produced the frame.
function stepAndDrawCore(dctx, objs, dt, t, selIdx, brightness) {
  const W = dctx.canvas.width, H = dctx.canvas.height;
  dctx.clearRect(0,0,W,H);
  const spinners = objs.filter(o=>o.type==='spinner');

  for(let i=0;i<objs.length;i++){
    const o=objs[i];if(o.type!=='spinner')continue;
    o.angle+=o.speed*SPEED_SCALE*dt*Math.PI*2;
    drawMirror(dctx,o.x,o.y,o.angle,o.length,o.hue,o.leakR,o.leakG,o.leakB,1.0,i===selIdx,brightness);
  }
  for(let i=0;i<objs.length;i++){
    const o=objs[i];if(o.type!=='beam')continue;
    const fl=0.92+0.05*Math.sin(t*18+o.phase)+0.03*(Math.random()-0.5);
    const al=Math.max(0.8,Math.min(1.0,fl));
    drawBeamDot(dctx,o,i===selIdx);
    const segs=[];traceRay(o.x,o.y,o.dir,spinners,-1,o.r,o.g,o.b,0,segs,W,H);
    drawSegs(dctx,segs,al,false, o.width || 1);
  }
}
