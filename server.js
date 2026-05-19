const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// JSON 파일 데이터베이스 경로 설정
const USER_DB_PATH = path.join(__dirname, 'users.json');

// 파일 DB 초기화 및 안전성 검증
if (!fs.existsSync(USER_DB_PATH)) {
    fs.writeFileSync(USER_DB_PATH, JSON.stringify([], null, 4), 'utf8');
}

// 파일에서 유저 목록 읽어오기 Helper
function readUsersFromFile() {
    try {
        const data = fs.readFileSync(USER_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

// 파일에 유저 목록 저장하기 Helper
function writeUsersToFile(users) {
    fs.writeFileSync(USER_DB_PATH, JSON.stringify(users, null, 4), 'utf8');
}

// 비밀번호 암호화 유틸리티 (PBKDF2)
function hashPassword(password, salt = null) {
    const currentSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, currentSalt, 1000, 64, 'sha512').toString('hex');
    return { salt: currentSalt, hash };
}

// 세션 상태 관리 (실제 쿠키 세션 대용 인메모리 관리 체계)
let sessionState = {
    isLoggedIn: false,
    uid: null,
    nickname: null,
    role: "GUEST"
};

// 미들웨어 바인딩: 모든 페이지 템플릿에 세션 전송
app.use((req, res, next) => {
    res.locals.session = sessionState;
    next();
});

// 더미 콘텐츠용 데이터베이스
const contentDatabase = {
    feeds: [
        { id: 1, type: "사육기", author: "벅스마스터", title: "체장 85mm 왕사슴벌레 작출 성공기!", content: "균사 3병 째에 엄청난 무게를 보여주더니 결국 벽을 넘었습니다...", likes: 142 },
        { id: 2, type: "채집기", author: "인섹트헌터", title: "가평 깊은 산속 등화채집 현황", content: "현재 가로등 밑에서 사슴벌레 암컷 두 마리와 장수풍뎅이 한 마리 발견!", likes: 98 }
    ],
    mapPins: [
        { id: 1, species: "사슴벌레", locName: "강원도 횡성군", time: "방금 전", finder: "자연지기" }
    ],
    marketItems: [
        { id: 101, title: "[분양] 왕사 극태 유충 1령 5두 일괄", price: 25000, seller: "김사육", status: "판매중", aiChecked: "안전인증", lineage: "독도혈통" }
    ]
};

// 메인 라우터
app.get('/', (req, res) => {
    res.render('home', { 
        stats: { users: readUsersFromFile().length + 1240, insectsCount: 3840, marketVolume: "99.9 %" },
        trendingFeeds: contentDatabase.feeds,
        recentPins: contentDatabase.mapPins,
        premiumGoods: contentDatabase.marketItems
    });
});

// [인증 1] 회원가입 API
app.post('/auth/register', (req, res) => {
    const { username, password, nickname, hint } = req.body;
    const users = readUsersFromFile();

    if (users.find(u => u.username === username)) {
        return res.json({ success: false, message: "이미 존재하는 아이디입니다." });
    }

    const cryptoData = hashPassword(password);
    const newUser = {
        username,
        salt: cryptoData.salt,
        passwordHash: cryptoData.hash,
        nickname,
        hint, // 패스워드 찾기용 질문 힌트 답변
        role: "MEMBER",
        registeredAt: new Date().toISOString()
    };

    users.push(newUser);
    writeUsersToFile(users);
    res.json({ success: true, message: "연구원 등록이 완료되었습니다. 로그인을 진행해 주세요!" });
});

// [인증 2] 로그인 API
app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    const users = readUsersFromFile();
    const user = users.find(u => u.username === username);

    if (!user) {
        return res.json({ success: false, message: "일치하는 회원 정보가 없습니다." });
    }

    const verify = hashPassword(password, user.salt);
    if (verify.hash !== user.passwordHash) {
        return res.json({ success: false, message: "비밀번호가 올바르지 않습니다." });
    }

    // 세션 활성화
    sessionState = {
        isLoggedIn: true,
        uid: user.username,
        nickname: user.nickname,
        role: user.role
    };

    res.json({ success: true, message: `${user.nickname} 연구원님, 환영합니다!` });
});

// [인증 3] 아이디/비밀번호 찾기 API (계정 정보 매칭 확인)
app.post('/auth/find', (req, res) => {
    const { username, hint } = req.body;
    const users = readUsersFromFile();
    const user = users.find(u => u.username === username);

    if (!user) {
        return res.json({ success: false, message: "존재하지 않는 가입 아이디입니다." });
    }

    if (user.hint !== hint) {
        return res.json({ success: false, message: "등록된 비밀번호 힌트 답변과 일치하지 않습니다." });
    }

    // 데모 환경 보안 정책상 가시적 가상 비밀번호 초기화 패스워드 제공
    res.json({ success: true, message: `계정 무결성이 확인되었습니다. 임시 패스워드는 [ hexatopia123! ] 입니다. 로그인 후 변경해 주세요.` });
});

// [인증 4] 로그아웃 API
app.get('/auth/logout', (req, res) => {
    sessionState = { isLoggedIn: false, uid: null, nickname: null, role: "GUEST" };
    res.redirect('/');
});

// [인증 5] 회원 탈퇴 API
app.post('/auth/withdraw', (req, res) => {
    if (!sessionState.isLoggedIn) {
        return res.json({ success: false, message: "로그인된 상태에서만 탈퇴가 가능합니다." });
    }

    let users = readUsersFromFile();
    const beforeLength = users.length;
    users = users.filter(u => u.username !== sessionState.uid);

    if (users.length === beforeLength) {
        return res.json({ success: false, message: "회원 탈퇴 처리 중 오류가 발생했거나 대상 유저를 찾지 못했습니다." });
    }

    writeUsersToFile(users);
    // 세션 파괴 및 초기화
    sessionState = { isLoggedIn: false, uid: null, nickname: null, role: "GUEST" };
    res.json({ success: true, message: "그동안 Hexatopia 플랫폼을 이용해 주셔서 감사합니다. 회원 탈퇴 정보가 파기되었습니다." });
});

// 가상 auth 복구 라우트 (기존 연동용)
app.get('/toggle-auth', (req, res) => { res.redirect('/'); });

// 기타 서브 라우트 더미 처리 연동
app.get('/feed', (req, res) => res.render('home', { stats: { users: 1200, insectsCount: 3000, marketVolume: "99%" }, trendingFeeds: [], recentPins: [], premiumGoods: [] }));
app.get('/map', (req, res) => res.redirect('/'));
app.get('/forum', (req, res) => res.redirect('/'));
app.get('/market', (req, res) => res.redirect('/'));
app.get('/mypage', (req, res) => res.redirect('/'));
app.get('/admin', (req, res) => res.redirect('/'));

app.listen(PORT, () => {
    console.log(`Hexatopia 가동 중 : http://localhost:${PORT}`);
});
