export function drawSurname(ctx,state,width){
  if(!state.surnameEnabled)return null;
  const text=(state.surnameText.trim()||'ФАМИЛИЯ').toUpperCase();
  const scale=width/2160, center=793*(width/1086), baseline=198*(width/1086);
  const fontSize=106*scale, maxWidth=440*scale;
  ctx.save();ctx.font='400 '+fontSize+'px KitName, Arial, sans-serif';
  const metrics=ctx.measureText(text);
  // The supplied AA Bebas Neue has the template's natural letter proportions.
  // Long names shrink uniformly instead of being squeezed horizontally.
  const fit=Math.min(1,maxWidth/Math.max(1,metrics.width));
  ctx.translate(center,baseline);ctx.scale(fit,fit);
  ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.lineJoin='round';ctx.miterLimit=2;
  const outline=state.outlines?.surnameColor;
  if(outline?.enabled){ctx.strokeStyle=outline.color;ctx.lineWidth=5*scale/fit;ctx.strokeText(text,0,0);}
  ctx.fillStyle=state.surnameColor;ctx.fillText(text,0,0);ctx.restore();
  const ascent=metrics.actualBoundingBoxAscent||fontSize*.75;
  const descent=metrics.actualBoundingBoxDescent||0;
  return {x:center-metrics.width*fit/2-4*scale,y:baseline-ascent*fit-4*scale,width:metrics.width*fit+8*scale,height:(ascent+descent)*fit+8*scale};
}
