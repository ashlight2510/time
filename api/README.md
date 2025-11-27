# 티켓팅 서버 시간 API

티켓팅 플랫폼(멜론, 인터파크, 예스24)의 서버 시간을 가져오는 백엔드 API 서버입니다.

## 배포 대상

이 API 서버는 다음 플랫폼에 배포할 수 있습니다:

- **Render.com** (추천) - 무료 플랜에서 Node.js 서버 실행 가능
- **Railway.app** - 무료 플랜 제공
- **Vercel** - Serverless Functions로 변환 필요
- **Cloudflare Workers** - 코드 재작성 필요
- **Heroku** - 유료 플랜 필요

## 로컬 실행

```bash
cd api
npm install
npm start
```

서버가 `http://localhost:3000`에서 실행됩니다.

## API 엔드포인트

### `GET /api/platform-time/:platformId`

특정 플랫폼의 서버 시간을 가져옵니다.

**지원 플랫폼:**
- `melon` - 멜론 티켓
- `interpark` - 인터파크 티켓
- `yes24` - 예스24 티켓

**예시:**
```bash
curl http://localhost:3000/api/platform-time/melon
```

**응답:**
```json
{
  "platformId": "melon",
  "serverTime": 1701234567890,
  "serverTimeUTC": 1701201567890,
  "serverTimeKST": 1701234567890,
  "roundTripTime": 45,
  "dateHeader": "Wed, 29 Nov 2023 12:34:56 GMT",
  "timestamp": 1701234567890
}
```

### `GET /api/platform-times`

모든 플랫폼의 서버 시간을 한 번에 가져옵니다.

**예시:**
```bash
curl http://localhost:3000/api/platform-times
```

### `GET /api/health`

서버 상태 확인

**예시:**
```bash
curl http://localhost:3000/api/health
```

## Render.com 배포 방법

1. GitHub에 코드 푸시
2. [Render.com](https://render.com)에 가입
3. "New" → "Web Service" 선택
4. GitHub 저장소 연결
5. 설정:
   - **Name**: `ticketing-time-api` (원하는 이름)
   - **Root Directory**: `api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. "Create Web Service" 클릭

배포 완료 후 제공되는 URL을 프론트엔드의 `API_BASE_URL`에 설정하세요.

## 환경 변수

- `PORT`: 서버 포트 (기본값: 3000)

## CORS 설정

현재는 모든 origin을 허용하도록 설정되어 있습니다. 프로덕션 환경에서는 특정 도메인만 허용하도록 수정하는 것을 권장합니다.

```javascript
app.use(cors({
    origin: ['https://your-frontend-domain.com'],
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));
```

