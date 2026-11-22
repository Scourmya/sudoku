// offline cache: serve the app shell from cache, refresh it in the background
const CACHE='sudoku-v3'
const FILES=[
  './','index.html','manifest.webmanifest','css/style.css',
  'js/app.js','js/game.js','js/board.js','js/ui.js','js/icons.js','js/glyphs.js','js/storage.js',
  'js/generator-client.js','js/worker.js',
  'js/engine/bits.js','js/engine/rng.js','js/engine/units.js','js/engine/model.js','js/engine/solver.js',
  'js/engine/logic.js','js/engine/generate.js','js/engine/modes.js',
  'icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','fonts/nunito.woff2'
]

self.addEventListener('install',(event)=>{
  event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll(FILES)).then(()=>self.skipWaiting()))
})

self.addEventListener('activate',(event)=>{
  event.waitUntil(
    caches.keys().then((keys)=>Promise.all(keys.filter((key)=>key!==CACHE).map((key)=>caches.delete(key)))).then(()=>self.clients.claim())
  )
})

self.addEventListener('fetch',(event)=>{
  if(event.request.method!=='GET')return
  const url=new URL(event.request.url)
  if(url.origin!==location.origin)return
  event.respondWith(
    caches.open(CACHE).then(async(cache)=>{
      const cached=await cache.match(event.request,{ignoreSearch:true})
      const network=fetch(event.request).then((response)=>{
        if(response&&response.ok)cache.put(event.request,response.clone())
        return response
      }).catch(()=>cached)
      return cached||network
    })
  )
})
