# 검증 기록

검증일: 2026-11-04, Asia/Seoul

## Checkpoint 결과

### Discovery and Plan

- 생성: `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/SECURITY.md`
- 확인: Node 25.6.1, pnpm 11.9.0, Docker 28.4.0, Compose 2.39.4
- 결정: 단일 Fastify + Socket.IO 권위 서버, React/Vite/Phaser 클라이언트, 공유 Zod 계약, SQLite 운영 자료

### Single User Experience

- 생성: 랜딩, 성인 안내, 온보딩, Phaser 바, DOM 좌석·아바타, 음료, 건배·반응, 기본 OFF 빗소리
- 확인: Playwright Pixel 7 터치 여정, 모바일 스크린샷, reduced-motion CSS

### Real Multiplayer

- 생성: 입장·이동·착석·음료·채팅·건배·반응 동기화, 채널 room, 재연결, 중복 socket 교체, disconnect cleanup
- 확인: 실제 Socket.IO client 통합 테스트 3개와 격리 browser context A/B/C E2E

### Safety and Usability

- 생성: Zod 검증, 16KiB payload, Origin allowlist, 속도 제한, cooldown, 음소거·차단·신고, 운영자 제재 API, CSP
- 확인: HTML 문자열이 텍스트로 양쪽에 표시됨, 차단 수신 제외, 인증 없는 운영 API 401, 프로덕션 감사 취약점 0개

### Verification and Delivery

- 생성: Dockerfile, Compose healthcheck, README, 운영 체크리스트, Playwright 스크린샷
- 확인: 전체 명령 통과, Docker `healthy`, 정적 JS·Socket.IO handshake·경로 탐색 404

## 실행 결과

| 검증 | 결과 |
|---|---|
| `pnpm typecheck` | 3 workspace 통과 |
| `pnpm lint` | 오류 0 |
| `pnpm test` | 단위 7개 통과 |
| `pnpm test:integration` | 실제 네트워크 멀티클라이언트 3개 통과 |
| `pnpm build` | shared, web, server production build 통과 |
| `pnpm test:e2e` | Chromium 3개 통과 |
| 멀티브라우저 반복 | 동일 E2E 연속 2회 통과 |
| `pnpm audit --prod` | 알려진 취약점 0개 |
| Docker Compose | 이미지 빌드, container healthy, `/health` 200 |
| Docker 정적 파일 | Vite JS 200, 인코딩된 traversal 요청 404 |
| Docker Socket.IO | polling handshake 성공, `maxPayload` 16384 |
| Lighthouse | Performance 100, Accessibility 100, Best Practices 96, SEO 91 |
| Web Vitals 측정 | LCP 0.8초, CLS 0, TBT 0ms |

Lighthouse 원본은 `artifacts/lighthouse.json`에 있다. 빌드 시 지연 로딩된 Phaser chunk가 1.21MB라는 경고가 남지만 초기 랜딩 JS는 370KB 미만이며 Lighthouse LCP는 목표 2.5초 안이다.

## Acceptance Criteria 근거

| AC | 상태 | 근거 |
|---|---|---|
| AC-01 | PASS | `mobile.spec.ts`가 가입 없이 닉네임·아바타·성인 확인 후 입장 |
| AC-02 | PASS | Phaser 장면과 DOM 좌석, 모바일 `tap()` 착석 후 서버 확정 `data-seat` |
| AC-03 | PASS | `multiplayer.spec.ts`의 격리 context A/B가 서로의 닉네임 아바타 확인 |
| AC-04 | PASS | A/B 동시 좌석 요청 후 B 화면에서 서버 확정 좌석 아바타가 하나임을 확인 |
| AC-05 | PASS | 같은 카운터의 송신자·수신자 양쪽에 같은 메시지 표시 |
| AC-06 | PASS | table-2 context C에는 카운터 메시지와 건배가 없음 |
| AC-07 | PASS | 통합·E2E에서 같은 좌석 동시 요청 성공이 정확히 하나 |
| AC-08 | PASS | 카운터 건배가 같은 채널에 표시되고 다른 테이블에는 표시되지 않음 |
| AC-09 | PASS | token 재연결은 ID·좌석을 복원하고 유예 만료 후 관찰자 화면에서 사용자 제거 |
| AC-10 | PASS | 길이·schema·rate limit, HTML 텍스트 렌더링, 차단 필터, 신고 SQLite·운영자 인증 검증 |
| AC-11 | PASS | Pixel 7 touch 전용 입장·아바타 선택·착석·소리·채팅 입력 여정 |
| AC-12 | PASS | typecheck, lint, unit, integration, build, E2E 통과 |
| AC-13 | PASS | Docker Compose healthy와 문서화된 로컬 명령 검증 |
| AC-14 | PASS | `tests/e2e/multiplayer.spec.ts`가 context A/B/C 사용 |
| AC-15 | PASS | README에 설치·개발·테스트·배포·환경 변수·제한 작성 |

## 화면 증거

- `artifacts/screenshots/landing-mobile.png`
- `artifacts/screenshots/bar-mobile.png`
- `artifacts/screenshots/bar-desktop-multiplayer.png`

세 화면을 원본 해상도로 직접 확인했다. 모바일에서 가로 잘림 없이 CTA, 좌석, 접이식 채팅, 반응, 입력을 사용할 수 있고, 데스크톱에서는 세 실제 client의 위치와 분리된 채팅을 확인했다.

## 남은 공개 전 조치

MVP acceptance를 막는 항목은 없다. 실제 공개 전에는 `docs/OPERATIONS.md`의 법률·연령 확인·TLS·로그 접근·부하 시험·백업·신고 대응 절차를 완료해야 한다. 단일 프로세스 24명 제한과 Node 24의 `node:sqlite` 실험 기능 경고는 README의 알려진 제한에 기록했다.
