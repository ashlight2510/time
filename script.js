// 서버 시간 관련 전역 변수
let serverTimeOffset = 0; // 서버 시간과 클라이언트 시간의 차이 (밀리초)
let serverTimeSyncTime = 0; // 마지막 동기화 시점의 클라이언트 시간
let serverTimeInterval = null;
let countdownInterval = null;
let autoFullscreenTimer = null;
let currentTimeSource = 'server'; // 현재 선택된 시간 소스

// 플랫폼별 보정값 (초 단위) - 기본값 (실제 서버 시간 가져오기 실패 시 사용)
const platformOffsets = {
    server: 0,
    melon: 0.2,
    interpark: -0.1,
    naver: 0.05,
    yes24: 0.1
};

// 플랫폼별 실제 서버 시간 (밀리초, 클라이언트 시간 기준)
const platformServerTimes = {
    melon: null,
    interpark: null,
    naver: null,
    yes24: null
};

// 플랫폼별 서버 시간 마지막 동기화 시점
const platformSyncTimes = {
    melon: 0,
    interpark: 0,
    naver: 0,
    yes24: 0
};

// 티켓팅 사이트 URL
const platformUrls = {
    melon: 'https://ticket.melon.com',
    interpark: 'https://tickets.interpark.com',
    naver: 'https://ticket.naver.com', // URL 수정
    yes24: 'https://ticket.yes24.com'
};

// DOM 준비 시 초기화
function initializeApp() {
    const today = new Date();
    const todayString = formatDateForInput(today);
    
    // 목표 날짜 입력란에 오늘 날짜 설정
    const targetDateInput = document.getElementById('targetDate');
    if (targetDateInput) {
        targetDateInput.value = todayString;
    }
    
    // 시작 날짜 입력란에 오늘 날짜 설정
    const startDateInput = document.getElementById('startDate');
    if (startDateInput) {
        startDateInput.value = todayString;
    }
    
    // 위젯 날짜도 오늘로 설정
    const widgetDateInput = document.getElementById('widgetDate');
    if (widgetDateInput) {
        widgetDateInput.value = todayString;
    }
    
    // 카운트다운 날짜도 오늘로 설정
    const countdownDateInput = document.getElementById('countdownDate');
    if (countdownDateInput) {
        countdownDateInput.value = todayString;
    }
    
    // 카운트다운 시간 기본값을 오후 8시로 설정
    const countdownTimeInput = document.getElementById('countdownTime');
    if (countdownTimeInput && !countdownTimeInput.value) {
        countdownTimeInput.value = '20:00';
    }
    
    // 서버 시간 동기화 시작
    syncServerTime();
    
    // 서버 시간 업데이트 시작
    startServerTimeUpdate();
    
    // 플랫폼 시간 업데이트 시작
    startPlatformTimeUpdate();
    
    // 티켓팅 사이트 서버 시간 동기화 시작
    syncPlatformServerTimes();
    
    // 1분마다 티켓팅 사이트 서버 시간 동기화
    setInterval(syncPlatformServerTimes, 60 * 1000);
    
    // 암전 모드 초기화
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    if (savedDarkMode) {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById('darkModeBtn');
        if (btn) btn.textContent = '☀️ 일반 모드';
    }
    
    // 위젯 모드 초기화
    const savedWidgetMode = localStorage.getItem('widgetMode') === 'true';
    if (savedWidgetMode) {
        toggleWidgetMode();
    }
    
    // 전체화면 이벤트 리스너
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.body.classList.remove('fullscreen-mode');
            const btn = document.getElementById('fullscreenBtn');
            if (btn) btn.textContent = '📺 전체화면';
        }
    });
    
    // 테마 초기화
    initTheme();
    
    // 알림 권한 요청
    requestNotificationPermission();
    
    // 저장된 메모 불러오기
    loadMemos();
    
    // 체크리스트 자동 저장
    loadChecklist();
    setupChecklistListeners();
    
    // 시간 소스 초기화
    const savedTimeSource = localStorage.getItem('timeSource') || 'server';
    currentTimeSource = savedTimeSource;
    const timeSourceSelect = document.getElementById('timeSourceSelect');
    if (timeSourceSelect) {
        timeSourceSelect.value = currentTimeSource;
    }
    updateTimeSourceTitle();
}

function onDomReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

onDomReady(initializeApp);

// 날짜를 input[type="date"] 형식으로 변환 (YYYY-MM-DD)
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 날짜를 한국어 형식으로 포맷팅
function formatDateKorean(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

// 상세 시간 계산 (일, 시간, 분, 초)
function calculateDetailedTime(targetDate) {
    const now = new Date();
    const diff = targetDate - now;
    
    if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return { days, hours, minutes, seconds, total: diff };
}

// D-day 계산 함수 (애니메이션 포함)
function calculateDday() {
    const targetDateInput = document.getElementById('targetDate');
    const resultBox = document.getElementById('ddayResult');
    
    if (!targetDateInput.value) {
        alert('목표 날짜를 선택해주세요.');
        targetDateInput.focus();
        return;
    }
    
    const targetDate = new Date(targetDateInput.value + 'T00:00:00');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const detailedTime = calculateDetailedTime(targetDate);
    
    let resultHTML = '';
    
    if (diffDays === 0) {
        resultHTML = `
            <h3>🎉 오늘이 바로 목표일입니다!</h3>
            <div class="dday-number animate-count" style="color: var(--secondary-color);">D-day</div>
            <p class="dday-text">축하합니다! 오늘이 바로 그 날입니다! 🎊</p>
        `;
    } else if (diffDays > 0) {
        resultHTML = `
            <h3>📅 목표일</h3>
            <div class="dday-number animate-count">D-<span id="countNumber" class="number-animate">${diffDays}</span></div>
            <p class="dday-text">${formatDateKorean(targetDate)}까지 남았습니다.</p>
            <div class="detailed-time">
                <div class="time-item">
                    <span class="time-value number-animate" id="daysValue">${detailedTime.days}</span>
                    <span class="time-label">일</span>
                </div>
                <div class="time-item">
                    <span class="time-value number-animate" id="hoursValue">${detailedTime.hours}</span>
                    <span class="time-label">시간</span>
                </div>
                <div class="time-item">
                    <span class="time-value number-animate" id="minutesValue">${detailedTime.minutes}</span>
                    <span class="time-label">분</span>
                </div>
                <div class="time-item">
                    <span class="time-value number-animate" id="secondsValue">${detailedTime.seconds}</span>
                    <span class="time-label">초</span>
                </div>
            </div>
        `;
    } else {
        const pastDays = Math.abs(diffDays);
        resultHTML = `
            <h3>📅 목표일</h3>
            <div class="dday-number animate-count" style="color: var(--danger-color);">D+${pastDays}</div>
            <p class="dday-text">${formatDateKorean(targetDate)}로부터 <strong>${pastDays}일</strong> 지났습니다.</p>
        `;
    }
    
    // 공유 버튼 추가
    resultHTML += `
        <div class="share-buttons">
            <button class="btn btn-secondary share-btn" onclick="shareToKakao('${targetDateInput.value}', ${diffDays})">
                💬 카카오톡 공유
            </button>
            <button class="btn btn-secondary share-btn" onclick="shareToInstagram('${targetDateInput.value}', ${diffDays})">
                📷 인스타그램 공유
            </button>
            <button class="btn btn-secondary share-btn" onclick="copyShareImage('${targetDateInput.value}', ${diffDays})">
                📋 이미지 복사
            </button>
        </div>
    `;
    
    resultBox.innerHTML = resultHTML;
    resultBox.classList.add('show');
    
    // 카운트 애니메이션
    if (diffDays > 0) {
        animateCount('countNumber', 0, diffDays);
        animateCount('daysValue', 0, detailedTime.days);
        animateCount('hoursValue', 0, detailedTime.hours);
        animateCount('minutesValue', 0, detailedTime.minutes);
        animateCount('secondsValue', 0, detailedTime.seconds);
        
        // 실시간 카운트다운 시작
        startCountdown(targetDate, resultBox);
    }
    
    // 알림 설정
    if (diffDays > 0) {
        scheduleNotifications(targetDate, diffDays);
    }
}

// 실시간 카운트다운
function startCountdown(targetDate, resultBox) {
    // 기존 인터벌 정리
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    countdownInterval = setInterval(() => {
        const detailedTime = calculateDetailedTime(targetDate);
        
        if (detailedTime.total <= 0) {
            clearInterval(countdownInterval);
            resultBox.innerHTML = `
                <h3>🎉 목표일이 도착했습니다!</h3>
                <div class="dday-number" style="color: var(--secondary-color);">D-day</div>
                <p class="dday-text">축하합니다! 목표일이 되었습니다! 🎊</p>
            `;
            return;
        }
        
        // 숫자 업데이트 (애니메이션과 함께)
        updateAnimatedNumber('daysValue', detailedTime.days);
        updateAnimatedNumber('hoursValue', detailedTime.hours);
        updateAnimatedNumber('minutesValue', detailedTime.minutes);
        updateAnimatedNumber('secondsValue', detailedTime.seconds);
        
        // D-day 숫자도 업데이트
        const diffDays = Math.ceil(detailedTime.total / (1000 * 60 * 60 * 24));
        const countElement = document.getElementById('countNumber');
        if (countElement) {
            const currentValue = parseInt(countElement.textContent) || 0;
            if (currentValue !== diffDays) {
                animateCount('countNumber', currentValue, diffDays);
            }
        }
    }, 1000);
}

// 애니메이션과 함께 숫자 업데이트
function updateAnimatedNumber(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    if (currentValue !== newValue) {
        // 작은 변화는 바로 업데이트, 큰 변화는 애니메이션
        if (Math.abs(currentValue - newValue) > 10) {
            animateCount(elementId, currentValue, newValue);
        } else {
            // 작은 변화는 부드럽게
            element.textContent = newValue;
            element.classList.add('number-pulse');
            setTimeout(() => {
                element.classList.remove('number-pulse');
            }, 300);
        }
    }
}

// 카운트 애니메이션 (재밌게!)
function animateCount(elementId, start, end) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // 이미 애니메이션 중이면 중단
    if (element.dataset.animating === 'true') {
        return;
    }
    
    element.dataset.animating = 'true';
    element.classList.add('number-rolling');
    
    const duration = 800;
    const startTime = performance.now();
    const range = end - start;
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 이징 함수 (easeOutCubic)
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(start + range * easeProgress);
        
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = end;
            element.dataset.animating = 'false';
            element.classList.remove('number-rolling');
        }
    }
    
    requestAnimationFrame(update);
}

// 역계산 함수 (N일 후는 언제인지)
function calculateFutureDate() {
    const daysInput = document.getElementById('daysInput');
    const startDateInput = document.getElementById('startDate');
    const resultBox = document.getElementById('futureDateResult');
    
    if (!daysInput.value || parseInt(daysInput.value) <= 0) {
        alert('올바른 일 수를 입력해주세요.');
        daysInput.focus();
        return;
    }
    
    const days = parseInt(daysInput.value);
    let startDate;
    
    if (startDateInput.value) {
        startDate = new Date(startDateInput.value + 'T00:00:00');
    } else {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
    }
    
    const futureDate = new Date(startDate);
    futureDate.setDate(futureDate.getDate() + days);
    
    const startDateString = formatDateForInput(startDate);
    const futureDateString = formatDateForInput(futureDate);
    
    resultBox.innerHTML = `
        <h3>📆 ${days}일 후</h3>
        <div class="dday-number animate-count" style="color: var(--secondary-color);">${formatDateKorean(futureDate)}</div>
        <p class="dday-text">${formatDateKorean(startDate)}로부터 <strong>${days}일</strong> 후입니다.</p>
        <div class="share-buttons">
            <button class="btn btn-secondary share-btn" onclick="shareToKakao('${futureDateString}', ${days}, '${startDateString}')">
                💬 카카오톡 공유
            </button>
            <button class="btn btn-secondary share-btn" onclick="shareToInstagram('${futureDateString}', ${days}, '${startDateString}')">
                📷 인스타그램 공유
            </button>
            <button class="btn btn-secondary share-btn" onclick="copyShareImage('${futureDateString}', ${days}, '${startDateString}', '${days}일 후')">
                📋 이미지 복사
            </button>
        </div>
    `;
    resultBox.classList.add('show');
}

// 빠른 계산 함수
function quickCalculate(days) {
    const startDateInput = document.getElementById('startDate');
    const resultBox = document.getElementById('quickResult');
    
    let startDate;
    if (startDateInput.value) {
        startDate = new Date(startDateInput.value + 'T00:00:00');
    } else {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
    }
    
    const futureDate = new Date(startDate);
    futureDate.setDate(futureDate.getDate() + days);
    
    let periodText = '';
    if (days === 50) periodText = '50일 후';
    else if (days === 100) periodText = '100일 후';
    else if (days === 200) periodText = '200일 후';
    else if (days === 300) periodText = '300일 후';
    
    resultBox.innerHTML = `
        <h3>⚡ ${periodText}</h3>
        <div class="dday-number animate-count" style="color: var(--secondary-color);">${formatDateKorean(futureDate)}</div>
        <p class="dday-text">${formatDateKorean(startDate)}로부터 <strong>${days}일</strong> 후입니다.</p>
    `;
    resultBox.classList.add('show');
    
    // 시작 날짜 입력란에 결과 날짜 자동 입력
    document.getElementById('startDate').value = formatDateForInput(futureDate);
}

// 메모 저장
function saveMemo() {
    const memoText = document.getElementById('memoText').value.trim();
    if (!memoText) {
        alert('메모를 입력해주세요.');
        return;
    }
    
    const memos = getMemos();
    const memo = {
        id: Date.now().toString(),
        text: memoText,
        date: new Date().toISOString(),
        dateString: formatDateKorean(new Date())
    };
    
    memos.push(memo);
    localStorage.setItem('ddayMemos', JSON.stringify(memos));
    
    document.getElementById('memoText').value = '';
    loadMemos();
    alert('메모가 저장되었습니다!');
}

// 메모 불러오기
function getMemos() {
    const saved = localStorage.getItem('ddayMemos');
    return saved ? JSON.parse(saved) : [];
}

// 저장된 메모 표시
function loadMemos() {
    const memos = getMemos();
    const listContainer = document.getElementById('memosList');
    
    // 요소가 없으면 조용히 반환
    if (!listContainer) {
        return;
    }
    
    if (memos.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">저장된 메모가 없습니다.</p>';
        return;
    }
    
    // 최신순으로 정렬
    memos.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    listContainer.innerHTML = memos.map(memo => `
        <div class="memo-item">
            <div class="memo-date">${memo.dateString}</div>
            <div class="memo-text">${memo.text}</div>
            <div class="memo-actions-inline">
                <button class="btn btn-secondary share-btn" onclick="shareMemoToKakao('${memo.id}')" style="margin-top: 10px; padding: 5px 10px; font-size: 0.9em; flex: 1;">
                    💬 카톡 공유
                </button>
                <button class="btn btn-secondary share-btn" onclick="shareMemoToInstagram('${memo.id}')" style="margin-top: 10px; padding: 5px 10px; font-size: 0.9em; flex: 1;">
                    📷 인스타 공유
                </button>
                <button class="btn btn-secondary share-btn" onclick="copyMemoImage('${memo.id}')" style="margin-top: 10px; padding: 5px 10px; font-size: 0.9em; flex: 1;">
                    📋 이미지 복사
                </button>
                <button class="btn btn-danger" onclick="deleteMemo('${memo.id}')" style="margin-top: 10px; padding: 5px 10px; font-size: 0.9em; flex: 1;">삭제</button>
            </div>
        </div>
    `).join('');
}

// 메모 삭제
function deleteMemo(id) {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;
    
    const memos = getMemos();
    const filtered = memos.filter(m => m.id !== id);
    localStorage.setItem('ddayMemos', JSON.stringify(filtered));
    loadMemos();
}

// 위젯 코드 생성
function generateWidget() {
    const widgetDate = document.getElementById('widgetDate').value;
    const widgetTitle = document.getElementById('widgetTitle').value || 'D-day';
    
    if (!widgetDate) {
        alert('날짜를 선택해주세요.');
        return;
    }
    
    const targetDate = new Date(widgetDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const widgetCode = `
<iframe src="${window.location.origin}/widget.html?date=${widgetDate}&title=${encodeURIComponent(widgetTitle)}" 
        width="300" 
        height="150" 
        frameborder="0" 
        scrolling="no">
</iframe>
    `.trim();
    
    const resultBox = document.getElementById('widgetResult');
    resultBox.innerHTML = `
        <div class="widget-preview">
            <h4>위젯 미리보기</h4>
            <div style="border: 2px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; background: #f9f9f9;">
                <strong>${widgetTitle}</strong><br>
                ${formatDateKorean(targetDate)}까지<br>
                <span style="font-size: 1.5em; color: var(--primary-color); font-weight: bold;">D-${diffDays}</span>
            </div>
        </div>
        <div class="widget-code">
            <h4>HTML 코드</h4>
            <textarea readonly style="width: 100%; min-height: 100px; padding: 10px; font-family: monospace; border: 1px solid #ddd; border-radius: 5px;">${widgetCode}</textarea>
            <button class="btn btn-secondary" onclick="copyWidgetCode()" style="margin-top: 10px;">코드 복사</button>
        </div>
    `;
    resultBox.classList.add('show');
    
    // 전역 변수에 저장
    window.widgetCodeToCopy = widgetCode;
}

// 위젯 코드 복사
function copyWidgetCode() {
    if (window.widgetCodeToCopy) {
        navigator.clipboard.writeText(window.widgetCodeToCopy).then(() => {
            alert('코드가 클립보드에 복사되었습니다!');
        });
    }
}

// 카카오톡 공유
function shareToKakao(dateString, days, startDateString = null, title = 'D-day') {
    // 현재 화면의 실제 값 가져오기
    let actualDays = days;
    if (!startDateString) {
        const countElement = document.getElementById('countNumber');
        if (countElement) {
            actualDays = parseInt(countElement.textContent) || days;
        }
    }
    
    // Web Share API 사용 (모바일에서 작동)
    if (navigator.share) {
        const shareData = {
            title: `${title} - D-day 계산기`,
            text: startDateString 
                ? `${formatDateKorean(new Date(startDateString + 'T00:00:00'))}로부터 ${days}일 후는 ${formatDateKorean(new Date(dateString + 'T00:00:00'))}입니다!`
                : `${formatDateKorean(new Date(dateString + 'T00:00:00'))}까지 D-${actualDays}`,
            url: window.location.href
        };
        
        navigator.share(shareData).catch(err => {
            console.log('공유 실패:', err);
            // 실패 시 이미지 다운로드
            const shareImage = generateShareImage(dateString, actualDays, startDateString, title);
            downloadImage(shareImage, `dday-${dateString}.png`);
            alert('이미지를 다운로드했습니다. 카카오톡에서 공유해주세요!');
        });
    } else {
        // Web Share API를 지원하지 않는 경우 이미지 다운로드
        const shareImage = generateShareImage(dateString, actualDays, startDateString, title);
        downloadImage(shareImage, `dday-${dateString}.png`);
        alert('이미지를 다운로드했습니다. 카카오톡에서 공유해주세요!');
    }
}

// 인스타그램 공유
function shareToInstagram(dateString, days, startDateString = null, title = 'D-day') {
    try {
        // 현재 화면의 실제 값 가져오기
        let actualDays = days;
        if (!startDateString) {
            const countElement = document.getElementById('countNumber');
            if (countElement) {
                actualDays = parseInt(countElement.textContent) || days;
            }
        }
        
        const shareImage = generateShareImage(dateString, actualDays, startDateString, title);
        if (!shareImage) {
            alert('이미지 생성에 실패했습니다. 다시 시도해주세요.');
            return;
        }
        
        downloadImage(shareImage, `dday-${dateString}-${Date.now()}.png`);
        alert('이미지를 다운로드했습니다. 인스타그램 앱에서 업로드해주세요!');
    } catch (error) {
        console.error('인스타그램 공유 오류:', error);
        alert('이미지 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
}

// 이미지 복사
function copyShareImage(dateString, days, startDateString = null, title = 'D-day') {
    try {
        // 현재 화면의 실제 값 가져오기
        let actualDays = days;
        if (!startDateString) {
            const countElement = document.getElementById('countNumber');
            if (countElement) {
                actualDays = parseInt(countElement.textContent) || days;
            }
        }
        
        const shareImage = generateShareImage(dateString, actualDays, startDateString, title);
        if (!shareImage) {
            alert('이미지 생성에 실패했습니다. 다시 시도해주세요.');
            return;
        }
        
        // Clipboard API 지원 확인
        if (navigator.clipboard && navigator.clipboard.write) {
            shareImage.toBlob(blob => {
                if (!blob) {
                    downloadImage(shareImage, `dday-${dateString}-${Date.now()}.png`);
                    alert('이미지를 다운로드했습니다.');
                    return;
                }
                
                navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]).then(() => {
                    alert('이미지가 클립보드에 복사되었습니다!');
                }).catch(err => {
                    console.error('클립보드 복사 오류:', err);
                    // 실패 시 다운로드로 대체
                    downloadImage(shareImage, `dday-${dateString}-${Date.now()}.png`);
                    alert('클립보드 복사에 실패했습니다. 이미지를 다운로드했습니다.');
                });
            }, 'image/png');
        } else {
            // Clipboard API를 지원하지 않는 경우 다운로드
            downloadImage(shareImage, `dday-${dateString}-${Date.now()}.png`);
            alert('이 브라우저는 클립보드 복사를 지원하지 않습니다. 이미지를 다운로드했습니다.');
        }
    } catch (error) {
        console.error('이미지 복사 오류:', error);
        alert('이미지 복사 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
}

// 공유 이미지 생성
function generateShareImage(dateString, days, startDateString = null, title = 'D-day', memoText = null) {
    const canvas = document.getElementById('shareCanvas');
    if (!canvas) {
        console.error('shareCanvas를 찾을 수 없습니다.');
        return null;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas context를 가져올 수 없습니다.');
        return null;
    }
    
    // 카운트다운 중지 (저장 시 정지된 상태)
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    // 현재 화면의 실제 값 가져오기 (애니메이션 중이 아닌 정지된 값)
    let actualDays = days;
    let actualTime = { days: 0, hours: 0, minutes: 0, seconds: 0 };
    
    if (!memoText && !startDateString) {
        // D-day 계산인 경우
        const daysElement = document.getElementById('daysValue');
        const hoursElement = document.getElementById('hoursValue');
        const minutesElement = document.getElementById('minutesValue');
        const secondsElement = document.getElementById('secondsValue');
        
        if (daysElement) actualTime.days = parseInt(daysElement.textContent) || 0;
        if (hoursElement) actualTime.hours = parseInt(hoursElement.textContent) || 0;
        if (minutesElement) actualTime.minutes = parseInt(minutesElement.textContent) || 0;
        if (secondsElement) actualTime.seconds = parseInt(secondsElement.textContent) || 0;
        
        const countElement = document.getElementById('countNumber');
        if (countElement) {
            actualDays = parseInt(countElement.textContent) || days;
        }
    }
    
    canvas.width = 1200;
    canvas.height = 630;
    
    // 배경 그라데이션
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 텍스트
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    
    if (memoText) {
        // 메모 공유 이미지 - 감성적인 디자인
        // 날짜와 메모 텍스트 분리
        const memoLines = memoText.split('\n');
        let dateString = '';
        let memoContent = '';
        
        // 첫 번째 줄이 날짜 형식인지 확인 (예: "2024년 12월 19일 (목)")
        if (memoLines.length > 0 && memoLines[0].includes('년') && memoLines[0].includes('월')) {
            dateString = memoLines[0];
            memoContent = memoLines.slice(1).join('\n').trim();
        } else {
            // 날짜가 없으면 메모 전체를 내용으로
            memoContent = memoText;
        }
        
        // 날짜 표시 (있을 경우)
        if (dateString) {
            ctx.font = '48px Arial';
            ctx.fillText(dateString, canvas.width / 2, 200);
        }
        
        // 메모 내용 표시 (날짜 아래)
        ctx.font = '44px Arial';
        const lines = wrapText(ctx, memoContent || memoText, canvas.width - 200);
        let y = dateString ? 320 : 280;
        lines.forEach(line => {
            ctx.fillText(line, canvas.width / 2, y);
            y += 70;
        });
    } else if (startDateString) {
        // N일 후 계산 이미지
        ctx.font = 'bold 64px Arial';
        ctx.fillText(`${days}일 후`, canvas.width / 2, 180);
        
        ctx.font = '48px Arial';
        const startDate = new Date(startDateString + 'T00:00:00');
        ctx.fillText(formatDateKorean(startDate), canvas.width / 2, 280);
        
        ctx.font = 'bold 56px Arial';
        ctx.fillText('↓', canvas.width / 2, 360);
        
        ctx.font = '48px Arial';
        const futureDate = new Date(dateString + 'T00:00:00');
        ctx.fillText(formatDateKorean(futureDate), canvas.width / 2, 450);
    } else {
        // D-day 계산 이미지 (저장 시 정지된 값 사용) - 감성적인 디자인
        ctx.font = 'bold 120px Arial';
        ctx.fillText('D-' + actualDays, canvas.width / 2, 280);
        
        ctx.font = '48px Arial';
        const targetDate = new Date(dateString + 'T00:00:00');
        ctx.fillText(formatDateKorean(targetDate), canvas.width / 2, 380);
    }
    
    return canvas;
}

// 텍스트 줄바꿈 함수
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];
    
    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

// 이미지 다운로드
function downloadImage(canvas, filename) {
    try {
        if (!canvas) {
            console.error('Canvas가 없습니다.');
            return;
        }
        
        const dataURL = canvas.toDataURL('image/png');
        if (!dataURL || dataURL === 'data:,') {
            console.error('이미지 데이터를 생성할 수 없습니다.');
            alert('이미지 생성에 실패했습니다.');
            return;
        }
        
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataURL;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('이미지 다운로드 오류:', error);
        alert('이미지 다운로드 중 오류가 발생했습니다.');
    }
}

// 메모 카카오톡 공유
function shareMemoToKakao(memoId) {
    const memos = getMemos();
    const memo = memos.find(m => m.id === memoId);
    if (!memo) return;
    
    if (navigator.share) {
        const shareData = {
            title: '📝 D-day 메모',
            text: `${memo.dateString}\n${memo.text}`,
            url: window.location.href
        };
        
        navigator.share(shareData).catch(err => {
            console.log('공유 실패:', err);
            const shareImage = generateShareImage(null, null, null, '메모', `${memo.dateString}\n${memo.text}`);
            downloadImage(shareImage, `memo-${memoId}.png`);
            alert('이미지를 다운로드했습니다. 카카오톡에서 공유해주세요!');
        });
    } else {
        const shareImage = generateShareImage(null, null, null, '메모', `${memo.dateString}\n${memo.text}`);
        downloadImage(shareImage, `memo-${memoId}.png`);
        alert('이미지를 다운로드했습니다. 카카오톡에서 공유해주세요!');
    }
}

// 메모 인스타그램 공유
function shareMemoToInstagram(memoId) {
    const memos = getMemos();
    const memo = memos.find(m => m.id === memoId);
    if (!memo) return;
    
    const shareImage = generateShareImage(null, null, null, '메모', `${memo.dateString}\n${memo.text}`);
    downloadImage(shareImage, `memo-${memoId}.png`);
    alert('이미지를 다운로드했습니다. 인스타그램 앱에서 업로드해주세요!');
}

// 메모 이미지 복사
function copyMemoImage(memoId) {
    const memos = getMemos();
    const memo = memos.find(m => m.id === memoId);
    if (!memo) return;
    
    const shareImage = generateShareImage(null, null, null, '메모', `${memo.dateString}\n${memo.text}`);
    shareImage.toBlob(blob => {
        navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]).then(() => {
            alert('이미지가 클립보드에 복사되었습니다!');
        }).catch(() => {
            downloadImage(shareImage, `memo-${memoId}.png`);
            alert('이미지를 다운로드했습니다.');
        });
    });
}

// 알림 권한 요청
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// 알림 스케줄링
function scheduleNotifications(targetDate, days) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    
    const notifications = localStorage.getItem('ddayNotifications') ? JSON.parse(localStorage.getItem('ddayNotifications')) : {};
    const dateKey = formatDateForInput(targetDate);
    
    // 기존 알림 제거
    if (notifications[dateKey]) {
        notifications[dateKey].forEach(id => clearTimeout(id));
    }
    
    const timeouts = [];
    
    // 100일 전 알림
    if (days > 100) {
        const daysUntil100 = days - 100;
        const timeout100 = setTimeout(() => {
            new Notification('D-day 알림', {
                body: `${formatDateKorean(targetDate)}까지 100일 남았습니다!`,
                icon: '/favicon.svg'
            });
        }, daysUntil100 * 24 * 60 * 60 * 1000);
        timeouts.push(timeout100);
    }
    
    // 30일 전 알림
    if (days > 30) {
        const daysUntil30 = days - 30;
        const timeout30 = setTimeout(() => {
            new Notification('D-day 알림', {
                body: `${formatDateKorean(targetDate)}까지 30일 남았습니다!`,
                icon: '/favicon.svg'
            });
        }, daysUntil30 * 24 * 60 * 60 * 1000);
        timeouts.push(timeout30);
    }
    
    // 7일 전 알림
    if (days > 7) {
        const daysUntil7 = days - 7;
        const timeout7 = setTimeout(() => {
            new Notification('D-day 알림', {
                body: `${formatDateKorean(targetDate)}까지 7일 남았습니다!`,
                icon: '/favicon.svg'
            });
        }, daysUntil7 * 24 * 60 * 60 * 1000);
        timeouts.push(timeout7);
    }
    
    notifications[dateKey] = timeouts;
    localStorage.setItem('ddayNotifications', JSON.stringify(notifications));
}

// 오늘의 기념일 추천
function showDailyQuote() {
    const quotes = [
        '오늘도 목표를 향해 한 걸음씩! 💪',
        '작은 시작이 큰 변화를 만듭니다 ✨',
        '시간은 금이다. 소중하게 사용하세요 ⏰',
        '오늘이 바로 시작하는 날입니다! 🌟',
        '목표를 향한 여정, 오늘도 화이팅! 🚀',
        '하루하루가 소중한 시간입니다 📅',
        '꿈을 향해 달려가는 오늘이 되길 🌈'
    ];
    
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    const quoteElement = document.getElementById('dailyQuote');
    if (quoteElement) {
        quoteElement.textContent = randomQuote;
    }
}

// 테마 초기화
function initTheme() {
    const savedTheme = localStorage.getItem('ddayTheme') || 'purple';
    setTheme(savedTheme);
    
    // 테마 버튼 이벤트
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            setTheme(theme);
            localStorage.setItem('ddayTheme', theme);
        });
    });
}

// 테마 설정
function setTheme(theme) {
    const themes = {
        purple: { primary: '#667eea', secondary: '#764ba2' },
        blue: { primary: '#4a90e2', secondary: '#357abd' },
        green: { primary: '#50c878', secondary: '#45b869' },
        pink: { primary: '#ff6b9d', secondary: '#ff4d7a' },
        orange: { primary: '#ff8c42', secondary: '#ff6b1a' }
    };
    
    const selectedTheme = themes[theme] || themes.purple;
    document.documentElement.style.setProperty('--theme-primary', selectedTheme.primary);
    document.documentElement.style.setProperty('--theme-secondary', selectedTheme.secondary);
    
    // 헤더 배경 업데이트
    const header = document.querySelector('header');
    if (header) {
        header.style.background = `linear-gradient(135deg, ${selectedTheme.primary} 0%, ${selectedTheme.secondary} 100%)`;
    }
    
    // 활성 테마 버튼 표시
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

// Enter 키로 계산하기
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const target = e.target;
        if (target.id === 'targetDate') {
            calculateDday();
        } else if (target.id === 'daysInput' || target.id === 'startDate') {
            calculateFutureDate();
        }
    }
});

// ========== 서버 시간 관련 함수 ==========

// 서버 시간 동기화
async function syncServerTime() {
    // 티켓팅 사이트 서버 시간도 함께 동기화
    await syncPlatformServerTimes();
    
    try {
        // 여러 서버에서 시간을 가져와서 평균 계산 (순차적으로 시도)
        const timeSources = [
            () => fetchServerTime('https://worldtimeapi.org/api/timezone/Asia/Seoul'),
            () => fetchServerTime('https://worldtimeapi.org/api/ip'),
            () => fetchServerTime('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Seoul'),
            () => fetchServerTime('https://api.ipgeolocation.io/timezone?apiKey=free&tz=Asia/Seoul'),
            () => fetchServerTimeFromHeaders(),
            () => fetchServerTimeFromNTP()
        ];
        
        const validTimes = [];
        
        // 각 소스를 순차적으로 시도 (하나라도 성공하면 계속)
        for (const source of timeSources) {
            try {
                const time = await Promise.race([
                    source(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                ]);
                
                if (time !== null && time > 0) {
                    validTimes.push(time);
                    // 최소 2개 이상 모으면 충분
                    if (validTimes.length >= 2) break;
                }
            } catch (error) {
                // 다음 소스 시도
                continue;
            }
        }
        
        if (validTimes.length === 0) {
            // 모든 소스 실패 시 클라이언트 시간 사용
            serverTimeOffset = 0;
            return;
        }
        
        // 평균 계산
        const avgTime = validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length;
        const clientTime = Date.now();
        
        serverTimeOffset = avgTime - clientTime;
        serverTimeSyncTime = clientTime;
        
        // 5분마다 자동 동기화
        setTimeout(syncServerTime, 5 * 60 * 1000);
        
    } catch (error) {
        // 네트워크 에러는 조용히 처리 (정상적인 상황일 수 있음)
        serverTimeOffset = 0;
    }
}

// 서버 시간 가져오기 (다양한 API 지원)
async function fetchServerTime(url) {
    try {
        const startTime = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(url, { 
            cache: 'no-store',
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        const endTime = performance.now();
        const roundTripTime = endTime - startTime;
        
        if (!response.ok) return null;
        
        const data = await response.json();
        let serverTime;
        
        // 다양한 API 응답 형식 지원
        if (data.unixtime) {
            serverTime = data.unixtime * 1000;
        } else if (data.epoch) {
            serverTime = data.epoch * 1000;
        } else if (data.dateTime) {
            serverTime = new Date(data.dateTime).getTime();
        } else if (data.currentDateTime) {
            serverTime = new Date(data.currentDateTime).getTime();
        } else if (data.datetime) {
            serverTime = new Date(data.datetime).getTime();
        } else if (data.time_24) {
            // ipgeolocation.io 형식
            const dateStr = data.date + ' ' + data.time_24;
            serverTime = new Date(dateStr).getTime();
        } else if (data.utc_datetime) {
            serverTime = new Date(data.utc_datetime).getTime();
        } else {
            return null;
        }
        
        // 유효성 검사
        if (isNaN(serverTime) || serverTime <= 0) {
            return null;
        }
        
        // 왕복 시간의 절반을 보정
        return serverTime + (roundTripTime / 2);
    } catch (error) {
        // 네트워크 오류나 타임아웃은 무시
        return null;
    }
}

// 헤더에서 서버 시간 가져오기
async function fetchServerTimeFromHeaders() {
    try {
        const startTime = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(window.location.href, { 
            method: 'HEAD',
            cache: 'no-store',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const endTime = performance.now();
        const roundTripTime = endTime - startTime;
        
        const dateHeader = response.headers.get('Date');
        if (!dateHeader) return null;
        
        const serverTime = new Date(dateHeader).getTime();
        if (isNaN(serverTime) || serverTime <= 0) return null;
        
        return serverTime + (roundTripTime / 2);
    } catch (error) {
        return null;
    }
}

// NTP 서버에서 시간 가져오기 (간단한 HTTP 기반)
async function fetchServerTimeFromNTP() {
    try {
        // NTP 웹 서비스 사용
        const startTime = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        // 간단한 타임스탬프 서비스
        const response = await fetch('https://www.timeapi.io/api/Time/current/zone?timeZone=Asia/Seoul', {
            cache: 'no-store',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const endTime = performance.now();
        const roundTripTime = endTime - startTime;
        
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.dateTime) {
            const serverTime = new Date(data.dateTime).getTime();
            if (isNaN(serverTime) || serverTime <= 0) return null;
            return serverTime + (roundTripTime / 2);
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

// 서버 시간 업데이트 시작
function startServerTimeUpdate() {
    if (serverTimeInterval) {
        clearInterval(serverTimeInterval);
    }
    
    serverTimeInterval = setInterval(() => {
        updateServerTimeDisplay();
        updatePlatformTimes();
    }, 10); // 10ms마다 업데이트 (밀리초 표시)
}

// 서버 시간 표시 업데이트
function updateServerTimeDisplay() {
    const now = Date.now();
    let displayTime;
    
    // 선택된 시간 소스에 따라 표시할 시간 결정
    if (currentTimeSource === 'server') {
        displayTime = now + serverTimeOffset;
    } else if (currentTimeSource === 'melon' || currentTimeSource === 'interpark' || 
               currentTimeSource === 'naver' || currentTimeSource === 'yes24') {
        const platformServerTime = platformServerTimes[currentTimeSource];
        const syncTime = platformSyncTimes[currentTimeSource];
        const timeSinceSync = now - syncTime;
        
        if (platformServerTime !== null && timeSinceSync < 120000) {
            // 실제 서버 시간 사용
            displayTime = now + platformServerTime;
        } else {
            // 기본 보정값 사용
            const serverTime = now + serverTimeOffset;
            displayTime = serverTime + (platformOffsets[currentTimeSource] * 1000);
        }
    } else {
        // 기본값: 서버 시간
        displayTime = now + serverTimeOffset;
    }
    
    const date = new Date(displayTime);
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    
    const hoursEl = document.getElementById('timeHours');
    const minutesEl = document.getElementById('timeMinutes');
    const secondsEl = document.getElementById('timeSeconds');
    const millisecondsEl = document.getElementById('timeMilliseconds');
    
    if (hoursEl) hoursEl.textContent = hours;
    if (minutesEl) minutesEl.textContent = minutes;
    if (secondsEl) secondsEl.textContent = seconds;
    if (millisecondsEl) millisecondsEl.textContent = milliseconds;
}

// 시간 소스 변경
function changeTimeSource() {
    const timeSourceSelect = document.getElementById('timeSourceSelect');
    if (timeSourceSelect) {
        currentTimeSource = timeSourceSelect.value;
        localStorage.setItem('timeSource', currentTimeSource);
        updateTimeSourceTitle();
    }
}

// 시간 소스에 따른 제목 업데이트
function updateTimeSourceTitle() {
    const titleEl = document.getElementById('serverTimeTitle');
    if (!titleEl) return;
    
    const sourceNames = {
        'server': '서버 시계 (KST)',
        'melon': '멜론 시계',
        'interpark': '인터파크 시계',
        'naver': '네이버 시계',
        'yes24': '예스24 시계'
    };
    
    const title = sourceNames[currentTimeSource] || '서버 시계 (KST)';
    titleEl.textContent = `🕐 ${title}`;
}


// 플랫폼 시간 업데이트 시작
function startPlatformTimeUpdate() {
    updatePlatformTimes();
    setInterval(updatePlatformTimes, 10);
}

// 티켓팅 사이트 서버 시간 가져오기 (HEAD 요청 + Date 헤더)
async function fetchPlatformServerTime(platformId) {
    const url = platformUrls[platformId];
    if (!url) return null;
    
    try {
        const startTime = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        // HEAD 요청으로 Date 헤더 가져오기
        const response = await fetch(url, {
            method: 'HEAD',
            cache: 'no-store',
            signal: controller.signal,
            credentials: 'omit'
        });
        
        clearTimeout(timeoutId);
        const endTime = performance.now();
        const roundTripTime = endTime - startTime;
        
        const dateHeader = response.headers.get('Date');
        if (!dateHeader) {
            return null;
        }
        
        // UTC 시간을 파싱
        const serverTimeUTC = new Date(dateHeader).getTime();
        if (isNaN(serverTimeUTC) || serverTimeUTC <= 0) {
            return null;
        }
        
        // KST로 변환 (UTC + 9시간)
        const serverTimeKST = serverTimeUTC + (9 * 60 * 60 * 1000);
        
        // RTT 보정 (왕복 시간의 절반을 더함)
        const correctedTime = serverTimeKST + (roundTripTime / 2);
        
        return correctedTime;
    } catch (error) {
        // CORS 오류나 네트워크 오류는 조용히 처리 (정상적인 상황)
        // CORS 제한, 네트워크 에러, DNS 에러 등은 예상된 실패이므로 로그 출력하지 않음
        return null;
    }
}

// 티켓팅 사이트 서버 시간 동기화
async function syncPlatformServerTimes() {
    const platforms = ['melon', 'interpark', 'naver', 'yes24'];
    const now = Date.now();
    
    // 병렬로 모든 플랫폼 서버 시간 가져오기 시도
    const promises = platforms.map(async (platformId) => {
        try {
            const serverTime = await fetchPlatformServerTime(platformId);
            if (serverTime && serverTime > 0) {
                // 클라이언트 시간 기준으로 오프셋 저장
                platformServerTimes[platformId] = serverTime - now;
                platformSyncTimes[platformId] = now;
            } else {
                // 실패 시 기본 보정값 사용
                platformServerTimes[platformId] = null;
            }
        } catch (error) {
            platformServerTimes[platformId] = null;
        }
    });
    
    await Promise.allSettled(promises);
}

// 플랫폼별 시간 업데이트
function updatePlatformTimes() {
    const now = Date.now();
    const serverTime = now + serverTimeOffset;
    
    const platforms = [
        { id: 'melon', offset: platformOffsets.melon },
        { id: 'interpark', offset: platformOffsets.interpark },
        { id: 'naver', offset: platformOffsets.naver },
        { id: 'yes24', offset: platformOffsets.yes24 }
    ];
    
    platforms.forEach(platform => {
        let platformTime;
        let offsetText = '';
        let offsetValue = platform.offset;
        
        // 실제 서버 시간이 있으면 사용 (1분 이내 동기화된 것만)
        const platformServerTime = platformServerTimes[platform.id];
        const syncTime = platformSyncTimes[platform.id];
        const timeSinceSync = now - syncTime;
        
        if (platformServerTime !== null && timeSinceSync < 120000) { // 2분 이내
            // 실제 서버 시간 사용
            const actualServerTime = now + platformServerTime;
            platformTime = new Date(actualServerTime);
            
            // KST 기준 오차 계산 (실제 서버 시간 - KST 서버 시간)
            const kstServerTime = now + serverTimeOffset;
            const actualOffset = (actualServerTime - kstServerTime) / 1000;
            offsetValue = actualOffset;
            offsetText = `${actualOffset >= 0 ? '+' : ''}${actualOffset.toFixed(3)}초 (KST 대비)`;
        } else {
            // 기본 보정값 사용 (KST 기준)
            platformTime = new Date(serverTime + (platform.offset * 1000));
            offsetText = `${platform.offset >= 0 ? '+' : ''}${platform.offset}초 (KST 대비)`;
        }
        
        const hours = String(platformTime.getHours()).padStart(2, '0');
        const minutes = String(platformTime.getMinutes()).padStart(2, '0');
        const seconds = String(platformTime.getSeconds()).padStart(2, '0');
        const milliseconds = String(platformTime.getMilliseconds()).padStart(3, '0');
        
        const timeEl = document.getElementById(`${platform.id}Time`);
        const offsetEl = document.getElementById(`${platform.id}Offset`);
        
        if (timeEl) {
            timeEl.textContent = `${hours}:${minutes}:${seconds}.${milliseconds}`;
        }
        
        if (offsetEl) {
            offsetEl.textContent = offsetText;
            offsetEl.className = `platform-offset ${offsetValue >= 0 ? 'positive' : 'negative'}`;
        }
    });
}

// 정확도 측정
async function measureAccuracy() {
    const deviceErrorEl = document.getElementById('deviceError');
    const currentPingEl = document.getElementById('currentPing');
    const recommendedNetworkEl = document.getElementById('recommendedNetwork');
    
    if (deviceErrorEl) deviceErrorEl.textContent = '측정 중...';
    if (currentPingEl) currentPingEl.textContent = '측정 중...';
    if (recommendedNetworkEl) recommendedNetworkEl.textContent = '측정 중...';
    
    try {
        // Ping 측정
        const pingResults = [];
        for (let i = 0; i < 5; i++) {
            const startTime = performance.now();
            await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
            const endTime = performance.now();
            pingResults.push(endTime - startTime);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const avgPing = pingResults.reduce((sum, p) => sum + p, 0) / pingResults.length;
        const minPing = Math.min(...pingResults);
        const maxPing = Math.max(...pingResults);
        
        // 오차 계산 (ping의 절반 + 클라이언트 시간 오차)
        const estimatedError = (avgPing / 2) + Math.abs(serverTimeOffset);
        const errorSeconds = estimatedError / 1000;
        
        // 결과 표시
        if (deviceErrorEl) {
            deviceErrorEl.textContent = `±${errorSeconds.toFixed(3)}초`;
            if (errorSeconds < 0.1) {
                deviceErrorEl.className = 'accuracy-value good';
            } else if (errorSeconds < 0.5) {
                deviceErrorEl.className = 'accuracy-value warning';
            } else {
                deviceErrorEl.className = 'accuracy-value bad';
            }
        }
        
        if (currentPingEl) {
            currentPingEl.textContent = `${avgPing.toFixed(0)}ms (${minPing.toFixed(0)}-${maxPing.toFixed(0)}ms)`;
            if (avgPing < 50) {
                currentPingEl.className = 'accuracy-value good';
            } else if (avgPing < 100) {
                currentPingEl.className = 'accuracy-value warning';
            } else {
                currentPingEl.className = 'accuracy-value bad';
            }
        }
        
        if (recommendedNetworkEl) {
            if (avgPing < 30) {
                recommendedNetworkEl.textContent = 'WiFi 5GHz (최적)';
                recommendedNetworkEl.className = 'accuracy-value good';
            } else if (avgPing < 80) {
                recommendedNetworkEl.textContent = 'WiFi 5GHz / LTE (양호)';
                recommendedNetworkEl.className = 'accuracy-value warning';
            } else {
                recommendedNetworkEl.textContent = 'LTE / WiFi 2.4GHz (재연결 권장)';
                recommendedNetworkEl.className = 'accuracy-value bad';
            }
        }
        
    } catch (error) {
        console.error('정확도 측정 실패:', error);
        if (deviceErrorEl) deviceErrorEl.textContent = '측정 실패';
        if (currentPingEl) currentPingEl.textContent = '측정 실패';
        if (recommendedNetworkEl) recommendedNetworkEl.textContent = '측정 실패';
    }
}

// 카운트다운 시작
function startCountdown() {
    const countdownDateInput = document.getElementById('countdownDate');
    const countdownTimeInput = document.getElementById('countdownTime');
    const countdownMainEl = document.getElementById('countdownMain');
    const countdownLabelEl = document.getElementById('countdownLabel');
    
    if (!countdownDateInput || !countdownTimeInput) return;
    
    const dateStr = countdownDateInput.value;
    const timeStr = countdownTimeInput.value || '00:00';
    
    if (!dateStr) {
        alert('티켓팅 날짜를 선택해주세요.');
        return;
    }
    
    const targetDateTime = new Date(`${dateStr}T${timeStr}:00`);
    const targetTime = targetDateTime.getTime();
    
    if (isNaN(targetTime)) {
        alert('올바른 날짜와 시간을 입력해주세요.');
        return;
    }
    
    // 기존 카운트다운 정리
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    // 카운트다운 업데이트
    function updateCountdown() {
        const now = Date.now() + serverTimeOffset;
        const diff = targetTime - now;
        
        if (diff <= 0) {
            if (countdownMainEl) {
                countdownMainEl.textContent = '00시간 00분 00초';
                countdownMainEl.className = 'countdown-main danger';
            }
            if (countdownLabelEl) {
                countdownLabelEl.textContent = '티켓팅 시간입니다! 🎫';
            }
            clearInterval(countdownInterval);
            return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        const milliseconds = Math.floor((diff % 1000));
        
        const hoursStr = String(hours).padStart(2, '0');
        const minutesStr = String(minutes).padStart(2, '0');
        const secondsStr = String(seconds).padStart(2, '0');
        const millisecondsStr = String(milliseconds).padStart(3, '0');
        
        if (countdownMainEl) {
            countdownMainEl.textContent = `${hoursStr}시간 ${minutesStr}분 ${secondsStr}초`;
            
            // 10초 이하일 때 빨간색, 1분 이하일 때 노란색
            if (diff < 10000) {
                countdownMainEl.className = 'countdown-main danger';
            } else if (diff < 60000) {
                countdownMainEl.className = 'countdown-main warning';
            } else {
                countdownMainEl.className = 'countdown-main';
            }
        }
        
        if (countdownLabelEl) {
            const targetDateStr = formatDateKorean(targetDateTime);
            countdownLabelEl.textContent = `${targetDateStr} ${timeStr}까지`;
        }
        
        // 공유 버튼 표시
        const shareButtons = document.getElementById('countdownShareButtons');
        if (shareButtons) {
            shareButtons.style.display = 'flex';
        }
    }
    
    // 즉시 업데이트
    updateCountdown();
    
    // 10ms마다 업데이트
    countdownInterval = setInterval(updateCountdown, 10);
    
    // 전역 변수에 카운트다운 정보 저장 (공유용)
    window.countdownInfo = {
        date: dateStr,
        time: timeStr,
        targetTime: targetTime
    };
}

// 카운트다운 카카오톡 공유
function shareCountdownToKakao() {
    if (!window.countdownInfo) {
        alert('카운트다운을 먼저 시작해주세요.');
        return;
    }
    
    const { date, time, targetTime } = window.countdownInfo;
    const now = Date.now() + serverTimeOffset;
    const diff = targetTime - now;
    
    if (diff <= 0) {
        alert('티켓팅 시간이 지났습니다.');
        return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    const secondsStr = String(seconds).padStart(2, '0');
    
    const countdownText = `${hoursStr}시간 ${minutesStr}분 ${secondsStr}초`;
    const targetDate = new Date(`${date}T${time}:00`);
    const dateStr = formatDateKorean(targetDate);
    
    const shareText = `⏳ 티켓팅 카운트다운\n\n${dateStr} ${time}까지\n남은 시간: ${countdownText}\n\n예매는타이밍으로 정확한 시간 확인! 🎫`;
    
    if (navigator.share) {
        navigator.share({
            title: '티켓팅 카운트다운',
            text: shareText,
            url: window.location.href
        }).catch(err => {
            console.log('공유 실패:', err);
            copyToClipboard(shareText);
            alert('텍스트가 클립보드에 복사되었습니다!');
        });
    } else {
        copyToClipboard(shareText);
        alert('텍스트가 클립보드에 복사되었습니다! 카카오톡에서 공유해주세요.');
    }
}

// 카운트다운 인스타그램 공유
function shareCountdownToInstagram() {
    if (!window.countdownInfo) {
        alert('카운트다운을 먼저 시작해주세요.');
        return;
    }
    
    const { date, time, targetTime } = window.countdownInfo;
    const now = Date.now() + serverTimeOffset;
    const diff = targetTime - now;
    
    if (diff <= 0) {
        alert('티켓팅 시간이 지났습니다.');
        return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    const secondsStr = String(seconds).padStart(2, '0');
    
    const countdownText = `${hoursStr}시간 ${minutesStr}분 ${secondsStr}초`;
    const targetDate = new Date(`${date}T${time}:00`);
    const dateStr = formatDateKorean(targetDate);
    
    const shareText = `⏳ 티켓팅 카운트다운\n\n${dateStr} ${time}까지\n남은 시간: ${countdownText}\n\n예매는타이밍으로 정확한 시간 확인! 🎫\n${window.location.href}`;
    
    // 클립보드에 복사
    copyToClipboard(shareText).then(() => {
        // 모바일에서는 인스타그램 앱 열기 시도
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
            // 인스타그램 앱 열기 시도
            const instagramAppUrl = 'instagram://';
            const instagramWebUrl = 'https://www.instagram.com/';
            
            // 앱이 설치되어 있으면 앱 열기, 없으면 웹 열기
            window.location.href = instagramAppUrl;
            
            // 2초 후에도 페이지가 그대로면 웹으로 이동
            setTimeout(() => {
                if (document.hasFocus()) {
                    window.open(instagramWebUrl, '_blank');
                }
            }, 2000);
            
            alert('텍스트가 클립보드에 복사되었습니다!\n인스타그램 앱이 열리면 스토리나 게시물에 붙여넣어 공유해주세요.');
        } else {
            // 데스크톱에서는 인스타그램 웹 열기
            window.open('https://www.instagram.com/', '_blank');
            alert('텍스트가 클립보드에 복사되었습니다!\n인스타그램 웹이 열리면 스토리나 게시물에 붙여넣어 공유해주세요.');
        }
    }).catch(() => {
        alert('복사에 실패했습니다. 다시 시도해주세요.');
    });
}

// 카운트다운 복사하기
function copyCountdown() {
    if (!window.countdownInfo) {
        alert('카운트다운을 먼저 시작해주세요.');
        return;
    }
    
    const { date, time, targetTime } = window.countdownInfo;
    const now = Date.now() + serverTimeOffset;
    const diff = targetTime - now;
    
    if (diff <= 0) {
        alert('티켓팅 시간이 지났습니다.');
        return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    const secondsStr = String(seconds).padStart(2, '0');
    
    const countdownText = `${hoursStr}시간 ${minutesStr}분 ${secondsStr}초`;
    const targetDate = new Date(`${date}T${time}:00`);
    const dateStr = formatDateKorean(targetDate);
    
    const shareText = `⏳ 티켓팅 카운트다운\n\n${dateStr} ${time}까지\n남은 시간: ${countdownText}\n\n예매는타이밍으로 정확한 시간 확인! 🎫\n${window.location.href}`;
    
    copyToClipboard(shareText).then(() => {
        alert('카운트다운 정보가 클립보드에 복사되었습니다!');
    }).catch(() => {
        alert('복사에 실패했습니다. 다시 시도해주세요.');
    });
}

// 클립보드에 복사 (Promise 반환)
function copyToClipboard(text) {
    return new Promise((resolve, reject) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                resolve();
            }).catch(err => {
                console.error('클립보드 복사 실패:', err);
                try {
                    fallbackCopyToClipboard(text);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        } else {
            try {
                fallbackCopyToClipboard(text);
                resolve();
            } catch (e) {
                reject(e);
            }
        }
    });
}

// 클립보드 복사 폴백
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('클립보드 복사 실패:', err);
    }
    document.body.removeChild(textArea);
}

// 전체화면 모드 토글
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            document.body.classList.add('fullscreen-mode');
            const btn = document.getElementById('fullscreenBtn');
            if (btn) btn.textContent = '🚪 전체화면 종료';
            
            // 서버 시계 섹션만 표시
            const serverTimeSection = document.querySelector('.server-time-section');
            if (serverTimeSection) {
                serverTimeSection.scrollIntoView({ behavior: 'smooth' });
            }
        }).catch(err => {
            console.error('전체화면 실패:', err);
        });
    } else {
        document.exitFullscreen().then(() => {
            document.body.classList.remove('fullscreen-mode');
            const btn = document.getElementById('fullscreenBtn');
            if (btn) btn.textContent = '📺 전체화면';
        });
    }
}

// 자동 전체화면 (3초 후) - 더 이상 사용하지 않음
// function startAutoFullscreen() {
//     if (autoFullscreenTimer) {
//         clearTimeout(autoFullscreenTimer);
//     }
//     
//     autoFullscreenTimer = setTimeout(() => {
//         toggleFullscreen();
//     }, 3000);
// }

// 암전 모드 토글
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('darkModeBtn');
    if (btn) {
        if (document.body.classList.contains('dark-mode')) {
            btn.textContent = '☀️ 일반 모드';
        } else {
            btn.textContent = '🌙 암전 모드';
        }
    }
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// 위젯 모드 토글
function toggleWidgetMode() {
    const isWidgetMode = document.body.classList.contains('widget-mode');
    
    if (isWidgetMode) {
        // 위젯 모드 해제
        document.body.classList.remove('widget-mode');
        const btn = document.getElementById('widgetBtn');
        if (btn) btn.textContent = '📱 위젯 모드';
        
        // body 스타일 초기화
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.right = '';
        document.body.style.left = '';
        document.body.style.bottom = '';
        document.body.style.width = '';
        document.body.style.height = '';
        
        // 전체화면 모드도 해제
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    } else {
        // 위젯 모드 활성화
        document.body.classList.add('widget-mode');
        const btn = document.getElementById('widgetBtn');
        if (btn) btn.textContent = '❌ 위젯 종료';
        
        // 전체화면 모드는 해제
        if (document.fullscreenElement) {
            document.exitFullscreen();
            document.body.classList.remove('fullscreen-mode');
        }
    }
    
    localStorage.setItem('widgetMode', !isWidgetMode);
}

// 체크리스트 로드
function loadChecklist() {
    const saved = localStorage.getItem('ticketingChecklist');
    if (!saved) {
        // 저장된 데이터가 없어도 완료 확인은 해야 함
        setTimeout(() => {
            checkChecklistComplete();
        }, 200);
        return;
    }
    
    try {
        const checklist = JSON.parse(saved);
        const checklistSection = document.querySelector('.checklist-section');
        if (!checklistSection) {
            setTimeout(() => {
                checkChecklistComplete();
            }, 200);
            return;
        }
        
        const checkboxes = checklistSection.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((checkbox, index) => {
            if (checklist[index] !== undefined) {
                checkbox.checked = checklist[index];
            }
        });
        
        // 로드 후 완료 확인 (충분한 지연)
        setTimeout(() => {
            checkChecklistComplete();
        }, 200);
    } catch (error) {
        console.error('체크리스트 로드 실패:', error);
        setTimeout(() => {
            checkChecklistComplete();
        }, 200);
    }
}

// 체크리스트 저장
function saveChecklist() {
    const checklistSection = document.querySelector('.checklist-section');
    if (!checklistSection) return;
    
    const checkboxes = checklistSection.querySelectorAll('input[type="checkbox"]');
    const checklist = Array.from(checkboxes).map(checkbox => checkbox.checked);
    localStorage.setItem('ticketingChecklist', JSON.stringify(checklist));
}

// 체크리스트 완료 멘트 배열
const checklistCompleteMessages = [
    '🎉 행운을 빕니다! 티켓팅 성공하세요!',
    '✨ 모든 준비 완료! 이번엔 꼭 성공할 거예요!',
    '🚀 완벽한 준비! 티켓팅 대박 나세요!',
    '💪 모든 체크 완료! 당신의 티켓팅을 응원합니다!',
    '🎫 준비 끝! 이제 티켓팅만 하면 됩니다!',
    '🌟 완벽한 준비! 좋은 결과 있으시길!',
    '🔥 모든 준비 완료! 티켓팅 화이팅!',
    '💯 완벽합니다! 티켓팅 성공 기원합니다!',
    '🎊 준비 완료! 행운이 함께하길!',
    '⭐ 모든 체크 완료! 티켓팅 대박 나세요!',
    '🎁 완벽한 준비! 좋은 결과 기대합니다!',
    '🌈 모든 준비 끝! 티켓팅 성공하세요!',
    '🎯 완벽합니다! 이번엔 꼭 성공할 거예요!',
    '💎 모든 체크 완료! 티켓팅 화이팅!',
    '🎪 준비 끝! 행운을 빕니다!',
    '🏆 완벽한 준비! 티켓팅 대박 나세요!',
    '🎨 모든 준비 완료! 좋은 결과 있으시길!',
    '🎭 완벽합니다! 티켓팅 성공 기원합니다!',
    '🎬 준비 끝! 이제 티켓팅만 하면 됩니다!',
    '🎸 모든 체크 완료! 티켓팅 화이팅!'
];

// 체크리스트 완료 확인
function checkChecklistComplete() {
    // 체크리스트 섹션 내의 모든 체크박스 찾기
    const checklistSection = document.querySelector('.checklist-section');
    if (!checklistSection) {
        console.error('체크리스트 섹션을 찾을 수 없습니다.');
        return;
    }
    
    const checkboxes = checklistSection.querySelectorAll('input[type="checkbox"]');
    
    if (checkboxes.length === 0) {
        console.warn('체크박스를 찾을 수 없습니다.');
        return;
    }
    
    // 모든 체크박스가 체크되었는지 확인
    const checkboxArray = Array.from(checkboxes);
    const allChecked = checkboxArray.length > 0 && checkboxArray.every(checkbox => checkbox.checked);
    
    const messageEl = document.getElementById('checklistCompleteMessage');
    const messageTextEl = document.getElementById('completeMessageText');
    
    if (!messageEl || !messageTextEl) {
        return;
    }
    
    // 모든 체크박스가 체크되었는지 확인
    if (allChecked && checkboxArray.length > 0) {
        // 랜덤 멘트 선택
        const randomMessage = checklistCompleteMessages[Math.floor(Math.random() * checklistCompleteMessages.length)];
        messageTextEl.textContent = randomMessage;
        
        // 직접 스타일 설정으로 표시
        messageEl.style.display = 'block';
        messageEl.style.opacity = '1';
        messageEl.classList.add('show');
    } else {
        // 숨김 처리
        messageEl.style.display = 'none';
        messageEl.style.opacity = '0';
        messageEl.classList.remove('show');
        messageTextEl.textContent = '';
    }
}

// 체크리스트 리스너 설정
function setupChecklistListeners() {
    const checklistSection = document.querySelector('.checklist-section');
    if (!checklistSection) {
        console.error('체크리스트 섹션을 찾을 수 없습니다.');
        return;
    }
    
    // 이벤트 위임으로 모든 체크박스에 리스너 추가
    checklistSection.addEventListener('change', (event) => {
        const target = event.target;
        if (!target || !target.matches('input[type="checkbox"]')) return;

        saveChecklist();
        // 약간의 지연을 두고 확인 (상태 업데이트 후)
        setTimeout(() => {
            checkChecklistComplete();
        }, 10);
    });

    // 클릭 이벤트도 추가 (label 클릭 시에도 동작)
    checklistSection.addEventListener('click', (event) => {
        const target = event.target;
        if (target && target.matches('input[type="checkbox"]')) {
            setTimeout(() => {
                saveChecklist();
                checkChecklistComplete();
            }, 10);
        }
    });

    // 초기 로드 시에도 확인 (체크리스트 로드 후)
    setTimeout(() => {
        checkChecklistComplete();
    }, 300);
}
