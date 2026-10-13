const socket = io();
let myId = null, myName = '', roomId = null, state = null, myTurn = false;
const $ = id => document.getElementById(id);
const meta = {
  handcuffs:['🔗 수갑','상대의 다음 턴을 건너뜁니다'],
  magnifying_glass:['🔍 돋보기','현재 탄을 확인합니다'],
  beer:['🍺 맥주','현재 탄을 방출합니다'],
  cigarette:['🚬 담배','체력을 1 회복합니다'],
  knife:['🔪 칼','다음 발사의 피해가 2배가 됩니다']
};
function screen(id){document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));$(id).classList.add('active')}
function log(msg){const el=document.createElement('div');el.className='logline';el.textContent='['+new Date().toLocaleTimeString('ko',{hour12:false})+'] '+msg;$('log').prepend(el);while($('log').children.length>50)$('log').lastChild.remove()}
function name(){return $('name').value.trim().slice(0,12)||'익명'}
socket.on('connect',()=>{myId=socket.id;socket.emit('list_rooms')});
socket.on('room_list',list=>{$('rooms').innerHTML='';if(!list.length){$('rooms').textContent='참가 가능한 방이 없습니다.';return}list.forEach(r=>{const row=document.createElement('div');row.className='room';const label=document.createElement('span');label.textContent=(r.host||'익명')+'의 방 ('+r.players+'/2)';const btn=document.createElement('button');btn.textContent='참가';btn.onclick=()=>joinRoom(r.id);row.append(label,btn);$('rooms').append(row)})});
$('create').onclick=()=>{myName=name();socket.emit('create_room',{name:myName})};
$('join').onclick=()=>joinRoom($('room-code').value.trim().toUpperCase());
function joinRoom(code){if(!code)return;myName=name();socket.emit('join_room',{roomId:code,name:myName})}
socket.on('room_created',data=>{roomId=data.roomId;$('code').textContent=roomId;waitingPlayers([{id:myId,name:myName}]);screen('waiting')});
socket.on('room_joined',data=>{roomId=data.roomId;$('code').textContent=roomId;screen('waiting')});
socket.on('player_joined',data=>waitingPlayers(data.players));
function waitingPlayers(players){$('waiting-players').innerHTML='';for(let i=0;i<2;i++){const div=document.createElement('div');div.className='panel';div.textContent=players[i]?(players[i].id===myId?'👤 나: ':'🎮 상대: ')+players[i].name:'상대방 대기 중...';$('waiting-players').append(div)}}
$('leave').onclick=()=>location.reload();
socket.on('game_start',s=>{state=s;screen('game');$('log').innerHTML='';$('over').classList.remove('show');log('게임 시작!');render(s)});
socket.on('turn_start',data=>{state=data.state;myTurn=data.currentTurn===myId;render(state);turnStatus()});
function renderHP(id,hp){$(id).innerHTML='';for(let i=0;i<3;i++){const p=document.createElement('span');p.className='pip'+(i<hp?' on':'');$(id).append(p)}}
function render(s){if(!s)return;$('round').textContent=s.round;const me=s.players.find(p=>p.id===myId),op=s.players.find(p=>p.id!==myId);if(me){$('me-name').textContent=me.name+' (나)';renderHP('me-hp',me.hp);$('me-items-count').textContent='아이템 '+me.itemCount+'개';if(Array.isArray(me.items))renderItems(me.items)}if(op){$('op-name').textContent=op.name+' (상대)';renderHP('op-hp',op.hp);$('op-items-count').textContent='아이템 '+op.itemCount+'개'}$('live').textContent=s.shotgun.live;$('blank').textContent=s.shotgun.blank;$('total').textContent=s.shotgun.remaining;drawShells(s.shotgun.live,s.shotgun.blank);const can=myTurn&&s.phase==='playing'&&s.turn===myId;$('shoot-op').disabled=!can;$('shoot-me').disabled=!can;turnStatus()}
function renderItems(items){$('items').innerHTML='';items.forEach(item=>{const b=document.createElement('button');b.textContent=(meta[item]||[item])[0];b.title=(meta[item]||['',''])[1];b.disabled=!(myTurn&&state?.phase==='playing');b.onclick=()=>{b.disabled=true;socket.emit('use_item',{item})};$('items').append(b)})}
function turnStatus(){const can=myTurn&&state?.phase==='playing'&&state.turn===myId;$('status').textContent=can?'▶ 내 턴 — 발사하거나 아이템을 사용하세요':'상대의 턴을 기다리는 중...';$('status').classList.toggle('mine',can)}
function drawShells(live,blank){const c=$('shell-view'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);const total=live+blank;if(!total)return;const w=Math.min(22,(c.width-4*(total-1))/total),gap=4,start=(c.width-(total*w+(total-1)*gap))/2;for(let i=0;i<total;i++){ctx.fillStyle=i<live?'#cc2222':'#224488';ctx.fillRect(start+i*(w+gap),3,w,22);ctx.strokeStyle='#555';ctx.strokeRect(start+i*(w+gap)+.5,3.5,w-1,21)}}
$('shoot-op').onclick=()=>shoot(false);$('shoot-me').onclick=()=>shoot(true);
function shoot(self){if(!myTurn)return;$('shoot-op').disabled=$('shoot-me').disabled=true;socket.emit('shoot',{targetSelf:self})}
socket.on('shot_result',data=>{state=data.state;const target=state.players.find(p=>p.id===data.targetId);log(data.shell==='live'?'🔴 실탄! '+(target?.name||'플레이어')+'에게 '+data.damage+' 피해':'🔵 공탄!');render(state)});
socket.on('item_used',data=>{state=data.state;const label=(meta[data.item]||[data.item])[0];let msg=(data.usedBy===myId?'내가':'상대가')+' '+label+' 사용';if(data.reveal)msg+=' → 다음 탄: '+(data.reveal==='live'?'실탄':'공탄');if(data.ejected)msg+=' → '+(data.ejected==='live'?'실탄':'공탄')+' 방출';log(msg);render(state)});
socket.on('game_over',data=>{const win=data.winner===myId;$('over-title').textContent=win?'YOU WIN':'YOU LOSE';$('over-msg').textContent=win?'살아남았다.':'패배했습니다.';$('over').classList.add('show');log(win?'🏆 승리!':'💀 패배')});
socket.on('rematch_vote',data=>{$('over-msg').textContent='상대방이 재경기를 요청했습니다. 나도 요청 버튼을 누르세요.'});
$('rematch').onclick=()=>socket.emit('request_rematch');$('back').onclick=()=>location.reload();
socket.on('player_left',()=>log('상대방이 나갔습니다.'));
socket.on('error',msg=>log('오류: '+msg));
setInterval(()=>{if($('lobby').classList.contains('active'))socket.emit('list_rooms')},3000);
