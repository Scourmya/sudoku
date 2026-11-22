// shared ui helpers: bottom sheets, confirm dialogs, loading overlay, formatting

export function escapeHtml(text){
  return String(text).replace(/[&<>"']/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]))
}

export function formatTime(milliseconds){
  const totalSeconds=Math.floor((milliseconds||0)/1000)
  const hours=Math.floor(totalSeconds/3600)
  const minutes=Math.floor((totalSeconds%3600)/60)
  const seconds=totalSeconds%60
  const padded=(value)=>String(value).padStart(2,'0')
  return hours?`${hours}:${padded(minutes)}:${padded(seconds)}`:`${padded(minutes)}:${padded(seconds)}`
}

let sheetOnClose=null

export function openSheet(html,{onClose=null,className=''}={}){
  closeSheet(true)
  const backdrop=document.createElement('div')
  backdrop.className='sheet-backdrop'
  backdrop.innerHTML=`<div class="sheet ${className}" role="dialog" aria-modal="true"><div class="sheet-grip"></div>${html}</div>`
  document.body.appendChild(backdrop)
  requestAnimationFrame(()=>backdrop.classList.add('is-open'))
  sheetOnClose=onClose
  backdrop.addEventListener('click',(event)=>{
    if(event.target===backdrop||event.target.closest('[data-close]'))closeSheet()
  })
  return backdrop.querySelector('.sheet')
}

export function closeSheet(silent=false){
  const backdrop=document.querySelector('.sheet-backdrop')
  if(!backdrop)return
  backdrop.classList.remove('is-open')
  backdrop.classList.add('is-closing')
  setTimeout(()=>backdrop.remove(),180)
  const callback=sheetOnClose
  sheetOnClose=null
  if(callback&&!silent)callback()
}

export function confirmSheet({title,text,confirmLabel='OK',cancelLabel='Cancel',danger=false}){
  return new Promise((resolve)=>{
    let answered=false
    const sheet=openSheet(`
      <h2>${escapeHtml(title)}</h2>
      ${text?`<p class="sheet-text">${escapeHtml(text)}</p>`:''}
      <div class="sheet-actions">
        <button class="secondary" data-answer="no">${escapeHtml(cancelLabel)}</button>
        <button class="${danger?'danger-fill':'primary'}" data-answer="yes">${escapeHtml(confirmLabel)}</button>
      </div>`,{onClose:()=>{if(!answered){answered=true;resolve(false)}}})
    sheet.addEventListener('click',(event)=>{
      const button=event.target.closest('[data-answer]')
      if(!button)return
      answered=true
      resolve(button.dataset.answer==='yes')
      closeSheet(true)
    })
  })
}

export function showLoading(text){
  hideLoading()
  const overlay=document.createElement('div')
  overlay.className='loading'
  overlay.innerHTML=`<div class="loading-card"><div class="loading-grid">${'<i></i>'.repeat(9)}</div><p>${escapeHtml(text)}</p></div>`
  document.body.appendChild(overlay)
}

export function hideLoading(){
  document.querySelectorAll('.loading').forEach((element)=>element.remove())
}

export function toast(text){
  const element=document.createElement('div')
  element.className='toast'
  element.textContent=text
  document.body.appendChild(element)
  requestAnimationFrame(()=>element.classList.add('is-visible'))
  setTimeout(()=>{
    element.classList.remove('is-visible')
    setTimeout(()=>element.remove(),300)
  },2400)
}
