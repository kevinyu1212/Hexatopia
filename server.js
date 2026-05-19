const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const AIService = require('./services/aiService');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 가상 세션 상태 (로그인 상태를 토글하며 테스트할 수 있도록 설계)
let currentUserSession = {
    isLoggedIn: true, // 테스트 편의성을 위해 기본 로그인 상태 활성화
    uid: "user_hexaking",
    nickname: "유헥사곤",
    role: "MEMBER" // MEMBER, ADMIN
};

// [보안 미들웨어] 비공개(Private) 페이지 접근 제한 및 가로채기 로직
function requireAuth(req, res, next) {
    if (!currentUserSession.isLoggedIn) {
        // 비공개 페이지 접근 시 접근 거부 및 홈으로 리다이렉트 유도 (알림 메시지 포함)
        return res.send('<script>alert("이 공간은 회원 전용 비공개 영역입니다. 로그인이 필요합니다."); location.href="/";</script>');
    }
    next();
}

// [보안 미들웨어] 최고 관리자 전용 관제탑 접근 검증
function requireAdmin(req, res, next) {
    if (!currentUserSession.isLoggedIn || currentUserSession.role !== 'ADMIN') {
        return res.send('<script>alert("경고: 관리자 외에는 접근할 수 없는 국가 보안 관제탑 구역입니다."); location.href="/";</script>');
    }
    next();
}

// 글로벌 템플릿 변수 주입 (내비게이션 바 상태 제어용)
app.use((req, res, next) => {
    res.locals.session = currentUserSession;
    next();
});

// 가상 통합 인메모리 데이터베이스
const database = {
    feeds: [
        { id: 1, type: "사육기", author: "충왕99", title: "왕사슴벌레 극태 균사 교체", content: "28g 유충 돌파 성공했습니다!", likes: 12 },
        { id: 2, type: "채집기", author: "자연인", title: "홍천 가로등 등화채집 결과", content: "넓적사슴벌레 다수 목격 완료.", likes: 24 }
    ],
    // 특정 회원에게만 은닉된 비밀 사육실 데이터베이스
    userBreedingRoom: {
        owner: "user_hexaking",
        records: [
            { id: "B-01", name: "왕사_극태_A라인", lineage: "독도혈통", generation: "CBF1", weight: "26.5g" },
            { id: "B-02", name: "홍다리_초대형_B라인", lineage: "강원 와일드", generation: "F1", weight: "4.2g" }
        ]
    },
    mapPins: [
        { id: 1, species: "장수풍뎅이", locName: "서울 남산 부근", verified: true }
    ],
    marketItems: [
        { id: 101, title: "[분양] 왕사 극태 유충 1령 5두", price: 25000, seller: "김사육", status: "판매중", aiChecked: "안전인증" }
    ],
    adminLogs: [
        { time: "방금 전", type: "인증 관제", desc: "비공개 영역 세션 트래픽 암호화 터널 수립" }
    ]
};

// ==========================================
// [1] 공개 구역 (Public Pages) - 누구나 접근 가능
// ==========================================
app.get('/', (req, res) => {
    res.render('home', { stats: { users: 1240, insectsCount: 3840, marketVolume: "4.5M" } });
});

// 테스트용: 세션 로그아웃/로그인 전환 스위칭 라우트
app.get('/toggle-auth', (req, res) => {
    currentUserSession.isLoggedIn = !currentUserSession.isLoggedIn;
    res.redirect('/');
});

app.get('/feed', (req, res) => {
    res.render('feed', { feeds: database.feeds });
});

app.get('/map', (req, res) => {
    res.render('map', { pins: database.mapPins, aiResult: null });
});

app.post('/map/ai-identify', async (req, res) => {
    const { imageUrl } = req.body;
    const aiResult = await AIService.identifyInsect(imageUrl || "sample.jpg");
    res.render('map', { pins: database.mapPins, aiResult: aiResult });
});

app.get('/forum', (req, res) => {
    res.render('forum');
});

// ==========================================
// [2] 비공개 구역 (Private Pages) - 로그인 필수인 마이페이지 & 마켓
// ==========================================

// [신설] 통합 마이페이지 대시보드 메인
app.get('/mypage', requireAuth, (req, res) => {
    res.render('mypage/dashboard', { 
        profile: currentUserSession,
        postCount: 14,
        marketCount: database.marketItems.filter(i => i.seller === currentUserSession.nickname).length
    });
});

// [이동] 마이페이지 예하 종속 구역으로 격리된 사육실 내부망
app.get('/mypage/breeding', requireAuth, (req, res) => {
    res.render('mypage/breeding_room', { 
        records: database.userBreedingRoom.records, 
        aiAnalysis: null 
    });
});

// 사육실 내 AI 가계도/근친 시뮬레이션 인터페이스 연동
app.post('/mypage/breeding/analyze', requireAuth, (req, res) => {
    const { parentA_line, parentB_line } = req.body;
    const aiResult = AIService.analyzeBreedingRisk({ lineage: parentA_line }, { lineage: parentB_line });
    res.render('mypage/breeding_room', { 
        records: database.userBreedingRoom.records, 
        aiAnalysis: aiResult 
    });
});

// 사육실 데이터를 마켓 게시판으로 유기적 즉시 전송(API 바인딩)하는 고도화 기능
app.post('/mypage/breeding/export-market', requireAuth, (req, res) => {
    const { recordId } = req.body;
    const selectedRecord = database.userBreedingRoom.records.find(r => r.id === recordId);
    
    if (selectedRecord) {
        const marketTitle = `[분양인증] ${selectedRecord.name} (${selectedRecord.generation}) 분양합니다.`;
        const marketContent = `내 사육실 가전 검증 데이터 개체: 혈통 [${selectedRecord.lineage}], 스펙 체중 [${selectedRecord.weight}] 안전 개체 분양 연동건입니다.`;
        
        database.marketItems.unshift({
            id: database.marketItems.length + 101,
            title: marketTitle,
            price: 30000,
            seller: currentUserSession.nickname,
            status: "판매중",
            aiChecked: "사육실 연동 인증완료"
        });
        database.adminLogs.unshift({ time: "방금 전", type: "사육실 연동", desc: `${currentUserSession.nickname}님이 사육실 개체를 마켓으로 다이렉트 전송` });
    }
    res.redirect('/market');
});

// 회원 간 거래 신뢰 보장을 보증하기 위해 비공개존으로 변경된 마켓
app.get('/market', requireAuth, (req, res) => {
    res.render('market', { items: database.marketItems });
});

app.post('/market/write', requireAuth, (req, res) => {
    const { title, content, price } = req.body;
    const aiCheck = AIService.monitorMarketPost(title, content, Number(price));
    
    const newItem = {
        id: database.marketItems.length + 101,
        title,
        price: Number(price),
        seller: currentUserSession.nickname,
        status: aiCheck.isSuspicious ? "보류(AI정지)" : "판매중",
        aiChecked: aiCheck.isSuspicious ? "의심매물 검측됨" : "안전인증"
    };
    database.marketItems.unshift(newItem);
    if(aiCheck.isSuspicious) {
        database.adminLogs.unshift({ time: "방금 전", type: "마켓경고", desc: `의심 거래 자동 블로킹: ${title}` });
    }
    res.redirect('/market');
});

// ==========================================
// [3] 관리자 구역 (Admin Area) - 최고 등급 필수
// ==========================================
app.get('/admin', requireAdmin, (req, res) => {
    res.render('admin', { logs: database.adminLogs });
});

app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(` Hexatopia 분리형 보안 엔진 시스템이 성공적으로 갱신되었습니다.`);
    console.log(` 주소 확인: http://localhost:${PORT}`);
    console.log(`================================================================`);
});
