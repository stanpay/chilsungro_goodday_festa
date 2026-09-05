# 칠성로 굿데이 페스타 (Stan)

제주 원도심 상점가의 할인·혜택 정보를 지도와 목록으로 안내하는 웹앱입니다.
여행자 소비쿠폰·지역화폐·고유가 지원금 사용 가능 매장을 현재 위치 기준으로 찾고,
네이버 지도로 길안내를 받을 수 있습니다. 한국어·영어·중국어·일본어를 지원합니다.

## 기술 스택

| 영역 | 사용 기술 |
|------|-----------|
| 프론트엔드 | React 18 · TypeScript · Vite · TailwindCSS · shadcn/ui |
| 상태·데이터 | TanStack Query (설정만 적용, 매장 페칭은 아직 원시 fetch) |
| 지도·검색 | 네이버 지도 SDK, 카카오 로컬 API (서버리스 프록시 경유) |
| 백엔드 | Vercel 서버리스 함수 (`/api`) + 외부 매장 API |
| 모바일 | Expo WebView 래퍼 (`mobile/`) |
| 배포 | Vercel |

## 시작하기

```bash
npm install
cp .env.example .env
npm run dev
```

개발 서버는 http://localhost:8080 에서 실행됩니다.
네이버 클라우드 콘솔의 Web 서비스 URL에 `http://localhost:8080` 을 등록해야 지도가 뜹니다.

### 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 (8080) |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` | ESLint |

## 환경변수

전체 목록과 설명은 [`.env.example`](.env.example)에 있습니다. 요약하면 세 묶음입니다.

- **`VITE_*` (클라이언트)** — 빌드 시 번들에 인라인되므로 **비밀키를 넣지 마세요.**
  네이버 지도 clientId는 도메인 화이트리스트로 보호되는 공개 키라 노출이 정상입니다.
- **서버리스 (`/api`)** — 카카오 REST 키와 네이버 NCP 자격증명. `VITE_` 접두사를 붙이면
  번들에 노출되므로 절대 붙이지 마세요. Vercel 대시보드에 등록합니다.
- **모바일** — `EXPO_PUBLIC_WEB_URL`. WebView가 로드할 웹 주소이며,
  이 값의 출처가 WebView의 `originWhitelist` 기준이 됩니다.

## 라우트

| 경로 | 설명 |
|------|------|
| `/`, `/jeju`, `/main` | 매장 목록·지도 (메인) |
| `/location` | 위치 검색·최근 위치 |
| `/navigate` | 제주여행자센터 안내·길안내 |
| `/jejuqronedosim` | `/navigate` 로 리다이렉트 (외부 QR·인쇄물 진입용 추정) |
| `/landing` | 미완성 랜딩 초안 |
| `/dev-tools-9f3k`, `/filter-legacy-demo`, `/filter-dropdown-legacy-demo` | **개발 전용** — `import.meta.env.DEV` 가드로 프로덕션 빌드에서 제외됨 |

## 서버리스 함수 (`/api`)

4개 모두 실사용 중이며 삭제하면 안 됩니다.

| 엔드포인트 | 용도 |
|------------|------|
| `/api/kakao/search` | 카카오 로컬 키워드 검색 (주소·장소) |
| `/api/naver/geocode` | 주소 → 좌표 |
| `/api/naver/reverse-geocode` | 좌표 → 주소 |
| `/api/store-redirect-target` | 매장 길안내 리다이렉트 체인 해석 |

API 키는 서버에만 보관되며 클라이언트 번들에 포함되지 않습니다.
공통 전처리(출처 검증·업스트림 오류 차단)는 [`api/_http.ts`](api/_http.ts)에 있습니다.

## 알려진 제약

유지보수 시 참고할 사항입니다.

- **매장 상세는 일부 더미** — 매장 목록(`getNearbyStores`)만 실서버 연동이고,
  할인·주차·영업시간 상세는 더미 데이터에 매칭됩니다.
- **자체 호스트 의존** — 매장 API와 Chatwoot이 비표준 포트의 단일 호스트(`mac.kurl.kr`)를
  기본값으로 사용합니다. 기업·공용망에서 차단될 수 있습니다.
- **런타임 번역** — 비한국어 로케일에서 매장명·주소를 무료 번역 API로 실시간 번역하며
  캐시가 메모리에만 있습니다. 언어 전환 한 번에 수백 건의 요청이 발생합니다.
- **`Main.tsx`가 약 4,000줄** — 지도·필터·검색·목록 로직이 한 파일에 모여 있습니다.
- **CSP는 Report-Only** — `vercel.json`의 CSP는 아직 차단하지 않고 위반만 기록합니다.
  실제 사용 흐름으로 위반 목록을 다듬은 뒤 적용 모드로 전환해야 합니다.

## 배포

`main` 브랜치 푸시 시 Vercel이 자동 배포합니다.
PR·푸시에서는 GitHub Actions([`.github/workflows/ci.yml`](.github/workflows/ci.yml))가
빌드·타입 검사·린트를 실행하며, 셋 다 실패하면 PR이 막힙니다.
ESLint 경고(미사용 변수 등)는 아직 남아 있어 실패시키지 않습니다 —
경고까지 막으려면 `lint` 스크립트에 `--max-warnings=0`을 붙이면 됩니다.
