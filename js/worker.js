// runs puzzle generation off the main thread
import {generatePuzzle} from './engine/generate.js'

self.onmessage=(event)=>{
  const {requestId,mode,difficulty,seed}=event.data
  try{
    const puzzle=generatePuzzle(mode,difficulty,seed)
    self.postMessage({requestId,ok:true,puzzle})
  }catch(error){
    self.postMessage({requestId,ok:false,error:String(error&&error.message||error)})
  }
}
