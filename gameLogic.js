const ITEMS = ['handcuffs', 'magnifying_glass', 'beer', 'cigarette', 'knife'];
const MAX_HP = 3;

function generateShotgun() {
  const total = Math.floor(Math.random() * 7) + 2;
  const liveCount = Math.floor(Math.random() * (total - 1)) + 1;
  const blanks = total - liveCount;
  const shells = [
    ...Array(liveCount).fill('live'),
    ...Array(blanks).fill('blank'),
  ];
  for (let i = shells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shells[i], shells[j]] = [shells[j], shells[i]];
  }
  return { shells, live: liveCount, blank: blanks };
}

function dealItems(count = 2) {
  const result = [];
  for (let i = 0; i < count; i++) result.push(ITEMS[Math.floor(Math.random() * ITEMS.length)]);
  return result;
}

function createGameState(players) {
  return {
    phase: 'playing',
    round: 1,
    turn: players[0].id,
    shotgun: generateShotgun(),
    knifeActive: false,
    players: players.map(p => ({
      id: p.id, name: p.name, hp: MAX_HP, items: dealItems(2), handcuffed: false,
    })),
  };
}

function reloadIfEmpty(state) {
  if (state.shotgun.shells.length !== 0 || state.phase !== 'playing') return;
  state.round++;
  state.shotgun = generateShotgun();
  state.players.forEach(p => { if (p.items.length < 8) p.items.push(...dealItems(1)); });
}

function shoot(state, shooterId, targetSelf) {
  const shell = state.shotgun.shells.shift();
  const isLive = shell === 'live';
  const shooter = state.players.find(p => p.id === shooterId);
  const other = state.players.find(p => p.id !== shooterId);
  const target = targetSelf ? shooter : other;
  const damage = state.knifeActive ? 2 : 1;
  state.knifeActive = false;
  const result = { shell, damage: 0, killed: false, targetId: target.id };

  if (isLive) {
    target.hp -= damage;
    result.damage = damage;
    if (target.hp <= 0) {
      target.hp = 0;
      result.killed = true;
      state.phase = 'game_over';
      state.winner = shooter.id;
    }
  }

  reloadIfEmpty(state);
  if (!( !isLive && targetSelf) && state.phase === 'playing') nextTurn(state);
  return result;
}

function nextTurn(state) {
  const ids = state.players.map(p => p.id);
  const idx = ids.indexOf(state.turn);
  const nextIdx = (idx + 1) % ids.length;
  const nextPlayer = state.players[nextIdx];
  if (nextPlayer.handcuffed) {
    nextPlayer.handcuffed = false;
    state.turn = ids[(nextIdx + 1) % ids.length];
  } else {
    state.turn = ids[nextIdx];
  }
}

function useItem(state, playerId, itemName) {
  const player = state.players.find(p => p.id === playerId);
  const other = state.players.find(p => p.id !== playerId);
  const idx = player.items.indexOf(itemName);
  if (idx === -1) return { ok: false, msg: '아이템 없음' };
  player.items.splice(idx, 1);
  const info = { ok: true, item: itemName, reveal: null, usedBy: playerId };

  switch (itemName) {
    case 'handcuffs': other.handcuffed = true; break;
    case 'magnifying_glass': info.reveal = state.shotgun.shells[0]; break;
    case 'beer':
      info.ejected = state.shotgun.shells.shift();
      reloadIfEmpty(state);
      break;
    case 'cigarette': if (player.hp < MAX_HP) player.hp++; break;
    case 'knife': state.knifeActive = true; break;
  }
  return info;
}

module.exports = { createGameState, shoot, useItem, MAX_HP };
