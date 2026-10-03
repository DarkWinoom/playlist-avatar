let queue=Promise.resolve();let epoch=0;
export function storageEpoch(){return epoch;}
export function invalidateStorage(){return ++epoch;}
export function serializedStorage<T>(operation:()=>Promise<T>):Promise<T>{const result=queue.then(operation);queue=result.then(()=>{},()=>{});return result;}
