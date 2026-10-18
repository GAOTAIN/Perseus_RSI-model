const fs=require('fs'),path=require('path');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'NaturalPose_previews');
const original=path.join(root,'Perseus_reference-legs-together.png');
const generated=path.join(root,'NaturalPose_generated_pass2.png');
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
async function main(){
 const a=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const b=await sharp(generated).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(a.info.width!==1024||a.info.height!==1536||b.info.width!==1024||b.info.height!==1536)throw new Error('Canvas mismatch');
 const result=Buffer.from(a.data);
 // Register at identity. Restore the untouched original outside the actual leg edit.
 // Premultiplied replacement also removes old legs where the new artwork is transparent.
 for(let y=590;y<1536;y++)for(let x=415;x<700;x++){
  const m=smooth(590,665,y)*smooth(415,438,x)*(1-smooth(678,700,x));if(!m)continue;
  const k=(y*1024+x)*4,aa=a.data[k+3]/255,ba=b.data[k+3]/255,alpha=aa*(1-m)+ba*m;
  for(let c=0;c<3;c++)result[k+c]=alpha?Math.round((a.data[k+c]*aa*(1-m)+b.data[k+c]*ba*m)/alpha):0;
  result[k+3]=Math.round(alpha*255);
 }
 const file=path.join(root,'Perseus_reference-natural-pose.png');
 await sharp(result,{raw:{width:1024,height:1536,channels:4}}).png().toFile(file);
 fs.mkdirSync(out,{recursive:true});fs.copyFileSync(file,path.join(out,'Perseus_RSI-natural-legs.png'));
 await sharp(file).flatten({background:'#e8e9ef'}).png().toFile(path.join(out,'Perseus_RSI-natural-legs-preview.png'));
 if(fs.existsSync(path.join(root,'Perseus_reference-leg-spacing.png'))){
 const previous=await sharp(path.join(root,'Perseus_reference-leg-spacing.png')).extract({left:385,top:690,width:335,height:846}).flatten({background:'#e8e9ef'}).png().toBuffer();
 const next=await sharp(file).extract({left:385,top:690,width:335,height:846}).flatten({background:'#e8e9ef'}).png().toBuffer();
 await sharp({create:{width:686,height:846,channels:3,background:'#c9ccd5'}}).composite([{input:previous,left:0,top:0},{input:next,left:351,top:0}]).png().toFile(path.join(out,'natural-legs-comparison.png'));
 }
 const report={registration:'identity; no geometric scaling, stretching or warping',upper590RowsUnchanged:result.subarray(0,590*1024*4).equals(a.data.subarray(0,590*1024*4)),editBounds:{left:415,right:700,top:590,bottom:1536},sourceArtwork:path.basename(generated)};
 if(!report.upper590RowsUnchanged)throw new Error('Upper body changed');
 fs.writeFileSync(path.join(root,'artwork-registration.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exit(1)});
