# 예매는타이밍 (Ticketing Server Clock)

티켓팅용 밀리초 단위 정확도 서버시계 웹 애플리케이션

> **참고**: 이 프로젝트는 프론트엔드와 백엔드가 분리된 구조입니다.
>
> - **프론트엔드**: 이 폴더의 파일들 (GitHub Pages에 배포)
> - **백엔드 API**: `api/` 폴더 (Render.com 등에 별도 배포)

## 기능

- 🕐 서버 시간 동기화 (NTP 기반, 밀리초 정확도)
- ⏰ 티켓팅 플랫폼별 서버 시간 비교 (멜론, 인터파크, 네이버, 예스24)
- ⏳ 티켓팅 카운트다운 타이머
- 📋 티켓팅 준비 체크리스트
- 🌙 다크 모드
- 🖥️ 전체화면 모드
- 📱 위젯 모드 (PIP)
- 📱 반응형 디자인

## 설치 및 실행

### 1. 의존성 설치

```bash
yarn install
```

또는

```bash
npm install
```

### 2. 서버 실행

```bash
yarn start
```

또는

```bash
npm start
```

서버가 `http://localhost:3000`에서 실행됩니다.

### 3. 브라우저에서 접속

브라우저에서 `http://localhost:3000`으로 접속하세요.

## API 엔드포인트

백엔드 프록시 서버가 제공하는 API:

- `GET /api/platform-time/:platformId` - 특정 플랫폼의 서버 시간 가져오기

  - 예: `/api/platform-time/melon`
  - 지원 플랫폼: `melon`, `interpark`, `yes24`

- `GET /api/platform-times` - 모든 플랫폼의 서버 시간을 한 번에 가져오기

- `GET /api/health` - 서버 상태 확인

## 기술 스택

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Express
- **서버 시간 동기화**: NTP 기반 API (WorldTimeAPI, TimeAPI.io 등)
- **티켓팅 플랫폼 시간**: HTTP HEAD 요청 + Date 헤더 파싱

## 배포

정적 파일과 Express 서버를 함께 배포해야 합니다.

### Vercel / Netlify

서버리스 함수로 `server.js`를 배포하거나, Express 서버를 그대로 배포할 수 있습니다.

### 일반 서버

Node.js가 설치된 서버에서:

```bash
yarn install
yarn start
```

PM2를 사용한 프로덕션 실행:

```bash
pm2 start server.js --name ticketing-clock
```

## 라이선스

MIT
