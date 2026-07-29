# 다른 기기에서 Team Cowork 개발하기

## 저장소

- GitHub: <https://github.com/bottomup32/cowork>
- 기준 브랜치: `main`
- 패키지 관리자: pnpm 11
- 권장 런타임: Node.js 22+, PostgreSQL 17+

GitHub에는 소스코드와 공개 가능한 설정 예시만 저장합니다. 채팅, 작업 기록,
업로드한 Excel 파일과 로컬 PostgreSQL 데이터는 GitHub로 동기화되지 않습니다.
여러 기기에서 같은 실행 데이터를 사용하려면 API와 PostgreSQL을 공용 서버에
배포해야 합니다.

## 새 기기 최초 설정

```bash
git clone https://github.com/bottomup32/cowork.git
cd cowork
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm install
```

PostgreSQL을 Docker로 실행합니다.

```bash
docker compose up -d postgres
docker compose exec postgres createdb -U cowork cowork_test
```

`cowork_test`가 이미 존재한다는 메시지가 나오면 그대로 진행해도 됩니다.

환경 파일을 만듭니다.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

`.env`의 `JWT_SECRET`은 각 기기에서 32자 이상의 임의 문자열로 교체합니다.
Notion·Composio 키는 필요한 경우에만 각 기기의 `.env`에 넣습니다. `.env`는
Git에 올라가지 않습니다.

DB와 데모 데이터를 준비합니다.

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

실제 Codex 에이전트를 사용할 기기에서는 해당 기기에서 한 번 로그인합니다.

```bash
codex login
```

그다음 실행합니다.

```bash
pnpm dev
```

- 웹: <http://127.0.0.1:3000>
- API health: <http://127.0.0.1:4000/health>

## 데모 로그인 정보

아래 계정은 `pnpm db:seed`가 만드는 로컬 개발 전용 계정입니다.

| 용도 | 이메일 | 비밀번호 | 권한 |
| --- | --- | --- | --- |
| 관리자 기능 테스트 | `alice@example.com` | `CoworkDemo123!` | `TEAM_ADMIN` |
| 사용자 격리 테스트 | `bob@example.com` | `CoworkDemo123!` | `MEMBER` |

이 비밀번호를 실제 배포 환경에서 사용하지 마세요.

## 외부 서비스 설정

| 변수 | 용도 | Git 저장 여부 |
| --- | --- | --- |
| `NOTION_API_KEY` | Notion 지식 검색 | 저장 금지 |
| `COMPOSIO_API_KEY` | Composio API 연결 | 저장 금지 |
| `COMPOSIO_GOOGLE_AUTH_CONFIG_ID` | Google Docs/Sheets OAuth 설정 | `.env`에만 저장 |
| `COMPOSIO_NOTION_AUTH_CONFIG_ID` | Notion OAuth 설정 | `.env`에만 저장 |
| `CODEX_AGENT_MODE` | `codex` 또는 테스트용 `fake` | 예시값만 저장 |
| `CODEX_MODEL` | 선택적 Codex 모델 지정 | 예시값만 저장 |

Codex 로그인 세션과 OAuth 토큰도 기기별로 관리합니다. GitHub에 토큰이나
세션 파일을 커밋하지 않습니다.

## 다른 기기와 코드 동기화

작업을 시작하기 전에:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/<작업이름>
```

작업을 공유할 때:

```bash
git add <변경한 파일>
git commit -m "feat: 변경 내용"
git push -u origin feature/<작업이름>
```

기능 브랜치를 검토한 후 GitHub에서 `main`으로 병합합니다. 긴급한 경우가
아니면 여러 기기에서 `main`을 직접 동시에 수정하지 않는 것이 안전합니다.

## 검증

코드를 푸시하기 전에 실행합니다.

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
```

E2E는 개발 DB와 다른 `TEST_DATABASE_URL` 또는 `E2E_DATABASE_URL`을 요구합니다.

## 보안 체크리스트

- `.env`, API 키, OAuth 토큰, Codex 세션 파일을 커밋하지 않습니다.
- 공개 데모 계정 외의 실제 사용자 ID/PW를 문서에 기록하지 않습니다.
- 업로드한 Excel 원본과 PostgreSQL 백업을 Git에 올리지 않습니다.
- 실수로 비밀값을 푸시했다면 파일만 지우지 말고 해당 키를 즉시 폐기·재발급합니다.
