/* RecallDeck - SM-2 spaced repetition */
'use strict';
const $=s=>document.querySelector(s);
let decks=JSON.parse(localStorage.getItem('recalldeck')||'[]');
let current=null;
let study=null;
function save(){localStorage.setItem('recalldeck',JSON.stringify(decks));}
const uid=()=>Math.random().toString(36).slice(2,9);
const DAY=864e5;
function newCard(front,back){return{id:uid(),front,back,ease:2.5,interval:0,reps:0,due:Date.now(),lapses:0,reviews:0};}
function deckCards(d){return d.cards;}
function dueCards(d){const now=Date.now();return d.cards.filter(c=>c.due<=now);}
function newCards(d){return d.cards.filter(c=>c.reps===0);}
function fmtInterval(days){
  if(days<1)return'<1 day';
  if(days<30)return Math.round(days)+'d';
  if(days<365)return Math.round(days/30)+'mo';
  return (days/365).toFixed(1)+'y';
}
/* SM-2 with 4 buttons mapped to quality 1/3/4/5 */
function gradeCard(c,q){
  c.reviews++;
  if(q<3){
    c.reps=0;c.lapses++;c.interval=0;c.due=Date.now()+60*1000; // relearn in 1 min
  }else{
    if(c.reps===0)c.interval=1;
    else if(c.reps===1)c.interval=3;
    else c.interval=Math.round(c.interval*c.ease);
    c.reps++;
    c.ease=Math.max(1.3,c.ease+0.1-(5-q)*(0.08+(5-q)*0.02));
    if(q===3)c.interval=Math.max(1,Math.round(c.interval*0.8));
    c.due=Date.now()+c.interval*DAY;
  }
}
function nextIntervals(c){
  const sim=q=>{const tmp=JSON.parse(JSON.stringify(c));gradeCard(tmp,q);return tmp;};
  return{2:fmtInterval(sim(3).interval),3:fmtInterval(sim(4).interval),4:fmtInterval(sim(5).interval)};
}

/* ---------- decks ---------- */
function renderStats(){
  const all=decks.flatMap(d=>d.cards);
  const due=decks.reduce((a,d)=>a+dueCards(d).length,0);
  const learned=all.filter(c=>c.reps>0).length;
  const mature=all.filter(c=>c.interval>=21).length;
  $('#statCards').innerHTML=[
    [decks.length,'Decks'],[all.length,'Cards'],[due,'Due now'],[all.length?Math.round(mature/all.length*100)+'%':'-','Mature']
  ].map(([n,l])=>`<div class="stat"><span class="num">${n}</span><span class="lbl">${l}</span></div>`).join('');
}
function renderDecks(){
  renderStats();
  const list=$('#deckList');
  if(!decks.length){list.innerHTML='<div class="empty-state"><div class="big">&#128218;</div>Create your first deck - vocabulary, exam facts, anything you want to remember.</div>';return;}
  list.innerHTML=decks.map(d=>{
    const due=dueCards(d).length;
    return `<div class="deck-item">
      <span class="nm" onclick="openDeck('${d.id}')">${esc(d.name)}</span>
      <span class="chip">${d.cards.length} cards</span>
      ${due?`<span class="chip chip-warn">${due} due</span>`:'<span class="chip chip-ok">all done</span>'}
      <button class="btn btn-primary btn-sm" onclick="openDeck('${d.id}',true)" ${d.cards.length?'':'disabled'}>Study</button>
    </div>`;
  }).join('');
}
function newDeck(){
  const name=prompt('Deck name:');if(!name)return;
  decks.unshift({id:uid(),name,cards:[]});
  save();renderDecks();
}
function openDeck(id,studyNow){
  current=decks.find(d=>d.id===id);if(!current)return;
  $('#view-decks').hidden=true;$('#view-deck').hidden=false;$('#view-study').hidden=true;
  $('#deckName').textContent=current.name;
  renderDeckStats();$('#cardList').innerHTML='';
  if(studyNow)startStudy();
}
function closeDeck(){
  current=null;
  $('#view-deck').hidden=false;$('#view-study').hidden=true;$('#view-decks').hidden=false;
  if(!$('#view-deck').hidden&&current){/* stay */}
  $('#view-deck').hidden=true;
  renderDecks();
}
function renderDeckStats(){
  const d=current;
  $('#deckStats').innerHTML=[
    [dueCards(d).length,'Due now'],[newCards(d).length,'New'],[d.cards.filter(c=>c.interval>=21).length,'Mature']
  ].map(([n,l])=>`<div class="stat"><span class="num">${n}</span><span class="lbl">${l}</span></div>`).join('');
}
function renameDeck(){
  // acts as deck options: rename or delete
  const a=prompt(`Deck "${current.name}"\nType a new name to rename, or DELETE to delete the deck:`);
  if(!a)return;
  if(a.trim().toUpperCase()==='DELETE'){
    if(confirm('Delete this deck and all its cards?')){decks=decks.filter(d=>d.id!==current.id);save();closeDeck();}
  }else{current.name=a.trim();save();$('#deckName').textContent=current.name;}
}
function addCard(){
  const f=$('#cardFront').value.trim(),b=$('#cardBack').value.trim();
  if(!f||!b){toast('Fill in both sides');return;}
  current.cards.unshift(newCard(f,b));
  $('#cardFront').value='';$('#cardBack').value='';
  save();renderDeckStats();toast('Card added');
}
function browseCards(){
  $('#cardList').innerHTML='<div class="card"><div class="row between"><h3 class="mb-0">All cards</h3><button class="btn btn-ghost btn-sm" onclick="this.parentElement.parentElement.remove()">Hide</button></div><div style="margin-top:12px">'+
    current.cards.map(c=>`<div class="card-row"><span class="fr">${esc(c.front)}</span><span class="bk">${esc(c.back)}</span>
      <span class="chip ${c.due<=Date.now()?'chip-warn':'chip-ok'}">${c.reps===0?'new':fmtInterval(c.interval)}</span>
      <button class="btn btn-ghost btn-sm" onclick="delCard('${c.id}')">x</button></div>`).join('')+'</div></div>';
}
function delCard(id){current.cards=current.cards.filter(c=>c.id!==id);save();renderDeckStats();browseCards();}

/* ---------- study ---------- */
function startStudy(){
  const d=current;
  if(!d.cards.length){toast('Add some cards first');return;}
  let queue=dueCards(d);
  if(!queue.length){toast('Nothing due - pulling 10 cards anyway for practice');queue=[...d.cards].sort(()=>Math.random()-.5).slice(0,10);}
  else{
    const news=newCards(d).filter(c=>c.due<=Date.now()).slice(0,10);
    const revs=queue.filter(c=>c.reps>0);
    queue=[...revs,...news];
  }
  study={queue,i:0,flipped:false,done:0,again:0,total:queue.length};
  $('#view-deck').hidden=true;$('#view-study').hidden=false;$('#studyDone').hidden=true;
  showCard();
}
function showCard(){
  const c=study.queue[study.i];
  study.flipped=false;
  $('#studyCard').classList.remove('flipped');
  $('#gradeRow').hidden=true;
  $('#studyFront').textContent=c.front;
  $('#studyBack').textContent=c.back;
  $('#studyProgress').textContent=`Card ${study.i+1} of ${study.queue.length}`;
}
function flipStudy(){
  if(!study)return;
  study.flipped=!study.flipped;
  $('#studyCard').classList.toggle('flipped',study.flipped);
  if(study.flipped){
    const c=study.queue[study.i];
    const iv=nextIntervals(c);
    $('#iv2').textContent=iv[2];$('#iv3').textContent=iv[3];$('#iv4').textContent=iv[4];
    $('#gradeRow').hidden=false;
  }
}
$('#studyCard').addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();flipStudy();}});
document.addEventListener('keydown',e=>{
  if($('#view-study').hidden)return;
  if(e.key>='1'&&e.key<='4'&&study&&study.flipped)grade(+e.key);
});
function grade(q){
  const c=study.queue[study.i];
  gradeCard(c,[0,1,3,4,5][q]); // buttons 1-4 -> SM-2 quality 1,3,4,5
  save();
  if(q===1){study.again++;study.queue.push(c);} // see again this session
  study.i++;
  if(study.i>=study.queue.length){
    $('#studyDone').hidden=false;
    $('#studyCard').style.visibility='hidden';$('#gradeRow').hidden=true;
    $('#studySummary').textContent=`Reviewed ${study.total} card${study.total===1?'':'s'}${study.again?`, ${study.again} needed another look`:''}. Next reviews are scheduled automatically.`;
    renderDeckStats();
    return;
  }
  showCard();
}
function endStudy(){study=null;$('#view-study').hidden=true;openDeck(current.id);}

/* ---------- import/export ---------- */
function exportAll(){download('recalldeck-export.json',JSON.stringify(decks,null,2),'application/json');}
function importDeck(inp){
  const f=inp.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      if(f.name.endsWith('.json')){
        const d=JSON.parse(r.result);
        if(Array.isArray(d)&&d[0]&&d[0].cards){decks=decks.concat(d);save();renderDecks();toast('Decks imported');}
        else if(d&&d.name&&Array.isArray(d.cards)){d.id=uid();decks.unshift(d);save();renderDecks();toast('Deck imported');}
        else toast('Not a RecallDeck export');
      }else{
        // TSV/CSV: front<TAB>back or front,back per line
        const lines=r.result.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
        const cards=lines.map(l=>{
          const parts=l.includes('\t')?l.split('\t'):l.split(/,(.+)/);
          return parts.length>=2?newCard(parts[0].trim(),(parts[1]||'').trim()):null;
        }).filter(Boolean);
        if(!cards.length){toast('No card rows found (use front,back per line)');return;}
        decks.unshift({id:uid(),name:f.name.replace(/\.\w+$/,''),cards});
        save();renderDecks();toast(`${cards.length} cards imported as a new deck`);
      }
    }catch(e){toast('Invalid file');}
  };
  r.readAsText(f);inp.value='';
}
renderDecks();
