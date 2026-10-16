// Deduplicate asset requests and keep only a few decoded preview textures.
export function createAssetCache(load,{limit=3,protectedKey=()=>null}={}){
  const cache=new Map(),pending=new Map();
  function get(key){
    const value=cache.get(key);
    if(value){cache.delete(key);cache.set(key,value);}
    return value;
  }
  async function request(key){
    const value=get(key);if(value)return value;
    if(!pending.has(key)){
      const promise=Promise.resolve().then(()=>load(key)).then(value=>{
        cache.set(key,value);
        while(cache.size>limit){
          const oldest=[...cache.keys()].find(candidate=>candidate!==key&&candidate!==protectedKey());
          if(oldest===undefined)break;
          cache.delete(oldest);
        }
        return value;
      }).finally(()=>pending.delete(key));
      pending.set(key,promise);
    }
    return pending.get(key);
  }
  return {get,request,get size(){return cache.size;}};
}
