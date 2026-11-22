// settings, stats, history and the saved game, all in localStorage

const KEYS={settings:'sudoku.settings.v1',stats:'sudoku.stats.v1',game:'sudoku.game.v1'}
export const ENGINE_VERSION=1

export const DEFAULT_SETTINGS={
  mistakeMode:'solution',
  highlightPeers:true,
  highlightSame:true,
  autoRemoveNotes:true,
  hideFinishedDigits:true,
  showTimer:true,
  theme:'auto',
  lastDifficulty:{}
}

function read(key,fallback){
  try{
    const text=localStorage.getItem(key)
    return text?JSON.parse(text):fallback
  }catch(error){
    return fallback
  }
}

function write(key,value){
  try{
    localStorage.setItem(key,JSON.stringify(value))
    return true
  }catch(error){
    return false
  }
}

export function loadSettings(){
  return {...DEFAULT_SETTINGS,...read(KEYS.settings,{})}
}

export function saveSettings(settings){
  write(KEYS.settings,settings)
}

function emptyStats(){
  return {version:1,started:0,byMode:{},history:[],daily:{},bestStreak:0}
}

export function loadStats(){
  const stats=read(KEYS.stats,null)
  return stats&&stats.version===1?stats:emptyStats()
}

export function saveStats(stats){
  write(KEYS.stats,stats)
}

export function loadGame(){
  return read(KEYS.game,null)
}

export function saveGame(game){
  if(!game){
    try{localStorage.removeItem(KEYS.game)}catch(error){}
    return
  }
  write(KEYS.game,game)
}

export function modeLevelStats(stats,mode,difficulty){
  const byLevel=stats.byMode[mode]||(stats.byMode[mode]={})
  return byLevel[difficulty]||(byLevel[difficulty]={started:0,solved:0,bestMs:0,totalMs:0})
}

export function recordStart(stats,mode,difficulty){
  stats.started++
  modeLevelStats(stats,mode,difficulty).started++
  saveStats(stats)
}

export function recordSolve(stats,game){
  const puzzle=game.puzzle
  const level=modeLevelStats(stats,puzzle.mode,puzzle.difficulty)
  const isBest=!level.bestMs||game.elapsedMs<level.bestMs
  level.solved++
  level.totalMs+=game.elapsedMs
  if(isBest)level.bestMs=game.elapsedMs
  stats.history.unshift({
    id:puzzle.id,mode:puzzle.mode,difficulty:puzzle.difficulty,seed:puzzle.seed,engine:ENGINE_VERSION,
    givens:compactGivens(puzzle.givens),
    solvedAt:new Date().toISOString(),ms:game.elapsedMs,mistakes:game.mistakes,hints:game.hintsUsed,
    daily:game.daily?game.daily.kind:null,dailyDate:game.daily?game.daily.date:null
  })
  if(stats.history.length>3000)stats.history.length=3000
  if(game.daily){
    const day=stats.daily[game.daily.date]||(stats.daily[game.daily.date]={})
    day[game.daily.kind]=true
  }
  const streak=currentStreak(stats)
  if(streak>stats.bestStreak)stats.bestStreak=streak
  saveStats(stats)
  return {isBest,level}
}

export function compactGivens(givens){
  return givens.map((value)=>value||'.').join('')
}

export function localDateKey(date=new Date()){
  const month=String(date.getMonth()+1).padStart(2,'0')
  const day=String(date.getDate()).padStart(2,'0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function currentStreak(stats){
  let streak=0
  const cursor=new Date()
  if(!(stats.daily[localDateKey(cursor)]||{}).classic)cursor.setDate(cursor.getDate()-1)
  while((stats.daily[localDateKey(cursor)]||{}).classic){
    streak++
    cursor.setDate(cursor.getDate()-1)
  }
  return streak
}

export function exportBackup(){
  return JSON.stringify({app:'sudoku',exportedAt:new Date().toISOString(),settings:loadSettings(),stats:loadStats(),game:loadGame()})
}

export function importBackup(text){
  const data=JSON.parse(text)
  if(!data||data.app!=='sudoku'||!data.stats||data.stats.version!==1)throw new Error('This file is not a Sudoku backup.')
  saveStats(data.stats)
  if(data.settings)saveSettings({...DEFAULT_SETTINGS,...data.settings})
  if(data.game)saveGame(data.game)
}

export function resetStats(){
  saveStats(emptyStats())
}
