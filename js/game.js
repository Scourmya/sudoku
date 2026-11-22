// the play screen: board, number pad, notes, undo, hints, timer and completion
import {createBoard} from './board.js'
import {ICONS} from './icons.js'
import {compile} from './engine/model.js'
import {findHint,TIER_NAMES} from './engine/logic.js'
import {MODE_BY_ID,DIFFICULTY_NAMES} from './engine/modes.js'
import {saveGame} from './storage.js'
import {formatTime,openSheet,closeSheet,confirmSheet,escapeHtml} from './ui.js'

export function newGameState(puzzle,daily=null){
  const cellCount=puzzle.size*puzzle.size
  return {
    puzzle,values:puzzle.givens.slice(),notes:new Array(cellCount).fill(0),
    elapsedMs:0,mistakes:0,hintsUsed:0,history:[],daily,solved:false,
    startedAt:new Date().toISOString()
  }
}

export function gameProgress(game){
  const puzzle=game.puzzle
  let open=0,filled=0
  puzzle.givens.forEach((given,cell)=>{
    if(given)return
    open++
    if(game.values[cell])filled++
  })
  return open?filled/open:1
}

export function mountGame(root,game,options){
  const {settings,onExit,onSolved,onNewPuzzle,onChangeLevel}=options
  const puzzle=game.puzzle
  const size=puzzle.size
  const cellCount=size*size
  const csp=compile(puzzle)
  const mode=MODE_BY_ID[puzzle.mode]
  let selected=-1
  let notesMode=false
  let paused=false
  let hintState=null
  let revealErrors=false
  let messageTimer=null
  let lastTick=performance.now()
  let destroyed=false

  const latin=puzzle.mode==='calcudoku'||puzzle.mode==='futoshiki'||puzzle.mode==='skyscrapers'
  const title=`${mode.name}${latin?` ${size}×${size}`:''}`
  const levelWord=game.daily?(game.daily.kind==='classic'?'Daily':'Daily variant'):'Difficulty'
  const firstRow=size<=5?size:Math.ceil(size/2)
  const padKey=(digit)=>`<button class="pad-key" data-digit="${digit}"><span class="pad-digit">${digit}</span><span class="pad-left"></span></button>`
  const padRows=[[...Array(firstRow).keys()].map((index)=>index+1),[...Array(size-firstRow).keys()].map((index)=>index+firstRow+1)].filter((row)=>row.length)

  root.innerHTML=`
    <section class="game">
      <header class="game-top">
        <button class="hud-button" data-action="back" aria-label="Home">${ICONS.home}</button>
        <div class="game-center">
          <button class="game-title" data-action="rules">${escapeHtml(title)}</button>
          <button class="timer" data-action="pause" aria-label="Pause"></button>
        </div>
        <button class="hud-button" data-action="menu" aria-label="Puzzle settings">${ICONS.gear}</button>
      </header>
      <div class="level-bar">
        <div class="level-info">
          <span class="level-word">${levelWord}</span>
          <span class="level-star"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg><b>${puzzle.difficulty}</b></span>
          <span class="level-name">${DIFFICULTY_NAMES[puzzle.difficulty]}</span>
        </div>
        <button class="level-change" data-action="change-level">Change difficulty</button>
      </div>
      <div class="board-wrap"><div class="board-holder"></div>
        <div class="pause-cover" hidden><button class="primary" data-action="resume">${ICONS.play}<span>Resume</span></button></div>
      </div>
      <div class="game-message" aria-live="polite"></div>
      <div class="game-stats-line"><span class="mistake-count"></span><span class="hint-count"></span></div>
      <div class="pad">${padRows.map((row)=>`<div class="pad-row">${row.map(padKey).join('')}</div>`).join('')}</div>
      <div class="dock">
        <div class="dock-row">
          <button class="round-tool" data-action="undo" aria-label="Undo">${ICONS.undo}<span>Undo</span></button>
          <button class="notes-toggle" data-action="notes" role="switch" aria-checked="false" aria-label="Pencil notes">
            <span class="toggle-track"><span class="toggle-word">NOTES</span></span><span class="toggle-knob">${ICONS.notes}</span>
          </button>
          <button class="round-tool" data-action="erase" aria-label="Erase">${ICONS.erase}<span>Erase</span></button>
        </div>
        <div class="dock-row dock-bottom">
          <button class="round-tool" data-action="reset" aria-label="Reset puzzle">${ICONS.reset}<span>Reset</span></button>
          <button class="hint-pill" data-action="hint">${ICONS.hint}<b>Hint</b><span class="hint-badge"></span></button>
          <button class="round-tool" data-action="rules" aria-label="Rules">${ICONS.help}<span>Rules</span></button>
        </div>
      </div>
    </section>`

  const elements={
    timerButton:root.querySelector('.timer'),
    mistakes:root.querySelector('.mistake-count'),hints:root.querySelector('.hint-count'),hintBadge:root.querySelector('.hint-badge'),
    message:root.querySelector('.game-message'),pad:root.querySelector('.pad'),
    notesButton:root.querySelector('.notes-toggle'),pauseCover:root.querySelector('.pause-cover')
  }
  const padKeys=[...root.querySelectorAll('.pad-key')]

  const board=createBoard(root.querySelector('.board-holder'),(cell)=>{
    if(paused||game.solved)return
    selected=cell
    render()
  })
  board.setPuzzle(puzzle)

  const gameElement=root.querySelector('.game')
  const boardWrap=root.querySelector('.board-wrap')
  const boardHolder=root.querySelector('.board-holder')
  function layout(){
    if(destroyed)return
    const style=getComputedStyle(gameElement)
    let used=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)
    for(const child of gameElement.children){
      if(child!==boardWrap&&child!==elements.message)used+=child.offsetHeight+parseFloat(getComputedStyle(child).marginTop)+parseFloat(getComputedStyle(child).marginBottom)
    }
    const availableHeight=gameElement.clientHeight-used-28
    const availableWidth=boardWrap.clientWidth
    const boardRatio=board.ratio()
    let width=availableWidth,height=width/boardRatio
    if(height>availableHeight){height=Math.max(availableHeight,160);width=height*boardRatio}
    boardHolder.style.width=width+'px'
    boardHolder.style.height=height+'px'
  }
  const resizeObserver=new ResizeObserver(()=>layout())
  resizeObserver.observe(gameElement)

  const peerHouses=csp.houses.filter((house)=>['row','column','box','region'].includes(house.kind))
  const cellPeerHouses=Array.from({length:cellCount},()=>[])
  peerHouses.forEach((house)=>house.cells.forEach((cell)=>cellPeerHouses[cell].push(house)))

  function peersOf(cell){
    const result=new Set()
    if(cell<0)return result
    for(const house of cellPeerHouses[cell])for(const other of house.cells)result.add(other)
    return result
  }

  function computeErrors(){
    const errors=new Set()
    const modeSetting=revealErrors?'solution':settings.mistakeMode
    if(modeSetting==='solution'){
      for(let cell=0;cell<cellCount;cell++){
        if(game.values[cell]&&!puzzle.givens[cell]&&game.values[cell]!==puzzle.solution[cell])errors.add(cell)
      }
    }else if(modeSetting==='conflicts'){
      for(let cell=0;cell<cellCount;cell++){
        const value=game.values[cell]
        if(!value||puzzle.givens[cell])continue
        for(const peer of csp.peers[cell]){
          if(game.values[peer]===value){errors.add(cell);break}
        }
      }
    }
    return errors
  }

  function render(){
    if(destroyed)return
    const hintCells=hintState&&hintState.house>=0?new Set(csp.houses[hintState.house].cells):null
    board.update({
      values:game.values,notes:game.notes,selected,errors:computeErrors(),
      peerCells:peersOf(selected),highlightPeers:settings.highlightPeers,highlightSame:settings.highlightSame,
      hintCell:hintState?hintState.cell:-1,hintCells,hidden:paused
    })
    const counts=new Array(size+1).fill(0)
    for(let cell=0;cell<cellCount;cell++){
      const value=game.values[cell]
      if(value&&value===puzzle.solution[cell])counts[value]++
    }
    const selectedNotes=selected>=0&&!game.values[selected]?game.notes[selected]:0
    for(const key of padKeys){
      const digit=Number(key.dataset.digit)
      const left=size-counts[digit]
      key.querySelector('.pad-left').textContent=left>0?left:''
      key.classList.toggle('is-done',left<=0&&settings.hideFinishedDigits)
      key.classList.toggle('is-noted',notesMode&&!!(selectedNotes&(1<<digit)))
    }
    elements.notesButton.classList.toggle('is-on',notesMode)
    elements.notesButton.setAttribute('aria-checked',notesMode?'true':'false')
    elements.pad.classList.toggle('notes-mode',notesMode)
    elements.mistakes.textContent=game.mistakes?`${game.mistakes} ${game.mistakes===1?'mistake':'mistakes'}`:''
    elements.hints.textContent=game.hintsUsed?`${game.hintsUsed} ${game.hintsUsed===1?'hint':'hints'} used`:''
    elements.hintBadge.textContent=game.hintsUsed?`×${game.hintsUsed}`:''
    elements.pauseCover.hidden=!paused
    elements.timerButton.classList.toggle('is-paused',paused)
    elements.timerButton.innerHTML=`${paused?ICONS.play:ICONS.pause}<span class="timer-text">${settings.showTimer?formatTime(game.elapsedMs):paused?'Paused':''}</span>`
    elements.timer=elements.timerButton.querySelector('.timer-text')
  }

  function showMessage(text,sticky=false){
    elements.message.textContent=text
    elements.message.classList.toggle('is-visible',!!text)
    clearTimeout(messageTimer)
    if(text&&!sticky)messageTimer=setTimeout(()=>showMessage(''),6000)
  }

  let saveTimer=null
  function persist(now=false){
    clearTimeout(saveTimer)
    if(game.solved)return
    if(now){saveGame(game);return}
    saveTimer=setTimeout(()=>saveGame(game),400)
  }

  function snapshot(cells){
    return cells.map((cell)=>[cell,game.values[cell],game.notes[cell]])
  }

  function pushHistory(entries){
    game.history.push(entries)
    if(game.history.length>300)game.history.shift()
  }

  function placeDigit(cell,value){
    const touched=[cell]
    if(settings.autoRemoveNotes){
      for(const peer of csp.peers[cell])if(game.notes[peer]&(1<<value))touched.push(peer)
    }
    pushHistory(snapshot(touched))
    game.values[cell]=value
    game.notes[cell]=0
    if(settings.autoRemoveNotes){
      for(const peer of touched)if(peer!==cell)game.notes[peer]&=~(1<<value)
    }
    if(value!==puzzle.solution[cell]){
      game.mistakes++
      if(settings.mistakeMode==='solution')showMessage(`${value} doesn't go there.`)
    }
    if(hintState&&hintState.cell===cell)hintState=null
    checkSolved()
  }

  function input(value){
    if(paused||game.solved)return
    if(selected<0){showMessage('Tap a cell first.');return}
    if(puzzle.givens[selected])return
    revealErrors=false
    if(notesMode){
      if(game.values[selected])return
      pushHistory(snapshot([selected]))
      game.notes[selected]^=1<<value
    }else if(game.values[selected]===value){
      pushHistory(snapshot([selected]))
      game.values[selected]=0
    }else{
      placeDigit(selected,value)
    }
    persist()
    render()
  }

  function erase(){
    if(paused||game.solved||selected<0||puzzle.givens[selected])return
    if(!game.values[selected]&&!game.notes[selected])return
    pushHistory(snapshot([selected]))
    game.values[selected]=0
    game.notes[selected]=0
    persist()
    render()
  }

  function undo(){
    if(paused||game.solved)return
    const entries=game.history.pop()
    if(!entries){showMessage('Nothing to undo.');return}
    for(const [cell,value,notes] of entries){
      game.values[cell]=value
      game.notes[cell]=notes
    }
    selected=entries[0][0]
    persist()
    render()
  }

  function hint(){
    if(paused||game.solved)return
    const wrong=[]
    for(let cell=0;cell<cellCount;cell++){
      if(game.values[cell]&&!puzzle.givens[cell]&&game.values[cell]!==puzzle.solution[cell])wrong.push(cell)
    }
    if(wrong.length){
      revealErrors=true
      selected=wrong[0]
      showMessage(wrong.length===1?'One digit is wrong. It is marked in red.':`${wrong.length} digits are wrong. They are marked in red.`,true)
      render()
      return
    }
    if(hintState&&!game.values[hintState.cell]){
      const {cell,value}=hintState
      selected=cell
      hintState=null
      placeDigit(cell,value)
      showMessage('')
      persist()
      render()
      return
    }
    const correctGrid=game.values.map((value,cell)=>value&&value===puzzle.solution[cell]?value:0)
    const found=findHint(csp,correctGrid)
    game.hintsUsed++
    if(found&&found.cell>=0){
      hintState={cell:found.cell,value:found.value,house:found.house}
      selected=found.cell
      const technique=found.tier>1?`${TIER_NAMES[found.tier]}: `:''
      showMessage(`${technique}${found.reason} Tap Hint again to fill it in.`,true)
    }else{
      let cell=selected>=0&&!game.values[selected]?selected:-1
      if(cell<0){
        const open=[]
        for(let index=0;index<cellCount;index++)if(!game.values[index])open.push(index)
        cell=open[Math.floor(Math.random()*open.length)]
      }
      selected=cell
      placeDigit(cell,puzzle.solution[cell])
      showMessage('No simple step from here, so a digit was filled in for you.')
    }
    persist()
    render()
  }

  function fillNotes(){
    pushHistory(snapshot([...Array(cellCount).keys()].filter((cell)=>!game.values[cell])))
    for(let cell=0;cell<cellCount;cell++){
      if(game.values[cell])continue
      let mask=csp.initialDomain[cell]
      for(const peer of csp.peers[cell])if(game.values[peer])mask&=~(1<<game.values[peer])
      game.notes[cell]=mask
    }
    persist()
    render()
  }

  function clearNotes(){
    pushHistory(snapshot([...Array(cellCount).keys()].filter((cell)=>game.notes[cell])))
    game.notes.fill(0)
    persist()
    render()
  }

  function restart(){
    game.values=puzzle.givens.slice()
    game.notes.fill(0)
    game.history=[]
    hintState=null
    revealErrors=false
    persist(true)
    render()
  }

  async function confirmReset(){
    if(paused||game.solved)return
    const touched=game.values.some((value,cell)=>value!==puzzle.givens[cell])||game.notes.some(Boolean)
    if(!touched){showMessage('Nothing to reset yet.');return}
    const sure=await confirmSheet({
      title:'Reset this puzzle?',
      text:'All your digits and notes will be cleared. The timer, mistakes and hints keep counting.',
      confirmLabel:'Reset',danger:true
    })
    if(sure){
      restart()
      showMessage('Puzzle reset.')
    }
  }

  function checkSolved(){
    for(let cell=0;cell<cellCount;cell++)if(game.values[cell]!==puzzle.solution[cell])return
    game.solved=true
    tick()
    stopTimer()
    selected=-1
    hintState=null
    render()
    root.querySelector('.game').classList.add('is-solved')
    onSolved(game)
  }

  function setPaused(value){
    if(game.solved)return
    tick()
    paused=value
    if(paused)persist(true)
    render()
  }

  function tick(){
    const now=performance.now()
    if(!paused&&!game.solved&&document.visibilityState==='visible'){
      game.elapsedMs+=Math.min(now-lastTick,5000)
    }
    lastTick=now
  }

  const timerId=setInterval(()=>{
    tick()
    if(settings.showTimer&&elements.timer)elements.timer.textContent=formatTime(game.elapsedMs)
  },1000)
  function stopTimer(){clearInterval(timerId)}

  const onVisibility=()=>{
    tick()
    if(document.visibilityState==='hidden'){
      persist(true)
    }
  }
  document.addEventListener('visibilitychange',onVisibility)
  const onPageHide=()=>{tick();persist(true)}
  window.addEventListener('pagehide',onPageHide)

  const onKey=(event)=>{
    if(document.querySelector('.sheet-backdrop:not(.is-closing)'))return
    if(/^[1-9]$/.test(event.key)&&Number(event.key)<=size){input(Number(event.key));return}
    const moves={ArrowUp:-size,ArrowDown:size,ArrowLeft:-1,ArrowRight:1}
    if(moves[event.key]!==undefined){
      event.preventDefault()
      if(selected<0)selected=0
      else{
        const next=selected+moves[event.key]
        if(next>=0&&next<cellCount&&!(event.key==='ArrowLeft'&&selected%size===0)&&!(event.key==='ArrowRight'&&selected%size===size-1))selected=next
      }
      render()
      return
    }
    if(event.key==='Backspace'||event.key==='Delete'||event.key==='0')erase()
    else if(event.key==='n'||event.key==='N'){notesMode=!notesMode;render()}
    else if((event.metaKey||event.ctrlKey)&&event.key==='z')undo()
  }
  document.addEventListener('keydown',onKey)

  function openRules(){
    openSheet(`
      <h2>${escapeHtml(mode.name)}</h2>
      <p class="sheet-rules">${escapeHtml(mode.rules)}</p>
      <dl class="facts">
        <div><dt>Level</dt><dd>${puzzle.difficulty} · ${DIFFICULTY_NAMES[puzzle.difficulty]}</dd></div>
        <div><dt>Hardest step needed</dt><dd>${TIER_NAMES[puzzle.tier]||'Singles'}</dd></div>
        <div><dt>Starting digits</dt><dd>${puzzle.givenCount}</dd></div>
      </dl>
      <button class="primary wide" data-close>Got it</button>`)
  }

  function openMenu(){
    const sheet=openSheet(`
      <h2>Puzzle</h2>
      <div class="menu-list">
        <button data-menu="rules">${ICONS.info}<span>Rules</span></button>
        <button data-menu="check">${ICONS.check}<span>Check my digits</span></button>
        <button data-menu="fill">${ICONS.notes}<span>Fill in all notes</span></button>
        <button data-menu="clear">${ICONS.erase}<span>Clear all notes</span></button>
        <button data-menu="restart">${ICONS.undo}<span>Restart this puzzle</span></button>
        <button data-menu="new">${ICONS.grid}<span>New puzzle, same level</span></button>
        <button data-menu="reveal" class="danger">${ICONS.close}<span>Show solution and give up</span></button>
      </div>`)
    sheet.addEventListener('click',(event)=>{
      const button=event.target.closest('[data-menu]')
      if(!button)return
      const choice=button.dataset.menu
      closeSheet()
      if(choice==='rules')openRules()
      else if(choice==='check'){
        revealErrors=true
        const errorCount=computeErrors().size
        showMessage(errorCount?`${errorCount} wrong ${errorCount===1?'digit':'digits'} marked in red.`:'Everything so far is correct.')
        render()
      }
      else if(choice==='fill')fillNotes()
      else if(choice==='clear')clearNotes()
      else if(choice==='restart')restart()
      else if(choice==='new')onNewPuzzle(game)
      else if(choice==='reveal'){
        game.values=puzzle.solution.slice()
        game.solved=true
        stopTimer()
        saveGame(null)
        selected=-1
        render()
        showMessage('Solution shown. This one will not count as solved.',true)
        root.querySelector('.tools').classList.add('is-disabled')
        elements.pad.classList.add('is-disabled')
      }
    })
  }

  root.querySelector('.game').addEventListener('click',(event)=>{
    const key=event.target.closest('.pad-key')
    if(key){input(Number(key.dataset.digit));return}
    const button=event.target.closest('[data-action]')
    if(!button)return
    switch(button.dataset.action){
      case 'back':tick();persist(true);onExit();break
      case 'pause':setPaused(!paused);break
      case 'resume':setPaused(false);break
      case 'menu':openMenu();break
      case 'rules':openRules();break
      case 'undo':undo();break
      case 'erase':erase();break
      case 'notes':notesMode=!notesMode;render();break
      case 'hint':hint();break
      case 'reset':confirmReset();break
      case 'change-level':tick();persist(true);onChangeLevel(game);break
      default:break
    }
  })

  render()
  layout()
  if(game.values.every((value,cell)=>value===puzzle.givens[cell])&&!game.history.length){
    showMessage(mode.short+' Tap the title for full rules.')
  }

  return {
    destroy(){
      destroyed=true
      tick()
      persist(true)
      stopTimer()
      clearTimeout(messageTimer)
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange',onVisibility)
      document.removeEventListener('keydown',onKey)
      window.removeEventListener('pagehide',onPageHide)
    },
    pause(){setPaused(true)}
  }
}
