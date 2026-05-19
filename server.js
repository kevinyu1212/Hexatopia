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

// 가상 임시 인메모리 데이터베이스 (각 페이지 간 유기적 연결용)
const database = {
    feeds: [
        { id: 1, type: "사육기", author: "충왕99", title: "왕사슴벌레 균사 교체기", content: "첫병에서 28g 돌파했습니다!", image: "/images/sample_beetle.jpg", likes: 12 },
        { id: 2, type: "채집기", author: "자연인", title: "강원도 홍천 등화채집 다녀왔습니다", content: "넓적사슴벌레 다수 보고왔네요.", image: "/images/field.jpg", likes: 24 }
    ],
    breedingRecords: [
        { id: "B001", name: "왕사_극태_01라인", lineage: "독도혈통", generation: "CBF1", weight: "26.5g" }
    ],
    mapPins: [
        { id: 1, species: "장수풍뎅이", lat: 37.5665, lng: 126.9780, locName: "서울 남산 부근", verified: true }
    ],
    marketItems: [
        { id: 101, title: "[분양] 왕사슴벌레 유충 1령 5두 일괄", price: 25000, seller: "김사육", status: "판매중", aiChecked: "안전" }
    ],
    adminLogs: [
        { time: "방금 전", type: "AI 관제", desc: "마켓 스팸 게시글 1건 자동 차단 완료" }
    ]
};

// [Menu 1] 홈 페이지
app.get('/', (req, res) => {
    res.render('home', { stats: { users: 1240, insectsCount: 3840, marketVolume: "4.5M" } });
});

// [Menu 2] 피드 (인스타그램형 스타일 레이아웃)
app.get('/feed', (req, res) => {
    res.render('feed', { feeds: database.feeds });
});

// [Menu 3] 사육실 (대시보드 + AI 유전 분석)
app.get('/breeding', (req, res) => {
    res.render('breeding', { records: database.breedingRecords, aiAnalysis: null });
});

app.post('/breeding/analyze', (req, res) => {
    const { parentA_line, parentB_line } = req.body;
    const aiResult = AIService.analyzeBreedingRisk({ lineage: parentA_line }, { lineage: parentB_line });
    res.render('breeding', { records: database.breedingRecords, aiAnalysis: aiResult });
});

// [Menu 4] 곤충 지도 및 집단지성 AI 동정
app.get('/map', (req, res) => {
    res.render('map', { pins: database.mapPins, aiResult: null });
});

app.post('/map/ai-identify', async (req, res) => {
    const { imageUrl } = req.body;
    const aiResult = await AIService.identifyInsect(imageUrl || "sample_upload.jpg");
    res.render('map', { pins: database.mapPins, aiResult: aiResult });
});

// [Menu 5] 마켓 (AI 보안 필터링 적용)
app.get('/market', (req, res) => {
    res.render('market', { items: database.marketItems });
});

app.post('/market/write', (req, res) => {
    const { title, content, price } = req.body;
    const aiCheck = AIService.monitorMarketPost(title, content, Number(price));
    
    const newItem = {
        id: database.marketItems.length + 101,
        title,
        price: Number(price),
        seller: "현재유저",
        status: aiCheck.isSuspicious ? "보류(AI정지)" : "판매중",
        aiChecked: aiCheck.isSuspicious ? "의심매물 검측됨" : "안전인증"
    };
    database.marketItems.unshift(newItem);
    if(aiCheck.isSuspicious) {
        database.adminLogs.unshift({ time: "방금 전", type: "마켓경고", desc: `의심 거래 자동 블로킹: ${title}` });
    }
    res.redirect('/market');
});

// [Menu 6] 포럼 (Q&A 및 정보게시판)
app.get('/forum', (req, res) => {
    res.render('forum');
});

// [Menu 7] 관리자 페이지 (종합 통합 관제 대시보드)
app.get('/admin', (req, res) => {
    res.render('admin', { logs: database.adminLogs, dbSize: database });
});

app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(` Hexatopia 곤충 커뮤니티 엔진이 성공적으로 가동되었습니다.`);
    console.log(` 주소: http://localhost:${PORT}`);
    console.log(`================================================================`);
});
