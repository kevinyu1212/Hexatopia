const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 초기 세션 상태: 로그인하지 않은 상태 (게스트)
let currentUserSession = {
    isLoggedIn: false,
    uid: null,
    nickname: null,
    role: "GUEST"
};

app.use((req, res, next) => {
    res.locals.session = currentUserSession;
    next();
});

// 더미 데이터베이스 시스템
const database = {
    feeds: [
        { id: 1, type: "사육기", author: "벅스마스터", title: "체장 85mm 왕사슴벌레 작출 성공기!", content: "균사 3병 째에 엄청난 무게를 보여주더니 결국 벽을 넘었습니다...", likes: 142 },
        { id: 2, type: "채집기", author: "인섹트헌터", title: "가평 깊은 산속 등화채집 현황", content: "현재 가로등 밑에서 사슴벌레 암컷 두 마리와 장수풍뎅이 한 마리 발견!", likes: 98 },
        { id: 3, type: "갤러리", author: "표본의미학", title: "외국산 뮤엘러리 사슴벌레 표본 제작 완료", content: "영롱한 빛깔을 살리기 위해 건조에 신경 썼습니다.", likes: 75 }
    ],
    mapPins: [
        { id: 1, species: "사슴벌레", locName: "강원도 횡성군", time: "방금 전", finder: "자연지기" },
        { id: 2, species: "장수풍뎅이", locName: "경기도 남양주시", time: "10분 전", finder: "곤충소년" },
        { id: 3, species: "넓적사슴벌레", locName: "충청남도 천안시", time: "30분 전", finder: "채집이취미" }
    ],
    marketItems: [
        { id: 101, title: "[분양] 왕사 극태 유충 1령 5두 일괄", price: 25000, seller: "김사육", status: "판매중", aiChecked: "안전인증", lineage: "독도혈통" },
        { id: 102, title: "[분양] 체장형 왕사슴벌레 성충 한쌍", price: 60000, seller: "체장매니아", status: "판매중", aiChecked: "사육실연동", lineage: "극상체장" }
    ],
    userBreedingRoom: {
        records: [
            { id: "B-01", name: "왕사_극태_A라인", lineage: "독도혈통", generation: "CBF1", weight: "26.5g" },
            { id: "B-02", name: "홍다리_초대형_B라인", lineage: "강원 와일드", generation: "F1", weight: "4.2g" }
        ]
    }
};

// 실시간 대시보드 홈
app.get('/', (req, res) => {
    res.render('home', { 
        stats: { users: 1240, insectsCount: 3840, marketVolume: "4.5M" },
        trendingFeeds: database.feeds.slice(0, 3),
        recentPins: database.mapPins,
        premiumGoods: database.marketItems.slice(0, 2)
    });
});

// UI 테스트 편의성을 위한 가상 로그인/로그아웃 토글 스위치 라우터
app.get('/toggle-auth', (req, res) => {
    if (currentUserSession.isLoggedIn) {
        currentUserSession = { isLoggedIn: false, uid: null, nickname: null, role: "GUEST" };
    } else {
        currentUserSession = { isLoggedIn: true, uid: "user_hexaking", nickname: "유헥사곤", role: "MEMBER" };
    }
    res.redirect('back');
});

// 모든 서브 페이지 라우터 바인딩
app.get('/feed', (req, res) => res.render('feed', { feeds: database.feeds }));
app.get('/map', (req, res) => res.render('map', { pins: database.mapPins, aiResult: null }));
app.get('/forum', (req, res) => res.render('forum'));
app.get('/market', (req, res) => res.render('market', { items: database.marketItems }));
app.get('/mypage', (req, res) => res.render('mypage/dashboard', { profile: currentUserSession, postCount: 14, marketCount: 1 }));
app.get('/mypage/breeding', (req, res) => res.render('mypage/breeding_room', { records: database.userBreedingRoom.records, aiAnalysis: null }));
app.get('/admin', (req, res) => res.render('admin', { logs: [] }));

app.listen(PORT, () => {
    console.log(`Hexatopia 가동 중 : http://localhost:${PORT}`);
});
