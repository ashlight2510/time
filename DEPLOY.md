# 배포 가이드

이 프로젝트는 프론트엔드와 백엔드가 분리된 구조입니다.

## 구조

```
프로젝트/
├── api/              # 백엔드 API 서버 (Render/Vercel 등에 배포)
│   ├── server.js
│   └── package.json
├── index.html        # 프론트엔드 (GitHub Pages에 배포)
├── script.js
├── style.css
└── ...
```

## 배포 순서

### 1. 백엔드 API 서버 배포 (Render.com 추천)

#### Render.com 배포

1. GitHub에 코드 푸시
2. [Render.com](https://render.com)에 가입
3. "New" → "Web Service" 선택
4. GitHub 저장소 연결
5. 설정:
   - **Name**: `ticketing-time-api`
   - **Root Directory**: `api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. "Create Web Service" 클릭

배포 완료 후 URL 예시: `https://ticketing-time-api.onrender.com`

#### Railway.app 배포

1. [Railway.app](https://railway.app)에 가입
2. "New Project" → "Deploy from GitHub repo"
3. 저장소 선택
4. Root Directory를 `api`로 설정
5. 배포 완료

### 2. 프론트엔드 배포 (GitHub Pages)

1. GitHub 저장소의 Settings → Pages로 이동
2. Source를 `main` 브랜치의 `/ (root)`로 설정
3. 저장

### 3. API URL 설정

프론트엔드가 배포된 API 서버를 사용하도록 설정:

**방법 1: index.html에서 직접 설정**

`index.html`의 `<head>` 섹션에서:

```html
<script>
  // 배포한 API 서버 URL로 변경
  window.API_BASE_URL = 'https://ticketing-time-api.onrender.com';
</script>
```

**방법 2: 환경 변수 사용 (고급)**

GitHub Actions를 사용하여 빌드 시점에 API URL을 주입할 수 있습니다.

## 로컬 개발

### 백엔드 실행

```bash
cd api
npm install
npm start
```

백엔드가 `http://localhost:3000`에서 실행됩니다.

### 프론트엔드 실행

로컬 개발 시에는 `script.js`에서 자동으로 `http://localhost:3000`을 사용합니다.

브라우저에서 `index.html`을 열거나, 간단한 HTTP 서버를 사용:

```bash
# Python 3
python -m http.server 8080

# 또는 Node.js serve
npx serve -p 8080
```

## 도메인 연결 (선택사항)

### API 서버 도메인

Render.com에서:
1. Settings → Custom Domain
2. 도메인 추가: `api.time.ashlight.store`
3. DNS 설정 안내에 따라 CNAME 레코드 추가

### 프론트엔드 도메인

GitHub Pages에서:
1. 저장소 Settings → Pages → Custom domain
2. 도메인 추가: `time.ashlight.store`
3. DNS 설정 안내에 따라 A 레코드 또는 CNAME 레코드 추가

## 문제 해결

### CORS 오류

백엔드 API 서버의 CORS 설정을 확인하세요. `api/server.js`에서:

```javascript
app.use(cors({
    origin: ['https://your-frontend-domain.com'], // 프론트엔드 도메인 추가
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));
```

### API 연결 실패

1. API 서버가 정상 실행 중인지 확인 (`/api/health` 엔드포인트 테스트)
2. 브라우저 콘솔에서 네트워크 오류 확인
3. `API_BASE_URL` 설정이 올바른지 확인

## 비용

- **GitHub Pages**: 무료
- **Render.com**: 무료 플랜 제공 (15분 비활성 시 슬리핑)
- **Railway.app**: 무료 플랜 제공 (제한적)

## 성능 최적화

- Render.com 무료 플랜은 슬리핑이 있으므로, 첫 요청 시 약간의 지연이 있을 수 있습니다.
- 프로덕션 환경에서는 유료 플랜 사용을 권장합니다.

