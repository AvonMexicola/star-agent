/** A fresh practice session never reads or writes the player's regular save. */
export function testFlightStorage(seed=[]){
  const values=new Map(seed);
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
}
