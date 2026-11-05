import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  avatars,
  drinkLabels,
  drinks,
  moodLabels,
  moods,
  reactionLabels,
  reactions,
  seats,
  type AvatarStyle,
  type BarSnapshot,
  type Channel,
  type ChatMessage,
  type Mood,
  type PublicUser,
  type Reaction
} from '@yeopjan/shared';
import { sessionTokenKey, socket } from './socket';

const BarScene = lazy(() => import('./BarScene').then((module) => ({ default: module.BarScene })));

type Phase = 'landing' | 'onboarding' | 'bar';
interface Profile { nickname: string; avatar: AvatarStyle; mood: Mood | null; adultConfirmed: true }
const profileKey = 'yeopjan.profile';
const avatarColors: Record<AvatarStyle, string> = {
  amber: '#d99a4c', burgundy: '#934b55', navy: '#536b88', sage: '#73816b', plum: '#76566f', copper: '#a96843'
};
const channelLabels: Record<Channel, string> = { counter: '바 카운터', 'table-1': '작은 테이블 하나', 'table-2': '작은 테이블 둘' };

function randomNickname() {
  const first = ['고요한', '느린', '밤의', '따뜻한', '작은', '비오는'];
  const second = ['파도', '산책', '잔', '마음', '별빛', '창가'];
  return `${first[Math.floor(Math.random() * first.length)]}${second[Math.floor(Math.random() * second.length)]}`;
}

function Landing({ count, connected, onEnter }: { count: number; connected: boolean; onEnter: () => void }) {
  return <main className="landing">
    <div className="landing-image" role="img" aria-label="비 내리는 밤, 따뜻한 불빛이 새어 나오는 작은 바 외관" />
    <div className="landing-scrim" />
    <header className="brand"><span className="brand-mark">옆잔</span><span>YEOPJAN</span></header>
    <section className="hero-copy">
      <p className="eyebrow">ANONYMOUS MIDNIGHT BAR</p>
      <h1>혼자 마시고 싶지만,<br />혼자 있고 싶지는 않은 밤.</h1>
      <p className="hero-sub">오늘 밤, 당신 옆자리는 비어 있어요.</p>
      <div className="presence" aria-live="polite"><span className={connected ? 'live-dot' : 'offline-dot'} /> 지금 {count}명이 머무는 중</div>
      <button className="primary" onClick={onEnter}>바에 입장하기</button>
    </section>
    <aside className="landing-note">
      <strong>원하는 만큼만 함께해요.</strong>
      <p>창가에서 조용히 쉬거나, 카운터에서 가볍게 말을 건네세요. 가입과 위치 정보는 필요하지 않아요.</p>
      <span>성인 대상 공간, 음주 권유 없음, 신고 및 차단 지원</span>
    </aside>
  </main>;
}

function Onboarding({ onBack, onJoin, busy, error }: { onBack: () => void; onJoin: (profile: Profile) => void; busy: boolean; error: string }) {
  const [nickname, setNickname] = useState(randomNickname);
  const [avatar, setAvatar] = useState<AvatarStyle>('amber');
  const [mood, setMood] = useState<Mood | null>('quiet');
  const [adult, setAdult] = useState(false);
  const submit = (event: FormEvent) => { event.preventDefault(); if (adult) onJoin({ nickname, avatar, mood, adultConfirmed: true }); };
  return <main className="onboarding-page">
    <button className="back-button" onClick={onBack}>돌아가기</button>
    <form className="onboarding" onSubmit={submit}>
      <div><p className="eyebrow">TONIGHT'S GUEST</p><h1>어떤 모습으로 머물까요?</h1><p>실명 대신 오늘 밤의 이름만 알려 주세요.</p></div>
      <label>닉네임
        <span className="inline-input"><input value={nickname} onChange={(event) => setNickname(event.target.value)} minLength={2} maxLength={16} required aria-describedby="nickname-help" /><button type="button" onClick={() => setNickname(randomNickname())}>랜덤</button></span>
        <small id="nickname-help">2-16자, 언제든 새 이름으로 다시 방문할 수 있어요.</small>
      </label>
      <fieldset><legend>아바타 색상</legend><div className="avatar-options">
        {avatars.map((item) => <button type="button" key={item} aria-label={`${item} 아바타`} aria-pressed={avatar === item} onClick={() => setAvatar(item)} style={{ '--avatar': avatarColors[item] } as React.CSSProperties}><span /></button>)}
      </div></fieldset>
      <fieldset><legend>오늘의 기분 <small>선택</small></legend><div className="mood-options">
        {moods.map((item) => <button type="button" key={item} aria-pressed={mood === item} onClick={() => setMood(mood === item ? null : item)}>{moodLabels[item]}</button>)}
      </div></fieldset>
      <label className="adult-check"><input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} /> <span><strong>성인 대상 서비스임을 확인했어요.</strong><small>이 확인은 법적 연령 인증을 대신하지 않습니다.</small></span></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary wide" disabled={!adult || busy}>{busy ? '문을 여는 중...' : '이 모습으로 입장하기'}</button>
    </form>
  </main>;
}

function UserAvatar({ user, self, muted, onSelect }: { user: PublicUser; self: boolean; muted: boolean; onSelect: () => void }) {
  const status = user.seatId?.startsWith('window-') ? '조용히 쉬는 중' : user.mood ? moodLabels[user.mood] : '';
  return <button
    className={`guest-avatar ${self ? 'self' : ''} ${user.connected ? '' : 'away'}`}
    style={{ left: `${user.x}%`, top: `${user.y}%`, '--avatar': avatarColors[user.avatar] } as React.CSSProperties}
    onClick={(event) => { event.stopPropagation(); onSelect(); }}
    data-testid={`avatar-${user.id}`}
    data-seat={user.seatId ?? ''}
    aria-label={`${user.nickname}${self ? ', 나' : ''}${muted ? ', 음소거됨' : ''}`}
  >
    <span className="guest-name">{user.nickname}{self && ' (나)'}</span>
    <span className="pixel-person"><i className="head" /><i className="body" /></span>
    <span className="guest-status">{status}{user.drink && ` · ${drinkLabels[user.drink]}`}</span>
  </button>;
}

function ChatPanel({ channel, messages, onSend, onCheers, onReaction, quiet, onToggle }: {
  channel: Channel | null; messages: ChatMessage[]; onSend: (text: string) => void; onCheers: () => void; onReaction: (reaction: Reaction) => void; quiet: boolean; onToggle: () => void;
}) {
  const [text, setText] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); if (text.trim()) { onSend(text); setText(''); } };
  return <aside className={`chat-panel ${quiet ? 'collapsed' : ''}`} aria-label="대화 패널">
    <button className="chat-handle" onClick={onToggle} aria-expanded={!quiet}>{channel ? channelLabels[channel] : '조용히 머무는 중'} <span>{quiet ? '열기' : '접기'}</span></button>
    {!quiet && <>
      <div className="messages" aria-live="polite">
        {!channel && <div className="empty-message"><strong>여기는 대화가 들리지 않아요.</strong><p>카운터나 작은 테이블에 앉으면 그 자리의 대화가 열립니다.</p></div>}
        {channel && messages.length === 0 && <div className="empty-message"><strong>아직 조용한 자리예요.</strong><p>가볍게 인사를 건네도 좋아요.</p></div>}
        {messages.map((message) => <p key={message.id} className={message.system ? 'system-message' : ''}><strong>{message.author}</strong><span>{message.text}</span></p>)}
      </div>
      <div className="social-actions">
        <button onClick={onCheers} disabled={!channel}>🍻 <span>짠!</span></button>
        {reactions.filter((reaction) => reaction !== 'cheers').map((reaction) => <button key={reaction} onClick={() => onReaction(reaction)} disabled={!channel} aria-label={`반응 ${reaction}`}>{reactionLabels[reaction]}</button>)}
      </div>
      <form className="chat-form" onSubmit={submit}><label className="sr-only" htmlFor="chat-input">메시지</label><input id="chat-input" value={text} onChange={(event) => setText(event.target.value)} placeholder={channel ? '가볍게 한마디...' : '대화 자리에 앉아 주세요'} maxLength={300} disabled={!channel} /><button disabled={!channel || !text.trim()}>보내기</button></form>
    </>}
  </aside>;
}

function Bar({ snapshot, messages, notice, muted, onMove, onSeat, onDrink, onChat, onCheers, onReaction, onMute, onBlock, onReport, onLeave }: {
  snapshot: BarSnapshot; messages: ChatMessage[]; notice: string; muted: Set<string>; onMove: (x: number, y: number) => void; onSeat: (seatId: string) => void; onDrink: (drink: typeof drinks[number]) => void; onChat: (text: string) => void; onCheers: () => void; onReaction: (reaction: Reaction) => void; onMute: (id: string) => void; onBlock: (id: string) => void; onReport: (id: string) => void; onLeave: () => void;
}) {
  const [quiet, setQuiet] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [drinksOpen, setDrinksOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  useEffect(() => () => { void audioRef.current?.close(); }, []);
  const toggleSound = () => {
    if (audioRef.current) {
      void audioRef.current.close(); audioRef.current = null; setSoundOn(false); return;
    }
    const context = new AudioContext();
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    const rain = context.createBufferSource(); const filter = context.createBiquadFilter(); const gain = context.createGain();
    rain.buffer = buffer; rain.loop = true; filter.type = 'lowpass'; filter.frequency.value = 1_400; gain.gain.value = 0.025;
    rain.connect(filter).connect(gain).connect(context.destination); rain.start();
    audioRef.current = context; setSoundOn(true);
  };
  const self = snapshot.users.find((user) => user.id === snapshot.selfId);
  const selectedUser = snapshot.users.find((user) => user.id === selected && user.id !== snapshot.selfId);
  const visibleMessages = messages.filter((message) => !muted.has(message.authorId));
  return <main className="bar-app">
    <header className="bar-header"><div><span className="brand-mark">옆잔</span><span className="live-dot" /> {snapshot.connectedCount}명</div><div><button className="sound-button" aria-label={soundOn ? '빗소리 끄기' : '빗소리 켜기'} aria-pressed={soundOn} onClick={toggleSound}>소리</button><button onClick={() => setDrinksOpen(!drinksOpen)}>내 잔: {self ? drinkLabels[self.drink] : '준비 중'}</button><button onClick={onLeave}>나가기</button></div></header>
    <section className="scene-shell" aria-label="옆잔 바 내부. 빈 자리나 바닥을 선택해 이동하세요.">
      <Suspense fallback={<div className="scene-loading" role="status">바의 불을 켜는 중...</div>}><BarScene onMove={onMove} /></Suspense>
      <div className="scene-vignette" />
      <div className="seat-layer" aria-label="좌석 선택">
        {seats.map((seat) => {
          const occupiedBy = snapshot.occupiedSeats[seat.id];
          const occupied = Boolean(occupiedBy && occupiedBy !== snapshot.selfId);
          return <button key={seat.id} style={{ left: `${seat.x}%`, top: `${seat.y}%` }} className={`seat-target ${occupied ? 'occupied' : ''}`} disabled={occupied} onClick={(event) => { event.stopPropagation(); onSeat(seat.id); }} data-testid={`seat-${seat.id}`} aria-label={`${seat.label}${occupied ? ', 사용 중' : ', 비어 있음'}`}><span>{occupied ? '사용 중' : '앉기'}</span></button>;
        })}
      </div>
      <div className="avatar-layer">
        {snapshot.users.map((user) => <UserAvatar key={user.id} user={user} self={user.id === snapshot.selfId} muted={muted.has(user.id)} onSelect={() => setSelected(user.id)} />)}
      </div>
      <div className="area-label window-label">빗소리 창가</div><div className="area-label counter-label">바 카운터</div><div className="area-label table-one-label">작은 테이블 하나</div><div className="area-label table-two-label">작은 테이블 둘</div>
      <p className="move-hint">바닥을 탭하면 이동해요</p>
    </section>
    {drinksOpen && <div className="drink-menu"><strong>오늘의 잔</strong>{drinks.map((drink) => <button key={drink} aria-pressed={self?.drink === drink} onClick={() => { onDrink(drink); setDrinksOpen(false); }}>{drinkLabels[drink]}</button>)}</div>}
    {selectedUser && <div className="guest-menu" role="dialog" aria-label={`${selectedUser.nickname} 메뉴`}><button className="close" onClick={() => setSelected(null)}>닫기</button><strong>{selectedUser.nickname}</strong><span>{selectedUser.mood ? moodLabels[selectedUser.mood] : '말없이 머무는 중'}</span><button onClick={() => onMute(selectedUser.id)}>{muted.has(selectedUser.id) ? '음소거 해제' : '음소거'}</button><button onClick={() => onBlock(selectedUser.id)}>차단 전환</button><button className="danger" onClick={() => onReport(selectedUser.id)}>신고하기</button></div>}
    {notice && <div className="toast" role="status">{notice}</div>}
    <ChatPanel channel={self?.channel ?? null} messages={visibleMessages} onSend={onChat} onCheers={onCheers} onReaction={onReaction} quiet={quiet} onToggle={() => setQuiet(!quiet)} />
  </main>;
}

export function App() {
  const storedProfile = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(profileKey) ?? 'null') as Profile | null; } catch { return null; }
  }, []);
  const [phase, setPhase] = useState<Phase>(localStorage.getItem(sessionTokenKey) && storedProfile ? 'bar' : 'landing');
  const [count, setCount] = useState(0);
  const [connected, setConnected] = useState(socket.connected);
  const [snapshot, setSnapshot] = useState<BarSnapshot>({ selfId: null, users: [], occupiedSeats: {}, connectedCount: 0 });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [muted, setMuted] = useState<Set<string>>(new Set());
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const showNotice = useCallback((message: string) => {
    setNotice(message); if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2_800);
  }, []);

  useEffect(() => {
    fetch('/api/presence').then((response) => response.json()).then((data: { count: number }) => setCount(data.count)).catch(() => setConnected(false));
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onSnapshot = (next: BarSnapshot) => { setSnapshot(next); setCount(next.connectedCount); if (next.selfId) setPhase('bar'); };
    const onPresence = (next: number) => { setCount(next); setSnapshot((current) => ({ ...current, connectedCount: next })); };
    const onJoined = (user: PublicUser) => setSnapshot((current) => ({ ...current, users: [...current.users.filter((item) => item.id !== user.id), user] }));
    const onUpdated = (user: PublicUser) => setSnapshot((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? user : item), occupiedSeats: Object.fromEntries(current.users.map((item) => item.id === user.id ? user : item).filter((item) => item.seatId).map((item) => [item.seatId!, item.id])) }));
    const onLeft = (id: string) => setSnapshot((current) => ({ ...current, users: current.users.filter((user) => user.id !== id), occupiedSeats: Object.fromEntries(Object.entries(current.occupiedSeats).filter(([, userId]) => userId !== id)) }));
    const onChat = (message: ChatMessage) => setMessages((current) => [...current.slice(-79), message]);
    const onServerNotice = (payload: { code: string; message: string }) => {
      if (payload.code === 'SESSION_EXPIRED' || payload.code === 'BANNED') {
        localStorage.removeItem(sessionTokenKey); localStorage.removeItem(profileKey);
        socket.auth = {}; setSnapshot({ selfId: null, users: [], occupiedSeats: {}, connectedCount: 0 });
        setError(payload.message); setPhase('onboarding');
      } else showNotice(payload.message);
    };
    const onCheers = (payload: { userId: string }) => { const user = snapshotRef.current.users.find((item) => item.id === payload.userId); showNotice(`${user?.nickname ?? '누군가'}님이 짠!`); };
    const onReaction = (payload: { userId: string; reaction: Reaction }) => { const user = snapshotRef.current.users.find((item) => item.id === payload.userId); showNotice(`${user?.nickname ?? '누군가'} ${reactionLabels[payload.reaction]}`); };
    socket.on('connect', onConnect); socket.on('disconnect', onDisconnect); socket.on('bar:snapshot', onSnapshot); socket.on('bar:presence', onPresence); socket.on('bar:user-joined', onJoined); socket.on('bar:user-updated', onUpdated); socket.on('bar:user-left', onLeft); socket.on('bar:chat', onChat); socket.on('bar:cheers', onCheers); socket.on('bar:reaction', onReaction); socket.on('bar:notice', onServerNotice);
    if (!socket.connected) socket.connect();
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('bar:snapshot', onSnapshot); socket.off('bar:presence', onPresence); socket.off('bar:user-joined', onJoined); socket.off('bar:user-updated', onUpdated); socket.off('bar:user-left', onLeft); socket.off('bar:chat', onChat); socket.off('bar:cheers', onCheers); socket.off('bar:reaction', onReaction); socket.off('bar:notice', onServerNotice); if (noticeTimer.current) clearTimeout(noticeTimer.current); };
  }, [showNotice]);

  const join = (profile: Profile) => {
    setBusy(true); setError('');
    socket.emit('bar:join', profile, (ack) => {
      setBusy(false);
      if (!ack.ok) return setError(ack.message);
      localStorage.setItem(sessionTokenKey, ack.data.token); localStorage.setItem(profileKey, JSON.stringify(profile));
      socket.auth = { token: ack.data.token };
      setSnapshot(ack.data.snapshot); setPhase('bar');
    });
  };
  const ackNotice = (action: (callback: (ack: { ok: boolean; message?: string }) => void) => void, success?: string) => action((ack) => ack.ok ? success && showNotice(success) : showNotice(ack.message ?? '요청을 처리하지 못했어요.'));
  const move = useCallback((x: number, y: number) => ackNotice((callback) => socket.emit('bar:move', { x, y }, callback)), [showNotice]);
  const seat = (seatId: string) => ackNotice((callback) => socket.emit('bar:seat', { seatId }, callback), '자리에 앉았어요.');
  const drink = (value: typeof drinks[number]) => ackNotice((callback) => socket.emit('bar:drink', { drink: value }, callback));
  const chat = (text: string) => ackNotice((callback) => socket.emit('bar:chat', { text }, callback));
  const cheers = () => ackNotice((callback) => socket.emit('bar:cheers', callback));
  const reaction = (value: Reaction) => ackNotice((callback) => socket.emit('bar:reaction', { reaction: value }, callback));
  const block = (targetId: string) => socket.emit('bar:block', { targetId }, (ack) => ack.ok ? showNotice(ack.data.blocked ? '차단했어요.' : '차단을 해제했어요.') : showNotice(ack.message));
  const report = (targetId: string) => socket.emit('bar:report', { targetId, reason: 'other', details: '' }, (ack) => showNotice(ack.ok ? '신고가 접수됐어요.' : ack.message));
  const leave = () => socket.emit('bar:leave', () => { localStorage.removeItem(sessionTokenKey); localStorage.removeItem(profileKey); setSnapshot({ selfId: null, users: [], occupiedSeats: {}, connectedCount: 0 }); setMessages([]); setPhase('landing'); });

  if (phase === 'landing') return <Landing count={count} connected={connected} onEnter={() => setPhase('onboarding')} />;
  if (phase === 'onboarding') return <Onboarding onBack={() => setPhase('landing')} onJoin={join} busy={busy} error={error} />;
  return <Bar snapshot={snapshot} messages={messages} notice={notice} muted={muted} onMove={move} onSeat={seat} onDrink={drink} onChat={chat} onCheers={cheers} onReaction={reaction} onMute={(id) => setMuted((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} onBlock={block} onReport={report} onLeave={leave} />;
}
