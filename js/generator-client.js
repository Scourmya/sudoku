// talks to the generation worker and keeps one ready puzzle per mode and level
import {randomSeed} from './engine/rng.js'

let worker=null
let workerBroken=false
let nextRequestId=1
const pending=new Map()
const prefetched=new Map()
const prefetching=new Map()

function getWorker(){
  if(worker||workerBroken)return worker
  try{
    worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'})
    worker.onmessage=(event)=>{
      const {requestId,ok,puzzle,error}=event.data
      const request=pending.get(requestId)
      if(!request)return
      pending.delete(requestId)
      if(ok)request.resolve(puzzle)
      else request.reject(new Error(error))
    }
    worker.onerror=()=>{
      workerBroken=true
      for(const request of pending.values())request.reject(new Error('worker failed'))
      pending.clear()
      worker=null
    }
  }catch(error){
    workerBroken=true
    worker=null
  }
  return worker
}

async function generateDirect(mode,difficulty,seed){
  const {generatePuzzle}=await import('./engine/generate.js')
  return generatePuzzle(mode,difficulty,seed)
}

export function generate(mode,difficulty,seed=randomSeed()){
  const activeWorker=getWorker()
  if(!activeWorker)return generateDirect(mode,difficulty,seed)
  return new Promise((resolve,reject)=>{
    const requestId=nextRequestId++
    pending.set(requestId,{resolve,reject})
    activeWorker.postMessage({requestId,mode,difficulty,seed})
  }).catch(()=>generateDirect(mode,difficulty,seed))
}

const keyFor=(mode,difficulty)=>mode+'|'+difficulty

export async function nextPuzzle(mode,difficulty){
  const key=keyFor(mode,difficulty)
  if(prefetched.has(key)){
    const puzzle=prefetched.get(key)
    prefetched.delete(key)
    return puzzle
  }
  if(prefetching.has(key)){
    const puzzle=await prefetching.get(key)
    prefetched.delete(key)
    if(puzzle)return puzzle
  }
  return generate(mode,difficulty)
}

export function prefetch(mode,difficulty){
  const key=keyFor(mode,difficulty)
  if(prefetched.has(key)||prefetching.has(key))return
  const job=generate(mode,difficulty).then((puzzle)=>{
    prefetched.set(key,puzzle)
    return puzzle
  }).catch(()=>null).finally(()=>prefetching.delete(key))
  prefetching.set(key,job)
}
