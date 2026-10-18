const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = __dirname;
const artDir = path.join(root, 'art');
const buildDir = path.join(root, 'build');
const sourceDir = path.resolve(__dirname, '..');
const reference = path.join(sourceDir, 'Perseus_reference.png');
const blinkFile = path.join(sourceDir, 'Face_blink_source.png');
const speakFile = path.join(sourceDir, 'Face_speaking_source.png');
const W = 1024, H = 1536, AW = 2048, AH = 2048;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, x) => { const t = clamp((x-a)/(b-a)); return t*t*(3-2*t); };
const gauss = (x, y, cx, cy, sx, sy) => Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));

async function rawImage(file, width, height) {
  const im = sharp(file).ensureAlpha();
  if (width) im.resize(width, height, {fit:'fill'});
  return im.raw().toBuffer({resolveWithObject:true});
}

function alignment(original, variant) {
  // Calibrate only unedited nose/skin regions; facial expression pixels are excluded.
  let best = {dx:0,dy:0,error:Infinity};
  for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++) {
    let n=0,e=0;
    for(let y=30;y<138;y+=2) for(let x=54;x<162;x+=2) {
      if ((y>51&&y<91)||(y>95&&y<127)) continue;
      const xx=x+dx, yy=y+dy;
      const a=(y*215+x)*4, b=(yy*215+xx)*4;
      if(original[a+3]<200||variant[b+3]<200)continue;
      for(let c=0;c<3;c++){e+=Math.abs(original[a+c]-variant[b+c]);n++;}
    }
    if(n&&e/n<best.error)best={dx,dy,error:e/n};
  }
  return best;
}

function makePatch(variant, original, align, rect, ellipse) {
  const [left,top,width,height]=rect;
  const pixels=Buffer.alloc(width*height*4);
  // Match the local skin's low-frequency RGB to avoid a visible rectangular seam.
  const offset=[0,0,0]; let n=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const q=Math.hypot((x-width/2)/(width/2),(y-height/2)/(height/2));
    if(q<0.75||q>0.97)continue;
    const sx=left+x-405,sy=top+y-42;
    const vx=Math.round(sx+align.dx),vy=Math.round(sy+align.dy);
    if(vx<0||vx>=215||vy<0||vy>=155||sx<0||sx>=215||sy<0||sy>=155)continue;
    const a=(sy*215+sx)*4,b=(vy*215+vx)*4;
    if(original[a+3]<200||variant[b+3]<200)continue;
    for(let c=0;c<3;c++)offset[c]+=original[a+c]-variant[b+c];n++;
  }
  for(let c=0;c<3;c++)offset[c]=n?clamp(offset[c]/n,-18,18):0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const sx=clamp(Math.round(left+x-405+align.dx),0,214);
    const sy=clamp(Math.round(top+y-42+align.dy),0,154);
    const k=(sy*215+sx)*4,o=(y*width+x)*4;
    const q=Math.hypot((x-(width-1)/2)/(width/2),(y-(height-1)/2)/(height/2));
    const alpha=(1-smooth(ellipse,1,q));
    for(let c=0;c<3;c++)pixels[o+c]=clamp(Math.round(variant[k+c]+offset[c]),0,255);
    pixels[o+3]=Math.round(255*alpha);
  }
  return {pixels,offset};
}

function headDelta(x,y,ax,ay,az) {
  const headWeight=1-smooth(180,330,y);
  const faceWeight=gauss(x,y,512,125,100,110);
  const angle=az/30*6*Math.PI/180;
  const cx=512,cy=215;
  let dx=((x-cx)*Math.cos(angle)-(y-cy)*Math.sin(angle)+cx-x)*headWeight;
  let dy=((x-cx)*Math.sin(angle)+(y-cy)*Math.cos(angle)+cy-y)*headWeight;
  dx+=ax/30*4.5*headWeight;
  dx+=-Math.abs(ax/30)*0.025*(x-512)*faceWeight;
  dy+=ay/30*2.8*headWeight;
  dy+=ay/30*0.025*(y-130)*faceWeight;
  return [dx,dy];
}

function morphDelta(id,x,y,value) {
  let dx=0,dy=0;
  const upper=1-smooth(650,1500,y);
  if(id==='ParamBodyAngleX'){
    dx=value/10*3.5*upper;
    dy=value/10*0.003*(x-512)*upper;
  }else if(id==='ParamBodyAngleZ'){
    const a=value/10*1.1*Math.PI/180;
    dx=((x-512)*Math.cos(a)-(y-1100)*Math.sin(a)+512-x)*upper;
    dy=((x-512)*Math.sin(a)+(y-1100)*Math.cos(a)+1100-y)*upper;
  }else if(id==='ParamBreath'){
    const torso=gauss(x,y,512,380,240,250);
    dx=value*(x-512)*0.006*torso;
    dy=-value*1.4*torso;
  }else if(id==='ParamHairFront'){
    const mask=(1-smooth(100,210,y))*(0.4+0.6*smooth(25,100,Math.abs(x-512)));
    dx=value*1.2*mask;dy=value*0.3*mask;
  }else if(id==='ParamHairSide'){
    const mask=smooth(90,210,y)*(1-smooth(650,820,y))*smooth(85,195,Math.abs(x-512));
    dx=value*3.0*mask*Math.sin(clamp((y-80)/700)*Math.PI/2);
    dy=value*0.8*mask;
  }else if(id==='ParamHairBack'){
    const mask=smooth(200,380,y)*(1-smooth(620,820,y))*smooth(170,270,Math.abs(x-512));
    dx=value*2.7*mask;
  }else if(id==='ParamCoatSway'){
    const mask=smooth(520,1250,y)*smooth(100,160,Math.abs(x-512));
    dx=value*3.0*mask;dy=value*0.4*mask;
  }else if(id==='ParamEyeBallX'||id==='ParamEyeBallY'){
    const eyes=gauss(x,y,483,112,10,4)+gauss(x,y,547,112,10,4);
    if(id==='ParamEyeBallX')dx=value*0.75*eyes;else dy=-value*0.4*eyes;
  }else if(id==='ParamMouthForm'){
    dy=-value*0.7*(gauss(x,y,502,151,3,3)+gauss(x,y,523,151,3,3));
  }else if(id==='ParamBrowLY'||id==='ParamBrowRY'){
    const cx=id==='ParamBrowLY'?483:547;
    dy=-value*1.3*gauss(x,y,cx,98,18,3);
  }
  return [Math.round(dx*10000)/10000,Math.round(dy*10000)/10000];
}

function grid(xs,ys,uvRect) {
  const positions=[],uvs=[],indices=[];
  const [u,v,uw,vh]=uvRect;
  for(let j=0;j<ys.length;j++)for(let i=0;i<xs.length;i++){
    positions.push(xs[i],ys[j]);
    uvs.push(u+(xs[i]-xs[0])/(xs.at(-1)-xs[0])*uw,v+(ys[j]-ys[0])/(ys.at(-1)-ys[0])*vh);
    if(i<xs.length-1&&j<ys.length-1){
      const a=j*xs.length+i,b=a+1,c=a+xs.length,d=c+1;
      indices.push(a,b,d,a,d,c);
    }
  }
  return {positions,uvs,indices};
}

function makeKeys(positions,extra) {
  const axes=[{id:'ParamAngleX',keys:[-30,0,30]},{id:'ParamAngleY',keys:[-30,0,30]},{id:'ParamAngleZ',keys:[-30,0,30]}];
  if(extra)axes.push({id:extra.id,keys:extra.keys});
  const keyforms=[];
  for(let k=0;k<(extra?extra.keys.length:1);k++)for(let z=0;z<3;z++)for(let y=0;y<3;y++)for(let x=0;x<3;x++){
    const deltas=[];
    for(let i=0;i<positions.length;i+=2){
      const px=positions[i],py=positions[i+1];
      let [dx,dy]=headDelta(px,py,axes[0].keys[x],axes[1].keys[y],axes[2].keys[z]);
      if(extra&&extra.id==='ParamMouthOpenY'){
        const open=extra.keys[k];
        const squash=1-0.62*(1-open);
        dy+=(py-151)*(squash-1);
      }
      deltas.push(Math.round(dx*10000)/10000,Math.round(dy*10000)/10000);
    }
    const key={coord:extra?[x,y,z,k]:[x,y,z],deltas,opacity:1};
    if(extra?.id==='ParamEyeLOpen'||extra?.id==='ParamEyeROpen')key.opacity=1-extra.keys[k];
    if(extra?.id==='ParamMouthOpenY')key.opacity=extra.keys[k]===0?0:Math.min(1,extra.keys[k]*2);
    keyforms.push(key);
  }
  return {axes,keyforms};
}

async function main(){
  fs.mkdirSync(artDir,{recursive:true});fs.mkdirSync(buildDir,{recursive:true});
  const orig=await rawImage(reference);
  const crop=await sharp(reference).extract({left:405,top:42,width:215,height:155}).ensureAlpha().raw().toBuffer();
  const blink=(await rawImage(blinkFile,215,155)).data;
  const speak=(await rawImage(speakFile,215,155)).data;
  const blinkAlign=alignment(crop,blink),speakAlign=alignment(crop,speak);
  const patches=[
    {id:'EyeClosedL',name:'左眼闭合',rect:[452,101,61,29],variant:blink,align:blinkAlign,param:'ParamEyeLOpen',ellipse:0.75},
    {id:'EyeClosedR',name:'右眼闭合',rect:[517,101,61,29],variant:blink,align:blinkAlign,param:'ParamEyeROpen',ellipse:0.75},
    {id:'MouthSpeak',name:'说话口型',rect:[489,137,49,32],variant:speak,align:speakAlign,param:'ParamMouthOpenY',ellipse:0.6},
  ];
  const composite=[{input:reference,left:0,top:0}];
  for(let p=0;p<patches.length;p++){
    const patch=patches[p];
    const {pixels,offset}=makePatch(patch.variant,crop,patch.align,patch.rect,patch.ellipse);
    patch.tile=[1070,40+p*90,patch.rect[2],patch.rect[3]];
    patch.file=path.join(artDir,`${patch.id}.png`);
    await sharp(pixels,{raw:{width:patch.rect[2],height:patch.rect[3],channels:4}}).png().toFile(patch.file);
    composite.push({input:patch.file,left:patch.tile[0],top:patch.tile[1]});
    patch.colorOffset=offset;
  }
  const atlasFile=path.join(buildDir,'Perseus_atlas.png');
  await sharp({create:{width:AW,height:AH,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composite).png().toFile(atlasFile);
  const xs=[...new Set([0,W,...Array.from({length:43},(_,i)=>i*24),...Array.from({length:35},(_,i)=>440+i*4)])].filter(x=>x<=W).sort((a,b)=>a-b);
  const ys=[...new Set([0,H,...Array.from({length:65},(_,i)=>i*24),...Array.from({length:36},(_,i)=>68+i*4)])].filter(y=>y<=H).sort((a,b)=>a-b);
  const geometry=grid(xs,ys,[0,0,W/AW,H/AH]);
  const layers=[{id:'PerseusMain',name:'人设主体与形变网格',partId:'PartBody',texturePage:0,drawOrder:500,...geometry,...makeKeys(geometry.positions)}];
  for(let p=0;p<patches.length;p++){
    const patch=patches[p], [x,y,w,h]=patch.rect,[tx,ty]=patch.tile;
    const geo=grid(Array.from({length:7},(_,i)=>x+w*i/6),Array.from({length:5},(_,i)=>y+h*i/4),[tx/AW,ty/AH,w/AW,h/AH]);
    layers.push({id:patch.id,name:patch.name,partId:patch.param==='ParamMouthOpenY'?'PartMouth':'PartEyes',texturePage:0,drawOrder:600+p,opacity:0,...geo,...makeKeys(geo.positions,{id:patch.param,keys:[0,0.5,1]})});
  }
  const params=[
    ['ParamAngleX','头部左右',-30,30,0],['ParamAngleY','头部上下',-30,30,0],['ParamAngleZ','头部倾斜',-30,30,0],
    ['ParamEyeLOpen','左眼开合',0,1,1],['ParamEyeROpen','右眼开合',0,1,1],['ParamMouthOpenY','口型开合',0,1,0],
    ['ParamBodyAngleX','身体左右',-10,10,0],['ParamBodyAngleZ','身体倾斜',-10,10,0],['ParamBreath','呼吸',0,1,0],
    ['ParamHairFront','刘海摆动',-1,1,0],['ParamHairSide','侧发摆动',-1,1,0],['ParamHairBack','长发摆动',-1,1,0],['ParamCoatSway','裙甲摆动',-1,1,0],
    ['ParamEyeBallX','视线左右',-1,1,0],['ParamEyeBallY','视线上下',-1,1,0],['ParamMouthForm','嘴角变化',-1,1,0],['ParamBrowLY','左眉上下',-1,1,0],['ParamBrowRY','右眉上下',-1,1,0]
  ].map(([id,name,min,max,def])=>({id,name,min,max,default:def}));
  for(const layer of layers){
    const include=params.slice(6).filter(p=>!['EyeClosedL','EyeClosedR','MouthSpeak'].includes(layer.id)||['ParamBodyAngleX','ParamBodyAngleZ','ParamBreath'].includes(p.id));
    layer.morphs=include.map(p=>({id:p.id,keys:p.id==='ParamBreath'?[0,1]:[p.min,0,p.max],deltas:(p.id==='ParamBreath'?[0,1]:[p.min,0,p.max]).map(value=>{
      if(value===0)return null;
      const out=[];
      for(let i=0;i<layer.positions.length;i+=2)out.push(...morphDelta(p.id,layer.positions[i],layer.positions[i+1],value));
      return out;
    })}));
  }
  const rig={name:'Perseus_RSI',canvasWidth:W,canvasHeight:H,textureFiles:[atlasFile],parameters:params,layers};
  fs.writeFileSync(path.join(buildDir,'rig.json'),JSON.stringify(rig));
  fs.writeFileSync(path.join(artDir,'art-preparation.json'),JSON.stringify({reference,blinkFile,speakFile,blinkAlign,speakAlign,patches:patches.map(({variant,pixels,...p})=>p),neutralPreserved:true},null,2));



  console.log(JSON.stringify({vertices:geometry.positions.length/2,triangles:geometry.indices.length/3,layers:layers.length,parameters:params.length,rig:path.join(buildDir,'rig.json'),blinkAlign,speakAlign}));
}
main().catch(e=>{console.error(e);process.exit(1)});
