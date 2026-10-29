export const BOOT_PLACEMENTS=Object.freeze([
 {id:'front-left',box:[92,1248,222,1398]},
 {id:'front-right',box:[357,1248,487,1398]},
 {id:'rear-left',box:[612,1251,728,1377]},
 {id:'rear-right',box:[863,1247,979,1375]}
]);
export function drawBoots(ctx,width,images){
  const scale=width/1086;
  for(const {id,box:[x0,y0,x1,y1]} of BOOT_PLACEMENTS){
    const image=images[id];if(!image)continue;
    ctx.drawImage(image,x0*scale,y0*scale,(x1-x0)*scale,(y1-y0)*scale);
  }
}
