const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 설정 - 모든 origin 허용 (프로덕션에서는 특정 도메인만 허용하도록 수정 권장)
app.use(cors({
    origin: '*',
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// 티켓팅 플랫폼 URL 매핑
const platformUrls = {
    melon: 'https://ticket.melon.com',
    interpark: 'https://nol.interpark.com',
    yes24: 'https://ticket.yes24.com'
};

// HTTP/HTTPS 요청 헬퍼 함수
function fetchWithHeaders(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...options.headers
            },
            timeout: options.timeout || 5000
        };

        const req = client.request(requestOptions, (res) => {
            const headers = res.headers;
            resolve({
                statusCode: res.statusCode,
                headers: headers,
                dateHeader: headers.date || headers.Date
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// 티켓팅 플랫폼 서버 시간 가져오기 API
app.get('/api/platform-time/:platformId', async (req, res) => {
    const { platformId } = req.params;
    const url = platformUrls[platformId];

    if (!url) {
        return res.status(400).json({ 
            error: 'Invalid platform ID',
            availablePlatforms: Object.keys(platformUrls)
        });
    }

    try {
        const startTime = Date.now();
        const result = await fetchWithHeaders(url, {
            method: 'HEAD',
            timeout: 8000
        });
        const endTime = Date.now();
        const roundTripTime = endTime - startTime;

        if (!result.dateHeader) {
            console.error(`[${platformId}] Date header not found. Status: ${result.statusCode}, Headers:`, Object.keys(result.headers || {}));
            return res.status(500).json({ 
                error: 'Date header not found in response',
                platformId,
                statusCode: result.statusCode,
                availableHeaders: Object.keys(result.headers || {})
            });
        }

        // UTC 시간을 파싱
        const serverTimeUTC = new Date(result.dateHeader).getTime();
        if (isNaN(serverTimeUTC) || serverTimeUTC <= 0) {
            console.error(`[${platformId}] Invalid date header:`, result.dateHeader);
            return res.status(500).json({ 
                error: 'Invalid date header format',
                dateHeader: result.dateHeader
            });
        }

        // 현재 서버 시간 (KST)
        const currentServerTime = Date.now();
        const currentServerTimeKST = new Date(currentServerTime);
        
        // HTTP Date 헤더는 표준상 UTC이지만, 일부 서버가 이미 KST로 반환할 수 있음
        // 두 가지 경우를 모두 테스트
        const serverTimeAsUTC = serverTimeUTC + (9 * 60 * 60 * 1000); // UTC로 가정하고 +9시간
        const serverTimeAsKST = serverTimeUTC; // 이미 KST로 가정
        
        // 현재 시간과 비교하여 더 가까운 값을 선택
        const diffAsUTC = Math.abs(serverTimeAsUTC - currentServerTime);
        const diffAsKST = Math.abs(serverTimeAsKST - currentServerTime);
        
        // 더 가까운 시간을 사용 (차이가 1시간 이내면 이미 KST로 간주)
        let serverTimeKST;
        if (diffAsKST < diffAsUTC && diffAsKST < 3600000) { // 1시간 이내 차이
            // 이미 KST로 반환되고 있음
            serverTimeKST = serverTimeAsKST;
        } else {
            // UTC로 반환되고 있음 (표준)
            serverTimeKST = serverTimeAsUTC;
        }
        
        // RTT 보정 (왕복 시간의 절반을 더함)
        const correctedTime = serverTimeKST + (roundTripTime / 2);
        
        // 서버 시간과 현재 시간 차이 계산
        const timeDiff = correctedTime - currentServerTime;
        const timeDiffSeconds = (timeDiff / 1000).toFixed(3);

        console.log(`[${platformId}] Server time fetched:`, {
            dateHeader: result.dateHeader,
            serverTimeUTC: new Date(serverTimeUTC).toISOString(),
            serverTimeAsUTC: new Date(serverTimeAsUTC).toISOString(),
            serverTimeAsKST: new Date(serverTimeAsKST).toISOString(),
            serverTimeKST: new Date(serverTimeKST).toISOString(),
            correctedTime: new Date(correctedTime).toISOString(),
            currentServerTime: currentServerTimeKST.toISOString(),
            timeDifference: `${timeDiffSeconds}초 (${timeDiff >= 0 ? '+' : ''}${timeDiffSeconds}초)`,
            diffAsUTC: (diffAsUTC / 1000).toFixed(3) + '초',
            diffAsKST: (diffAsKST / 1000).toFixed(3) + '초',
            usingKST: diffAsKST < diffAsUTC && diffAsKST < 3600000,
            roundTripTime: roundTripTime + 'ms'
        });

        res.json({
            platformId,
            serverTime: correctedTime,
            serverTimeUTC: serverTimeUTC,
            serverTimeKST: serverTimeKST,
            roundTripTime,
            dateHeader: result.dateHeader,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error(`[${platformId}] Error fetching server time:`, error.message, error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch server time',
            platformId,
            message: error.message,
            url: url
        });
    }
});

// 모든 플랫폼 시간을 한 번에 가져오기
app.get('/api/platform-times', async (req, res) => {
    const platforms = Object.keys(platformUrls);
    const results = {};

    // 병렬로 모든 플랫폼 시간 가져오기
    const promises = platforms.map(async (platformId) => {
        try {
            const startTime = Date.now();
            const result = await fetchWithHeaders(platformUrls[platformId], {
                method: 'HEAD',
                timeout: 5000
            });
            const endTime = Date.now();
            const roundTripTime = endTime - startTime;

            if (result.dateHeader) {
                const serverTimeUTC = new Date(result.dateHeader).getTime();
                if (!isNaN(serverTimeUTC) && serverTimeUTC > 0) {
                    // 시간대 자동 감지 로직 적용
                    const currentServerTime = Date.now();
                    const serverTimeAsUTC = serverTimeUTC + (9 * 60 * 60 * 1000);
                    const serverTimeAsKST = serverTimeUTC;
                    const diffAsUTC = Math.abs(serverTimeAsUTC - currentServerTime);
                    const diffAsKST = Math.abs(serverTimeAsKST - currentServerTime);
                    
                    const serverTimeKST = (diffAsKST < diffAsUTC && diffAsKST < 3600000) 
                        ? serverTimeAsKST 
                        : serverTimeAsUTC;
                    
                    const correctedTime = serverTimeKST + (roundTripTime / 2);
                    
                    return {
                        platformId,
                        success: true,
                        serverTime: correctedTime,
                        roundTripTime,
                        dateHeader: result.dateHeader
                    };
                }
            }
            
            return {
                platformId,
                success: false,
                error: 'Invalid date header'
            };
        } catch (error) {
            return {
                platformId,
                success: false,
                error: error.message
            };
        }
    });

    const platformResults = await Promise.allSettled(promises);
    
    platformResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            results[platforms[index]] = result.value;
        } else {
            results[platforms[index]] = {
                platformId: platforms[index],
                success: false,
                error: result.reason?.message || 'Unknown error'
            };
        }
    });

    res.json({
        timestamp: Date.now(),
        results
    });
});

// 헬스 체크
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: Date.now()
    });
});

// 루트 경로
app.get('/', (req, res) => {
    res.json({ 
        service: 'Ticketing Server Time API',
        version: '1.0.0',
        endpoints: {
            '/api/platform-time/:platformId': 'Get server time for a specific platform',
            '/api/platform-times': 'Get server times for all platforms',
            '/api/health': 'Health check'
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 API Server running on port ${PORT}`);
    console.log(`📡 API endpoints:`);
    console.log(`   - GET /api/platform-time/:platformId`);
    console.log(`   - GET /api/platform-times`);
    console.log(`   - GET /api/health`);
});

