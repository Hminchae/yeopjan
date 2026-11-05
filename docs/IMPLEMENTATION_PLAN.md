# 구현 및 검증 계획

## 범위 지도

변경은 다음 모든 지점에 도달해야 완료다.

- 호출자: 랜딩 presence, 온보딩, 장면 입력, 좌석·음료·건배·반응·채팅·신고 UI
- 서버: 연결 수명주기, 권위 상태, room 변경, 검증, 속도 제한, cleanup, 운영자 API
- 계약: 공유 Zod 요청·응답·이벤트 스키마와 공개 타입
- 영속화: 신고, 제재, 보관 기한, SQLite 마이그레이션
- 테스트: 도메인 단위, Socket.IO 멀티클라이언트 통합, Playwright 모바일·데스크톱·다중 컨텍스트
- 실행: workspace 스크립트, 환경 변수 예시, Dockerfile, Compose, healthcheck
- 문서: 제품, 아키텍처, 공개 전 법적·운영 체크, README, 검증 기록

## 수직 슬라이스

### 기반과 첫 입장

workspace, strict TypeScript, lint, Vitest, Vite/Fastify를 세운다. 실제 presence가 보이는 랜딩과 성인 안내·닉네임·아바타 온보딩을 연결하고 한 사용자가 바에 입장하는 첫 end-to-end 경로를 만든다.

검증: AC-01, presence 0, 잘못된 온보딩 거절, production build.

### 공간과 서버 권위 좌석

Phaser 바 장면, DOM 좌석 접근성 레이어, 터치 이동, 아바타 보간, 서버 권위 좌석 할당과 음료 상태를 구현한다.

검증: AC-02, AC-04, AC-07, 모바일 터치, reduced-motion.

### 실시간 존재와 복구

두 브라우저의 입장·이동·퇴장, 토큰 기반 재연결, 중복 소켓 교체, cleanup과 전체 스냅샷 재동기화를 구현한다.

검증: AC-03, AC-04, AC-09, 접속 인원, 유령 좌석 반환.

### 격리 대화와 사회적 반응

서버 계산 채널, room 격리 채팅, 말풍선, 음료, 건배 쿨다운, 반응, 시스템 바텐더 질문을 구현한다.

검증: AC-05, AC-06, AC-08, 다른 room 비수신, 바텐더 시스템 표기.

### 안전과 운영

입력 정규화, 메시지 길이, 이벤트 속도 제한, 음소거·차단, 신고 SQLite 저장, 제재 API, 보관 정리를 구현한다.

검증: AC-10, HTML이 실행되지 않음, 제한 초과 오류, 차단 필터, 인증 없는 운영 API 거절.

### 품질과 배포

모바일 키보드·접이식 채팅, 연결·빈 상태·오류 상태, 시각 마감, Docker 정적 제공, README와 운영 문서를 완성한다.

검증: AC-11부터 AC-15, desktop/mobile 스크린샷, Compose healthcheck, 전체 명령 통과.

## 테스트 전략

- 단위: 좌석 원자 할당, 채널 계산, 정규화, 속도 제한, cooldown, 보관 기한
- 통합: 실제 임시 포트 Socket.IO 서버와 2-3개 client를 연결해 경합, room, 건배, disconnect를 검증
- E2E: Playwright의 격리 browser context A/B/C를 한 테스트에서 사용해 실제 UI의 상호 반영과 채널 누출 부재를 검증
- 시각: 390x844 모바일과 1440x900 데스크톱 스크린샷을 저장하고 브라우저 콘솔 오류와 가로 overflow를 확인
- 배포: production build 후 Compose를 새로 기동해 `/health`, 랜딩, WebSocket 업그레이드를 smoke test

## Acceptance Criteria 증거 계획

| AC | 자동화 증거 |
|---|---|
| 01 | 모바일 E2E 온보딩과 입장 |
| 02 | 좌석 버튼 탭 후 서버 확정 위치 assertion |
| 03 | A/B context에서 상대 아바타 test id 확인 |
| 04 | A 이동·착석 후 B 좌표·좌석 상태 확인 |
| 05 | 같은 room A/B 메시지 양방향 확인 |
| 06 | 다른 room C에서 메시지 부재 확인 |
| 07 | 통합 테스트 동시 ack 하나만 성공 |
| 08 | 건배 후 같은 room effect, 다른 room 부재 |
| 09 | 강제 disconnect 후 presence·seat cleanup |
| 10 | 검증·rate limit 단위/통합, 신고·차단 E2E |
| 11 | 390x844 터치 전용 핵심 여정 |
| 12 | lint, typecheck, unit, integration, e2e, build |
| 13 | Compose healthcheck와 Socket.IO smoke |
| 14 | `tests/e2e/multiplayer.spec.ts`의 2+ contexts |
| 15 | README 명령·환경·제한 검토 |

## 완료 명령

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
docker compose up --build -d
docker compose ps
curl --fail http://localhost:3000/health
docker compose down
```

## Gate 1 뒤 첫 구현 단위

첫 변경은 기반과 첫 입장 슬라이스다. 최소한의 실행 가능한 서버와 웹을 만들고 실제 서버 presence 및 입장 이벤트가 브라우저에 도달하는 테스트를 먼저 통과시킨다. 이후 장면과 좌석을 얹어 각 슬라이스가 항상 실행 가능한 상태를 유지한다.

