// app shell: tabs, menus, daily puzzles, stats and settings
import {CATEGORIES,MODES,MODE_BY_ID,DIFFICULTY_NAMES,LATIN_SIZES} from './engine/modes.js'
import {ICONS} from './icons.js'
import {GLYPHS} from './glyphs.js'
import {generate,nextPuzzle,prefetch} from './generator-client.js'
import {mountGame,newGameState,gameProgress} from './game.js'
import {
  loadSettings,saveSettings,loadStats,saveStats,loadGame,saveGame,recordStart,recordSolve,modeLevelStats,
  localDateKey,currentStreak,exportBackup,importBackup,resetStats,compactGivens
} from './storage.js'
import {escapeHtml,formatTime,openSheet,closeSheet,confirmSheet,showLoading,hideLoading,toast} from './ui.js'

const APP_VERSION='1.0.0'
const LEVEL_NOTES=[
  '',
  'Plenty of starting digits. Singles only.',
  'Singles only.',
  'Fewer starting digits. Singles only.',
  'As few digits as singles allow.',
  'Needs locked candidates (pointing).',
  'Needs naked or hidden pairs.',
  'Needs triples or an X-Wing.',
  'Needs a little trial and error.',
  'Needs serious trial and error.'
]
const TABS=[
  {id:'play',label:'Play',icon:'grid'},
  {id:'daily',label:'Daily',icon:'calendar'},
  {id:'stats',label:'Stats',icon:'chart'},
  {id:'settings',label:'Settings',icon:'gear'}
]

const state={
  settings:loadSettings(),
  stats:loadStats(),
  tab:'play',
  game:null,
  calendarMonth:null,
  openStatsMode:null,
  historyLimit:30
}

const root=document.getElementById('app')

function applyTheme(){
  const theme=state.settings.theme
  if(theme==='auto')delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme=theme
  const dark=theme==='dark'||(theme==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]').setAttribute('content',dark?'#14142a':theme==='paper'?'#f3efe6':'#f6f5fc')
}

function renderShell(){
  root.innerHTML=`
    <div class="tab-view" id="tab-view"></div>
    <div class="game-view" id="game-view" hidden></div>
    <nav class="tabbar" id="tabbar">
      ${TABS.map((tab)=>`<button class="tab" data-tab="${tab.id}">${ICONS[tab.icon]}<span>${tab.label}</span></button>`).join('')}
    </nav>`
  root.querySelector('#tabbar').addEventListener('click',(event)=>{
    const button=event.target.closest('[data-tab]')
    if(button)showTab(button.dataset.tab)
  })
  root.querySelector('#tab-view').addEventListener('click',onTabClick)
  root.querySelector('#tab-view').addEventListener('change',onTabChange)
}

function showTab(tab){
  state.tab=tab
  for(const button of root.querySelectorAll('.tab'))button.classList.toggle('is-active',button.dataset.tab===tab)
  const view=root.querySelector('#tab-view')
  if(tab==='play')view.innerHTML=renderPlay()
  else if(tab==='daily')view.innerHTML=renderDaily()
  else if(tab==='stats')view.innerHTML=renderStats()
  else view.innerHTML=renderSettings()
  view.scrollTop=0
}

function refreshTab(){
  const view=root.querySelector('#tab-view')
  const scroll=view.scrollTop
  showTab(state.tab)
  view.scrollTop=scroll
}

function modeDisplayName(puzzle){
  const mode=MODE_BY_ID[puzzle.mode]
  return LATIN_SIZES[puzzle.mode]?`${mode.name} ${puzzle.size}×${puzzle.size}`:mode.name
}

function solvedCountForMode(modeId){
  const byLevel=state.stats.byMode[modeId]||{}
  return Object.values(byLevel).reduce((total,level)=>total+level.solved,0)
}

function renderContinueCard(){
  const saved=loadGame()
  if(!saved||saved.solved)return ''
  const progress=Math.round(gameProgress(saved)*100)
  const puzzle=saved.puzzle
  return `
    <button class="continue-card" data-action="continue">
      <span class="continue-glyph">${GLYPHS[puzzle.mode]}</span>
      <span class="continue-text">
        <small>Continue</small>
        <b>${escapeHtml(modeDisplayName(puzzle))}</b>
        <span>Level ${puzzle.difficulty} · ${formatTime(saved.elapsedMs)} · ${progress}% filled</span>
      </span>
      <span class="continue-play">${ICONS.play}</span>
    </button>`
}

function renderPlay(){
  const today=dailyFor(localDateKey())
  const todayRecord=state.stats.daily[localDateKey()]||{}
  const totalSolved=state.stats.history.length
  return `
    <header class="page-head">
      <h1>Sudoku</h1>
      <p class="subtle">${MODES.length} puzzle types · levels 1–9 · ${totalSolved} solved</p>
    </header>
    ${renderContinueCard()}
    <button class="daily-strip" data-action="goto-daily">
      ${ICONS.calendar}
      <span><b>Today's daily</b><small>Classic level ${dailyLevelFor(localDateKey(),'classic')}${todayRecord.classic?' · solved':''} · ${escapeHtml(MODE_BY_ID[today.variant.mode].name)}${todayRecord.variant?' · solved':''}</small></span>
      ${ICONS.chevron}
    </button>
    ${CATEGORIES.map((category)=>`
      <section class="category">
        <h2>${escapeHtml(category.name)}</h2>
        <p class="subtle">${escapeHtml(category.blurb)}</p>
        <div class="mode-list">
          ${MODES.filter((mode)=>mode.category===category.id).map((mode)=>{
            const solved=solvedCountForMode(mode.id)
            return `<button class="mode-row" data-mode="${mode.id}">
              <span class="mode-glyph">${GLYPHS[mode.id]}</span>
              <span class="mode-text"><b>${escapeHtml(mode.name)}</b><small>${escapeHtml(mode.short)}</small></span>
              ${solved?`<span class="mode-count">${solved}</span>`:''}
              ${ICONS.chevron}
            </button>`
          }).join('')}
        </div>
      </section>`).join('')}
    <p class="footnote">Every puzzle is generated on your phone and has exactly one solution.</p>`
}

function openModeSheet(modeId){
  const mode=MODE_BY_ID[modeId]
  let level=state.settings.lastDifficulty[modeId]||3
  const sheet=openSheet(`
    <div class="sheet-head">
      <span class="mode-glyph big">${GLYPHS[modeId]}</span>
      <div><h2>${escapeHtml(mode.name)}</h2><p class="subtle">${escapeHtml(mode.short)}</p></div>
    </div>
    <p class="sheet-rules">${escapeHtml(mode.rules)}</p>
    <div class="level-grid"></div>
    <div class="level-detail"></div>
    <button class="primary wide" data-start></button>`)
  const draw=()=>{
    sheet.querySelector('.level-grid').innerHTML=Array.from({length:9},(unused,index)=>{
      const value=index+1
      const record=(state.stats.byMode[modeId]||{})[value]
      return `<button class="level${value===level?' is-selected':''}" data-level="${value}">
        <b>${value}</b><span>${DIFFICULTY_NAMES[value]}</span>${record&&record.solved?`<small>${record.solved} ✓</small>`:'<small>&nbsp;</small>'}
      </button>`
    }).join('')
    const record=(state.stats.byMode[modeId]||{})[level]
    const sizeNote=LATIN_SIZES[modeId]?`${LATIN_SIZES[modeId][level]}×${LATIN_SIZES[modeId][level]} grid. `:''
    sheet.querySelector('.level-detail').innerHTML=`
      <p>${sizeNote}${LEVEL_NOTES[level]}</p>
      ${record&&record.solved?`<p class="subtle">Best ${formatTime(record.bestMs)} · average ${formatTime(record.totalMs/record.solved)} · solved ${record.solved}</p>`:'<p class="subtle">Not solved yet at this level.</p>'}`
    sheet.querySelector('[data-start]').textContent=`Play level ${level}`
  }
  draw()
  sheet.addEventListener('click',async(event)=>{
    const levelButton=event.target.closest('[data-level]')
    if(levelButton){
      level=Number(levelButton.dataset.level)
      draw()
      return
    }
    if(event.target.closest('[data-start]')){
      state.settings.lastDifficulty[modeId]=level
      saveSettings(state.settings)
      closeSheet(true)
      await startNewPuzzle(modeId,level)
    }
  })
}

async function confirmAbandon(){
  const saved=loadGame()
  if(!saved||saved.solved||gameProgress(saved)===0)return true
  return confirmSheet({
    title:'Start a new puzzle?',
    text:`Your ${modeDisplayName(saved.puzzle)} level ${saved.puzzle.difficulty} in progress will be dropped.`,
    confirmLabel:'Start new',danger:true
  })
}

async function startNewPuzzle(modeId,level,{skipConfirm=false}={}){
  if(!skipConfirm&&!(await confirmAbandon()))return
  showLoading(`Building a level ${level} ${MODE_BY_ID[modeId].name}…`)
  try{
    const puzzle=await nextPuzzle(modeId,level)
    hideLoading()
    startGame(puzzle,null)
    setTimeout(()=>prefetch(modeId,level),1500)
  }catch(error){
    hideLoading()
    toast('Could not build that puzzle. Try again.')
  }
}

function startGame(puzzle,daily){
  closeGame()
  const game=newGameState(puzzle,daily)
  recordStart(state.stats,puzzle.mode,puzzle.difficulty)
  saveGame(game)
  openGame(game)
}

function openGame(game){
  closeGame()
  const view=root.querySelector('#game-view')
  root.querySelector('#tab-view').hidden=true
  root.querySelector('#tabbar').hidden=true
  view.hidden=false
  state.game=mountGame(view,game,{
    settings:state.settings,
    onExit:()=>{
      closeGame()
      refreshTab()
    },
    onSolved:(solvedGame)=>onSolved(solvedGame),
    onChangeLevel:(currentGame)=>{
      if(currentGame.daily)openDailySheet(currentGame.daily.date,currentGame.daily.kind)
      else openModeSheet(currentGame.puzzle.mode)
    },
    onNewPuzzle:(currentGame)=>{
      if(currentGame.daily){
        closeGame()
        showTab('daily')
        return
      }
      saveGame(null)
      startNewPuzzle(currentGame.puzzle.mode,currentGame.puzzle.difficulty,{skipConfirm:true})
    }
  })
}

function closeGame(){
  if(state.game){
    state.game.destroy()
    state.game=null
  }
  const view=root.querySelector('#game-view')
  view.hidden=true
  view.innerHTML=''
  root.querySelector('#tab-view').hidden=false
  root.querySelector('#tabbar').hidden=false
}

function onSolved(game){
  saveGame(null)
  const {isBest,level}=recordSolve(state.stats,game)
  const puzzle=game.puzzle
  const streak=currentStreak(state.stats)
  setTimeout(()=>{
    const sheet=openSheet(`
      <div class="solved-badge">${ICONS.check}</div>
      <h2 class="center">Solved!</h2>
      <p class="subtle center">${escapeHtml(modeDisplayName(puzzle))} · level ${puzzle.difficulty} · ${DIFFICULTY_NAMES[puzzle.difficulty]}</p>
      <dl class="facts">
        <div><dt>Time</dt><dd>${formatTime(game.elapsedMs)}${isBest&&level.solved>1?' <em>new best</em>':''}</dd></div>
        <div><dt>Mistakes</dt><dd>${game.mistakes}</dd></div>
        <div><dt>Hints</dt><dd>${game.hintsUsed}</dd></div>
        <div><dt>Solved at this level</dt><dd>${level.solved}</dd></div>
        ${game.daily&&game.daily.kind==='classic'?`<div><dt>Daily streak</dt><dd>${streak} ${streak===1?'day':'days'}</dd></div>`:''}
      </dl>
      <div class="sheet-actions">
        <button class="secondary" data-done="menu">Menu</button>
        <button class="primary" data-done="next">${game.daily?'Back to daily':'Next puzzle'}</button>
      </div>`,{className:'solved-sheet'})
    sheet.addEventListener('click',(event)=>{
      const button=event.target.closest('[data-done]')
      if(!button)return
      closeSheet(true)
      closeGame()
      if(button.dataset.done==='next'){
        if(game.daily){showTab('daily');return}
        showTab('play')
        startNewPuzzle(puzzle.mode,puzzle.difficulty,{skipConfirm:true})
      }else{
        showTab(game.daily?'daily':'play')
      }
    })
  },650)
}

function dailyFor(dateKey){
  const date=new Date(dateKey+'T12:00:00')
  const classicLevel=[3,4,5,5,6,7,8][date.getDay()]
  const dayNumber=Math.floor(date.getTime()/86400000)
  const variants=MODES.filter((mode)=>mode.id!=='classic')
  const variant=variants[dayNumber%variants.length]
  return {
    classic:{mode:'classic',difficulty:classicLevel,seed:'daily-'+dateKey},
    variant:{mode:variant.id,difficulty:5,seed:'daily-'+dateKey}
  }
}

function dailyLevelFor(dateKey,kind){
  const chosen=(state.settings.dailyLevel||{})[kind]
  return chosen||dailyFor(dateKey)[kind].difficulty
}

function savedDaily(dateKey,kind){
  const saved=loadGame()
  return saved&&!saved.solved&&saved.daily&&saved.daily.date===dateKey&&saved.daily.kind===kind?saved:null
}

function openDailySheet(dateKey,kind){
  const spec=dailyFor(dateKey)[kind]
  const mode=MODE_BY_ID[spec.mode]
  let level=dailyLevelFor(dateKey,kind)
  const solvedLevels=new Set(state.stats.history.filter((entry)=>entry.daily===kind&&entry.dailyDate===dateKey).map((entry)=>entry.difficulty))
  const label=new Date(dateKey+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})
  const sheet=openSheet(`
    <div class="sheet-head">
      <span class="mode-glyph big">${GLYPHS[spec.mode]}</span>
      <div><h2>${kind==='classic'?'Daily Classic':`Daily ${escapeHtml(mode.name)}`}</h2><p class="subtle">${escapeHtml(label)}</p></div>
    </div>
    ${kind==='variant'?`<p class="sheet-rules">${escapeHtml(mode.rules)}</p>`:'<p class="sheet-rules">Pick a difficulty. Each level has its own puzzle for this day.</p>'}
    <div class="level-grid"></div>
    <div class="level-detail"></div>
    <button class="primary wide" data-start></button>`)
  const draw=()=>{
    sheet.querySelector('.level-grid').innerHTML=Array.from({length:9},(unused,index)=>{
      const value=index+1
      return `<button class="level${value===level?' is-selected':''}" data-level="${value}">
        <b>${value}</b><span>${DIFFICULTY_NAMES[value]}</span><small>${solvedLevels.has(value)?'solved ✓':value===spec.difficulty?'suggested':'&nbsp;'}</small>
      </button>`
    }).join('')
    const sizeNote=LATIN_SIZES[spec.mode]?`${LATIN_SIZES[spec.mode][level]}×${LATIN_SIZES[spec.mode][level]} grid. `:''
    sheet.querySelector('.level-detail').innerHTML=`
      <p>${sizeNote}${LEVEL_NOTES[level]}</p>
      <p class="subtle">${kind==='classic'?'Solving any level keeps your daily streak going.':'Solving it marks the day with a variant dot.'}</p>`
    const resume=savedDaily(dateKey,kind)
    sheet.querySelector('[data-start]').textContent=resume&&resume.puzzle.difficulty===level?`Continue level ${level}`:`Play level ${level}`
  }
  draw()
  sheet.addEventListener('click',(event)=>{
    const levelButton=event.target.closest('[data-level]')
    if(levelButton){
      level=Number(levelButton.dataset.level)
      draw()
      return
    }
    if(event.target.closest('[data-start]')){
      state.settings.dailyLevel={...(state.settings.dailyLevel||{}),[kind]:level}
      saveSettings(state.settings)
      closeSheet(true)
      playDaily(dateKey,kind,level)
    }
  })
}

async function playDaily(dateKey,kind,level=dailyLevelFor(dateKey,kind)){
  const spec=dailyFor(dateKey)[kind]
  const saved=savedDaily(dateKey,kind)
  if(saved&&saved.puzzle.difficulty===level){
    openGame(saved)
    return
  }
  if(!(await confirmAbandon()))return
  showLoading(`Building the ${kind==='classic'?'daily classic':'daily '+MODE_BY_ID[spec.mode].name}…`)
  try{
    const puzzle=await generate(spec.mode,level,spec.seed)
    hideLoading()
    startGame(puzzle,{kind,date:dateKey})
  }catch(error){
    hideLoading()
    toast('Could not build the daily puzzle.')
  }
}

function renderDaily(){
  const todayKey=localDateKey()
  const today=dailyFor(todayKey)
  const record=state.stats.daily[todayKey]||{}
  const streak=currentStreak(state.stats)
  const now=new Date()
  if(!state.calendarMonth)state.calendarMonth={year:now.getFullYear(),month:now.getMonth()}
  const {year,month}=state.calendarMonth
  const first=new Date(year,month,1)
  const daysInMonth=new Date(year,month+1,0).getDate()
  const offset=first.getDay()
  const monthName=first.toLocaleDateString(undefined,{month:'long',year:'numeric'})
  const cells=[]
  for(let blank=0;blank<offset;blank++)cells.push('<span class="day is-blank"></span>')
  let monthSolved=0
  for(let day=1;day<=daysInMonth;day++){
    const key=localDateKey(new Date(year,month,day))
    const dayRecord=state.stats.daily[key]||{}
    const future=key>todayKey
    if(dayRecord.classic)monthSolved++
    cells.push(`<button class="day${key===todayKey?' is-today':''}${dayRecord.classic?' is-solved':''}${future?' is-future':''}" data-day="${key}" ${future?'disabled':''}>
      <span>${day}</span>${dayRecord.variant?'<i class="variant-dot"></i>':''}
    </button>`)
  }
  const variantMode=MODE_BY_ID[today.variant.mode]
  const classicLevel=dailyLevelFor(todayKey,'classic'),variantLevel=dailyLevelFor(todayKey,'variant')
  const savedGame=loadGame()
  const inProgress=(kind)=>savedGame&&!savedGame.solved&&savedGame.daily&&savedGame.daily.date===todayKey&&savedGame.daily.kind===kind
  const card=(kind,title,subtitle,glyph)=>{
    const done=record[kind]
    const historyEntry=done?state.stats.history.find((entry)=>entry.daily===kind&&entry.dailyDate===todayKey):null
    return `<button class="daily-card${done?' is-done':''}" data-daily="${kind}">
      <span class="mode-glyph">${glyph}</span>
      <span class="daily-text"><b>${title}</b><small>${subtitle}</small></span>
      <span class="daily-status">${done?`${ICONS.check}<small>${historyEntry?formatTime(historyEntry.ms):''}</small>`:inProgress(kind)?'<small>Continue</small>':'<small>Play</small>'}</span>
    </button>`
  }
  return `
    <header class="page-head">
      <h1>Daily</h1>
      <p class="subtle">${now.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})}</p>
    </header>
    <div class="streak-row">
      <div class="streak-box">${ICONS.flame}<b>${streak}</b><small>day streak</small></div>
      <div class="streak-box"><b>${state.stats.bestStreak}</b><small>best streak</small></div>
      <div class="streak-box"><b>${monthSolved}</b><small>this month</small></div>
    </div>
    <div class="daily-cards">
      ${card('classic','Daily Classic',`Level ${classicLevel} · ${DIFFICULTY_NAMES[classicLevel]}`,GLYPHS.classic)}
      ${card('variant',`Daily ${variantMode.name}`,`Level ${variantLevel} · ${escapeHtml(variantMode.short)}`,GLYPHS[variantMode.id])}
    </div>
    <p class="footnote">Tap a card to pick its difficulty. The suggested classic level rises through the week, and solving the classic at any level keeps your streak alive.</p>
    <section class="calendar">
      <div class="calendar-head">
        <button class="icon-button" data-month="-1" aria-label="Previous month">${ICONS.back}</button>
        <b>${monthName}</b>
        <button class="icon-button flip" data-month="1" aria-label="Next month">${ICONS.back}</button>
      </div>
      <div class="weekdays">${['S','M','T','W','T','F','S'].map((letter)=>`<span>${letter}</span>`).join('')}</div>
      <div class="days">${cells.join('')}</div>
      <p class="legend"><span class="legend-solved"></span> classic solved <i class="variant-dot"></i> variant solved</p>
    </section>`
}

function openDaySheet(dateKey){
  const spec=dailyFor(dateKey)
  const record=state.stats.daily[dateKey]||{}
  const label=new Date(dateKey+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})
  const sheet=openSheet(`
    <h2>${escapeHtml(label)}</h2>
    <div class="menu-list">
      <button data-kind="classic">${GLYPHS.classic}<span>Daily Classic${record.classic?' · solved':''}</span></button>
      <button data-kind="variant">${GLYPHS[spec.variant.mode]}<span>Daily ${escapeHtml(MODE_BY_ID[spec.variant.mode].name)}${record.variant?' · solved':''}</span></button>
    </div>`)
  sheet.addEventListener('click',(event)=>{
    const button=event.target.closest('[data-kind]')
    if(!button)return
    closeSheet(true)
    setTimeout(()=>openDailySheet(dateKey,button.dataset.kind),200)
  })
}

function renderStats(){
  const stats=state.stats
  const solved=stats.history.length
  const totalMs=stats.history.reduce((total,entry)=>total+entry.ms,0)
  const rate=stats.started?Math.round(solved/stats.started*100):0
  const modesPlayed=MODES.filter((mode)=>stats.byMode[mode.id])
  const history=stats.history.slice(0,state.historyLimit)
  return `
    <header class="page-head"><h1>Stats</h1><p class="subtle">Everything you have solved.</p></header>
    <div class="tiles">
      <div class="tile"><b>${solved}</b><small>solved</small></div>
      <div class="tile"><b>${formatHours(totalMs)}</b><small>time solving</small></div>
      <div class="tile"><b>${rate}%</b><small>finish rate</small></div>
      <div class="tile"><b>${currentStreak(stats)}</b><small>daily streak</small></div>
      <div class="tile"><b>${stats.bestStreak}</b><small>best streak</small></div>
      <div class="tile"><b>${new Set(stats.history.map((entry)=>entry.mode)).size}/${MODES.length}</b><small>types solved</small></div>
    </div>
    <h2 class="section-title">By puzzle type</h2>
    ${modesPlayed.length?`<div class="mode-stats">${modesPlayed.map((mode)=>{
      const byLevel=stats.byMode[mode.id]
      const modeSolved=Object.values(byLevel).reduce((total,level)=>total+level.solved,0)
      const levels=Object.keys(byLevel).map(Number).sort((left,right)=>left-right)
      const best=levels.filter((level)=>byLevel[level].solved).map((level)=>level)
      const open=state.openStatsMode===mode.id
      return `<div class="mode-stat${open?' is-open':''}">
        <button class="mode-stat-head" data-stats-mode="${mode.id}">
          <span class="mode-glyph">${GLYPHS[mode.id]}</span>
          <span class="mode-text"><b>${escapeHtml(mode.name)}</b><small>${modeSolved} solved${best.length?` · highest level ${Math.max(...best)}`:''}</small></span>
          ${ICONS.chevron}
        </button>
        ${open?`<table class="level-table"><thead><tr><th>Level</th><th>Solved</th><th>Best</th><th>Average</th></tr></thead><tbody>
          ${levels.map((level)=>{
            const record=byLevel[level]
            return `<tr><td>${level} <small>${DIFFICULTY_NAMES[level]}</small></td><td>${record.solved}/${record.started}</td><td>${record.solved?formatTime(record.bestMs):'–'}</td><td>${record.solved?formatTime(record.totalMs/record.solved):'–'}</td></tr>`
          }).join('')}
        </tbody></table>`:''}
      </div>`
    }).join('')}</div>`:'<p class="empty">Play a puzzle and your numbers will show up here.</p>'}
    <h2 class="section-title">Solved puzzles</h2>
    ${history.length?`<div class="history">${history.map((entry,index)=>{
      const mode=MODE_BY_ID[entry.mode]
      const when=new Date(entry.solvedAt)
      return `<button class="history-row" data-history="${index}">
        <span class="mode-glyph">${GLYPHS[entry.mode]}</span>
        <span class="mode-text"><b>${escapeHtml(mode?mode.name:entry.mode)} · ${entry.difficulty}</b><small>${when.toLocaleDateString(undefined,{day:'numeric',month:'short'})} ${when.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}${entry.daily?' · daily':''}</small></span>
        <span class="history-time">${formatTime(entry.ms)}<small>${entry.mistakes?`${entry.mistakes} miss`:''}${entry.mistakes&&entry.hints?' · ':''}${entry.hints?`${entry.hints} hint`:''}</small></span>
      </button>`
    }).join('')}</div>
    ${stats.history.length>state.historyLimit?'<button class="secondary wide" data-action="more-history">Show more</button>':''}`:'<p class="empty">No solved puzzles yet.</p>'}`
}

function formatHours(milliseconds){
  const minutes=Math.round(milliseconds/60000)
  if(minutes<60)return `${minutes}m`
  return `${Math.floor(minutes/60)}h ${minutes%60}m`
}

function openHistorySheet(index){
  const entry=state.stats.history[index]
  if(!entry)return
  const mode=MODE_BY_ID[entry.mode]
  const sheet=openSheet(`
    <div class="sheet-head"><span class="mode-glyph big">${GLYPHS[entry.mode]}</span>
      <div><h2>${escapeHtml(mode.name)} · level ${entry.difficulty}</h2><p class="subtle">${new Date(entry.solvedAt).toLocaleString()}</p></div></div>
    <dl class="facts">
      <div><dt>Time</dt><dd>${formatTime(entry.ms)}</dd></div>
      <div><dt>Mistakes</dt><dd>${entry.mistakes}</dd></div>
      <div><dt>Hints</dt><dd>${entry.hints}</dd></div>
      ${entry.daily?`<div><dt>Daily</dt><dd>${entry.dailyDate}</dd></div>`:''}
      <div><dt>Puzzle code</dt><dd class="mono">${escapeHtml(entry.seed)}</dd></div>
    </dl>
    <button class="primary wide" data-replay>Play this puzzle again</button>`)
  sheet.addEventListener('click',async(event)=>{
    if(!event.target.closest('[data-replay]'))return
    closeSheet(true)
    if(!(await confirmAbandon()))return
    showLoading('Rebuilding that puzzle…')
    try{
      const puzzle=await generate(entry.mode,entry.difficulty,entry.seed)
      hideLoading()
      if(compactGivens(puzzle.givens)!==entry.givens)toast('The generator changed since then, so this is a close cousin.')
      startGame(puzzle,null)
    }catch(error){
      hideLoading()
      toast('Could not rebuild that puzzle.')
    }
  })
}

function toggleRow(id,label,description,checked){
  return `<label class="setting-row">
    <span><b>${label}</b>${description?`<small>${description}</small>`:''}</span>
    <input type="checkbox" data-setting="${id}" ${checked?'checked':''}><i class="switch"></i>
  </label>`
}

function segmented(id,options,value){
  return `<div class="segmented" role="radiogroup">${options.map(([optionValue,label])=>`<button data-segment="${id}" data-value="${optionValue}" class="${optionValue===value?'is-selected':''}">${label}</button>`).join('')}</div>`
}

function renderSettings(){
  const settings=state.settings
  return `
    <header class="page-head"><h1>Settings</h1></header>
    <section class="group">
      <h2 class="section-title">Mistakes</h2>
      ${segmented('mistakeMode',[['off','Off'],['conflicts','Conflicts'],['solution','Instant']],settings.mistakeMode)}
      <p class="footnote">Instant marks any digit that does not match the solution. Conflicts only marks repeats in a row, column or region. Mistakes are always counted in your stats.</p>
    </section>
    <section class="group">
      <h2 class="section-title">While playing</h2>
      ${toggleRow('highlightPeers','Highlight row, column and box','',settings.highlightPeers)}
      ${toggleRow('highlightSame','Highlight matching digits','',settings.highlightSame)}
      ${toggleRow('autoRemoveNotes','Clean up notes automatically','Placing a digit removes it from notes in the same row, column and region.',settings.autoRemoveNotes)}
      ${toggleRow('hideFinishedDigits','Dim finished digits','',settings.hideFinishedDigits)}
      ${toggleRow('showTimer','Show timer','',settings.showTimer)}
    </section>
    <section class="group">
      <h2 class="section-title">Appearance</h2>
      ${segmented('theme',[['auto','Auto'],['light','Light'],['dark','Dark'],['paper','Paper']],settings.theme)}
      <p class="footnote">Auto follows your phone's light or dark setting.</p>
    </section>
    <section class="group">
      <h2 class="section-title">Backup</h2>
      <p class="footnote">Stats live on this phone. Export a backup now and then so nothing is lost if you reinstall.</p>
      <div class="button-row">
        <button class="secondary" data-action="export">${ICONS.share}<span>Export</span></button>
        <label class="secondary file-button">${ICONS.upload}<span>Import</span><input type="file" accept="application/json,.json" data-action="import" hidden></label>
      </div>
    </section>
    <section class="group">
      <h2 class="section-title">Install on iPhone</h2>
      <ol class="steps">
        <li>Open this page in Safari.</li>
        <li>Tap the Share button, then <b>Add to Home Screen</b>.</li>
        <li>Open Sudoku from the home screen. It runs full screen and works offline.</li>
      </ol>
    </section>
    <section class="group">
      <button class="danger-outline wide" data-action="reset-stats">Reset all stats</button>
    </section>
    <p class="footnote center">Sudoku ${APP_VERSION}</p>`
}

async function exportStats(){
  const text=exportBackup()
  const name=`sudoku-backup-${localDateKey()}.json`
  try{
    const file=new File([text],name,{type:'application/json'})
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:'Sudoku backup'})
      return
    }
  }catch(error){
    if(error&&error.name==='AbortError')return
  }
  const link=document.createElement('a')
  link.href=URL.createObjectURL(new Blob([text],{type:'application/json'}))
  link.download=name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(()=>URL.revokeObjectURL(link.href),2000)
}

async function onTabClick(event){
  const target=event.target
  const modeButton=target.closest('[data-mode]')
  if(modeButton){openModeSheet(modeButton.dataset.mode);return}
  const dailyButton=target.closest('[data-daily]')
  if(dailyButton){
    const kind=dailyButton.dataset.daily
    const resume=savedDaily(localDateKey(),kind)
    if(resume)openGame(resume)
    else openDailySheet(localDateKey(),kind)
    return
  }
  const dayButton=target.closest('[data-day]')
  if(dayButton){openDaySheet(dayButton.dataset.day);return}
  const monthButton=target.closest('[data-month]')
  if(monthButton){
    const step=Number(monthButton.dataset.month)
    const {year,month}=state.calendarMonth
    const next=new Date(year,month+step,1)
    state.calendarMonth={year:next.getFullYear(),month:next.getMonth()}
    refreshTab()
    return
  }
  const statsMode=target.closest('[data-stats-mode]')
  if(statsMode){
    state.openStatsMode=state.openStatsMode===statsMode.dataset.statsMode?null:statsMode.dataset.statsMode
    refreshTab()
    return
  }
  const historyRow=target.closest('[data-history]')
  if(historyRow){openHistorySheet(Number(historyRow.dataset.history));return}
  const segment=target.closest('[data-segment]')
  if(segment){
    state.settings[segment.dataset.segment]=segment.dataset.value
    saveSettings(state.settings)
    if(segment.dataset.segment==='theme')applyTheme()
    refreshTab()
    return
  }
  const action=target.closest('[data-action]')
  if(!action||action.tagName==='INPUT')return
  switch(action.dataset.action){
    case 'continue':{
      const saved=loadGame()
      if(saved)openGame(saved)
      break
    }
    case 'goto-daily':showTab('daily');break
    case 'more-history':state.historyLimit+=50;refreshTab();break
    case 'export':exportStats();break
    case 'reset-stats':{
      const sure=await confirmSheet({title:'Reset all stats?',text:'This clears your solved history, best times and streaks. It cannot be undone.',confirmLabel:'Reset',danger:true})
      if(sure){
        resetStats()
        state.stats=loadStats()
        toast('Stats reset.')
        refreshTab()
      }
      break
    }
    default:break
  }
}

function onTabChange(event){
  const target=event.target
  if(target.dataset.setting){
    state.settings[target.dataset.setting]=target.checked
    saveSettings(state.settings)
    return
  }
  if(target.dataset.action==='import'&&target.files&&target.files[0]){
    const reader=new FileReader()
    reader.onload=()=>{
      try{
        importBackup(String(reader.result))
        state.settings=loadSettings()
        state.stats=loadStats()
        applyTheme()
        toast('Backup restored.')
        refreshTab()
      }catch(error){
        toast(error.message||'That file could not be read.')
      }
    }
    reader.readAsText(target.files[0])
    target.value=''
  }
}

function boot(){
  applyTheme()
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme)
  renderShell()
  showTab('play')
  if('serviceWorker' in navigator&&location.protocol!=='file:'&&!/localhost|127\.0\.0\.1/.test(location.hostname)){
    navigator.serviceWorker.register('sw.js').catch(()=>{})
  }
  saveStats(state.stats)
}

boot()

export {state,modeLevelStats}
