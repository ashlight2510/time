const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 설정
app.use(cors());
app.use(express.json());

// 정적 파일 서빙
app.use(express.static(path.join(__dirname)));

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

        // UTC 시간을 파싱하고 KST로 변환
        const serverTimeUTC = new Date(result.dateHeader).getTime();
        if (isNaN(serverTimeUTC) || serverTimeUTC <= 0) {
            console.error(`[${platformId}] Invalid date header:`, result.dateHeader);
            return res.status(500).json({ 
                error: 'Invalid date header format',
                dateHeader: result.dateHeader
            });
        }

        // KST 변환 (UTC + 9시간)
        const serverTimeKST = serverTimeUTC + (9 * 60 * 60 * 1000);
        
        // RTT 보정 (왕복 시간의 절반을 더함)
        const correctedTime = serverTimeKST + (roundTripTime / 2);

        console.log(`[${platformId}] Server time fetched:`, {
            dateHeader: result.dateHeader,
            serverTimeUTC: new Date(serverTimeUTC).toISOString(),
            serverTimeKST: new Date(serverTimeKST).toISOString(),
            correctedTime: new Date(correctedTime).toISOString(),
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
                    const serverTimeKST = serverTimeUTC + (9 * 60 * 60 * 1000);
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

// 루트 경로는 index.html로 리다이렉트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 API endpoints:`);
    console.log(`   - GET /api/platform-time/:platformId`);
    console.log(`   - GET /api/platform-times`);
    console.log(`   - GET /api/health`);
});

