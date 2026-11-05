# 옆잔 YEOPJAN

혼자 마시고 싶지만, 혼자 있고 싶지는 않은 밤을 위한 익명 공간형 온라인 바입니다. 가입 없이 입장해 실제 접속자의 아바타를 보고, 서버가 확정한 자리에 앉아 같은 공간의 사람과 대화하거나 건배할 수 있습니다.

## 구현 기능

- 실제 접속 인원, 성인 대상 안내, 닉네임·아바타·기분 온보딩
- Three.js로 렌더링한 3D 바, 조명·그림자·비 효과와 접근 가능한 DOM 좌석·주종 레이어
- 터치·클릭 이동, 서버 권위 좌석 점유, 동시 요청 충돌 처리
- 바 카운터와 테이블별 Socket.IO 채팅 격리, 창가 조용한 상태
- 가상 음료, 건배 cooldown, 반응, 시스템 바텐더 질문
- 재연결, 중복 세션 교체, disconnect 후 사용자·좌석 정리
- 메시지 검증·속도 제한, 음소거·차단·신고, SQLite 운영 자료
- Bearer token으로 보호한 신고 조회와 사용자 제재 API
- 모션 감소 설정, 소리 기본 OFF, 모바일 접이식 채팅 패널

## 구조

```text
apps/web       React, Vite, Three.js, Socket.IO client
apps/server    Fastify, Socket.IO, node:sqlite
packages/shared  Zod 스키마, 이벤트 타입, 좌석 정의
tests/e2e      Playwright 모바일·다중 브라우저 테스트
docs           제품·아키텍처·보안·검증 문서
```

상세 설계는 [제품 정의](docs/PRODUCT.md), [아키텍처](docs/ARCHITECTURE.md), [보안 기준](docs/SECURITY.md)을 참고하세요.

## 요구 환경

- Node.js 24 이상
- pnpm 11.9.0
- E2E 실행 시 Playwright Chromium
- Docker Desktop 또는 Docker Engine + Compose plugin

Corepack이 오래되어 pnpm 실행에 실패하면 `npm install --global pnpm@11.9.0` 또는 `npx pnpm@11.9.0`을 사용하세요.

## 설치와 개발 실행

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

- 웹 개발 서버: http://localhost:5173
- API·Socket.IO 서버: http://localhost:3000

Vite가 `/api`와 `/socket.io`를 서버로 프록시합니다. 랜딩 접속 인원과 멀티플레이는 로컬 상태가 아니라 3000번 서버에서 옵니다.

## 테스트와 빌드

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm exec playwright install chromium
pnpm build
pnpm test:e2e
```

`test:integration`은 실제 임시 포트에 Socket.IO 서버와 여러 client를 연결합니다. `test:e2e`는 격리된 브라우저 context 3개로 채널 격리와 멀티플레이 UI를 검증합니다.

## 프로덕션 로컬 실행

```bash
pnpm build
NODE_ENV=production \
PORT=3000 \
HOST=0.0.0.0 \
DATABASE_PATH=./data/yeopjan.db \
ALLOWED_ORIGINS=http://localhost:3000 \
pnpm --filter @yeopjan/server start
```

http://localhost:3000 과 http://localhost:3000/health 를 확인하세요.

## Docker Compose

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
curl --fail http://localhost:3000/health
docker compose logs -f yeopjan
docker compose down
```

SQLite 데이터는 `yeopjan-data` volume에 보존됩니다. volume까지 삭제하려면 데이터 손실을 이해한 뒤 별도로 `docker compose down -v`를 실행해야 합니다.

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `3000` | HTTP·Socket.IO 포트 |
| `HOST` | `0.0.0.0` | listen 주소 |
| `DATABASE_PATH` | `./data/yeopjan.db` | 신고·제재 SQLite 파일 |
| `ALLOWED_ORIGINS` | localhost 두 origin | 쉼표 구분 WebSocket Origin 허용 목록 |
| `ADMIN_TOKEN` | 없음 | 운영자 API Bearer token. 미설정 시 접근 불가 |
| `DISCONNECT_GRACE_MS` | `3000` | 재연결 전에 좌석을 보존할 시간 |
| `WEB_DIST` | 자동 탐색 | 프로덕션 웹 빌드 절대·상대 경로 |

`ADMIN_TOKEN`은 `VITE_*` 변수나 클라이언트 코드에 넣지 마세요. 프로덕션에서는 충분히 긴 무작위 값을 비밀 저장소에서 주입하고 HTTPS/WSS를 사용해야 합니다.

## 운영자 API

모든 요청에 `Authorization: Bearer $ADMIN_TOKEN`이 필요합니다.

- `GET /api/admin/reports`: 최근 신고 100개
- `POST /api/admin/users/:userId/ban`: `{ "reason": "abuse", "hours": 24 }`
- `POST /api/admin/bans`: 세션 해시 직접 제재
- `DELETE /api/admin/bans/:sessionHash`: 제재 해제

공개 클라이언트에는 세션 해시, 소켓 ID, IP, 운영 비밀이 전달되지 않습니다.

## 알려진 제한과 공개 전 조치

- 단일 프로세스·단일 바 인스턴스이며 정원은 24명입니다. 다중 서버 전에는 외부 상태 저장소와 Socket.IO Redis Adapter가 필요합니다.
- 익명 세션은 브라우저 저장소의 불투명 token으로 복원합니다. 계정 인증이나 법적 연령 인증이 아닙니다.
- Node 24의 `node:sqlite`는 실행 환경에 따라 실험 기능 경고가 표시될 수 있습니다. 공개 배포 전 목표 Node LTS에서 고정 검증하세요.
- 운영자 UI는 없고 보호된 API만 제공합니다.
- 신고 자료의 기본 보관 정책은 30일이지만, 개인정보 처리방침·실제 삭제 스케줄·담당자 절차를 확정해야 합니다.
- 공개 전에 연령 확인, 청소년 보호, 익명 커뮤니티 운영, 음주 관련 표현을 관할 법률 전문가와 검토해야 합니다.
- TLS, 실제 domain Origin 목록, 로그 접근 통제, 부하 시험, 백업·복구 검증이 필요합니다.

## 라이선스와 자산

바 내부, 캐릭터, 좌석, 애니메이션은 프로젝트 코드로 직접 그립니다. 랜딩 외관 이미지는 이 프로젝트를 위해 생성한 원본이며 기존 게임·서비스의 로고나 그래픽을 사용하지 않습니다.
