# Team Cowork

Codex를 단일 작업 에이전트로 사용하는 팀용 Cowork MVP입니다. 팀의 프로젝트와 배포된 Skill은 공유하고, 채팅·작업 기록·Excel 파일·Skill 초안은 사용자별로 격리합니다.

## MVP 기능

- 쿠키 기반 로그인과 `MEMBER` / `SKILL_CREATOR` / `TEAM_ADMIN` 권한
- 팀 프로젝트와 사용자별 비공개 작업·채팅
- 공식 Codex SDK를 통한 읽기 전용 에이전트 응답
- Skill 초안 → 안전 테스트 → 관리자 승인 → 팀 배포
- 불변 Skill 버전, 비활성화와 이전 버전 복구
- 위험 기반 외부 작업 승인과 감사 이벤트
- 작업별 로컬 `.xlsx` 업로드, 미리보기, 원본 보존·다운로드
- Notion 지식 검색과 Composio Google OAuth 연결 어댑터
- 데스크톱·태블릿·모바일 반응형 UI

## 로컬 실행

요구 사항은 Node.js 22+, pnpm 11+, PostgreSQL 17+입니다.

```bash
pnpm install
copy .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

데모 계정:

- `alice@example.com` / `CoworkDemo123!` — Team Admin
- `bob@example.com` / `CoworkDemo123!` — Member

다른 PC에서 처음 설치하거나 GitHub를 통해 이어서 개발하려면
[원격 개발 가이드](docs/REMOTE-DEVELOPMENT.md)를 따르세요.

## 환경 설정

`.env.example`을 기준으로 설정합니다.

- `DATABASE_URL`: 개발 PostgreSQL
- `TEST_DATABASE_URL`: 개발 DB와 이름이 다른 테스트 전용 PostgreSQL
- `JWT_SECRET`: 32자 이상의 임의 문자열
- `CODEX_AGENT_MODE=codex`: 공식 Codex SDK 활성화
- `CODEX_MODEL`: 비워 두면 설치된 Codex 기본 모델 사용
- `NOTION_API_KEY`: 팀에 공유된 Notion 페이지 검색
- `COMPOSIO_API_KEY`: Composio 연결과 도구 기반
- `COMPOSIO_GOOGLE_AUTH_CONFIG_ID`: Google Docs/Sheets OAuth Auth Config

Codex 모드에서는 API를 실행하는 호스트에서 먼저 `codex login`을 완료해야 합니다. 개발·테스트에서는 `CODEX_AGENT_MODE=fake`로 외부 모델 호출을 차단할 수 있습니다.

## 검증

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
```

E2E는 `E2E_DATABASE_URL` 또는 `TEST_DATABASE_URL`이 개발 DB와 다른 데이터베이스인지 확인한 후에만 실행됩니다.

## 배포 구조

Next.js 웹은 Vercel에 배포할 수 있습니다. Fastify API는 PostgreSQL, 파일 업로드, Codex CLI/SDK 프로세스를 사용하므로 지속 실행 가능한 Node.js 호스트에 배포해야 합니다. Vercel 서버리스 함수에서 Codex 자식 프로세스를 직접 실행하는 구성은 지원 대상이 아닙니다.

Notion·Composio·Google 자격증명은 서버 환경 변수나 비밀 저장소에만 두며 브라우저와 Codex 프롬프트에는 전달하지 않습니다. 외부 쓰기는 승인 레코드가 없으면 실행하지 않는 것이 기본 정책입니다.

## 제품 문서

- [다른 기기에서 개발하기](docs/REMOTE-DEVELOPMENT.md)
- [제품 설계](docs/superpowers/specs/2026-07-27-team-cowork-design.md)
- [UI 테마](docs/superpowers/specs/2026-07-27-team-cowork-ui-theme-design.md)
- [마스터 로드맵](docs/superpowers/plans/2026-07-27-team-cowork-master-roadmap.md)
