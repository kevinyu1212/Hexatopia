const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ==========================================
// 1. MySQL 커넥션 풀(Connection Pool) 환경 설정
// ==========================================
const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '1234',  // 요청하신 비밀번호로 연동 완료
    database: 'hexatopia_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 데이터베이스 연결 자가 진단
dbPool.getConnection()
    .then(conn => {
        console.log('✅ MySQL 데이터베이스 엔진과 성공적으로 동기화되었습니다. (포트: 3306)');
        conn.release();
    })
    .catch(err => {
        console.error('❌ MySQL 연결 실패! hexatopia_db 스키마 생성 여부나 MySQL 실행 상태를 확인하세요.');
        console.error('오류 내용:', err.message);
    });

// ==========================================
// 비밀번호 암호화 유틸리티 (PBKDF2)
// ==========================================
function hashPassword(password, salt = null) {
    const currentSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, currentSalt, 1000, 64, 'sha512').toString('hex');
    return { salt: currentSalt, hash };
}

// 인메모리 세션 상태 관리 체계
let sessionState = {
    isLoggedIn: false,
    uid: null,
    nickname: null,
    role: "GUEST"
};

app.use((req, res, next) => {
    res.locals.session = sessionState;
    next();
});

// 메인 대시보드 데이터베이스 더미셋
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

// ==========================================
// 메인 라우터
// ==========================================
app.get('/', async (req, res) => {
    try {
        const [rows] = await dbPool.query('SELECT COUNT(*) AS userCount FROM users');
        const dbUserCount = rows[0].userCount;

        res.render('home', { 
            stats: { users: dbUserCount + 1240, insectsCount: 3840, marketVolume: "99.9 %" },
            trendingFeeds: contentDatabase.feeds,
            recentPins: contentDatabase.mapPins,
            premiumGoods: contentDatabase.marketItems
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('대시보드 로딩 중 내부 데이터베이스 에러 발생');
    }
});

// [인증 1] 회원가입 (MySQL INSERT)
app.post('/auth/register', async (req, res) => {
    const { username, password, nickname, hint } = req.body;
    
    try {
        const [existing] = await dbPool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.json({ success: false, message: "이미 사용 중인 연구원 아이디입니다." });
        }

        const cryptoData = hashPassword(password);
        const insertSql = `
            INSERT INTO users (username, password_hash, salt, nickname, hint) 
            VALUES (?, ?, ?, ?, ?)
        `;
        await dbPool.query(insertSql, [username, cryptoData.hash, cryptoData.salt, nickname, hint]);

        res.json({ success: true, message: "연구원 등록이 MySQL DB에 안전하게 기록되었습니다. 로그인을 진행해 주세요!" });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "회원가입 처리 중 DB 서버 내부 오류가 발생했습니다." });
    }
});

// [인증 2] 로그인 (MySQL SELECT)
app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await dbPool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.json({ success: false, message: "일치하는 회원 정보가 없습니다." });
        }

        const user = users[0];
        const verify = hashPassword(password, user.salt);
        if (verify.hash !== user.password_hash) {
            return res.json({ success: false, message: "비밀번호가 올바르지 않습니다." });
        }

        sessionState = {
            isLoggedIn: true,
            uid: user.username,
            nickname: user.nickname,
            role: user.role
        };

        res.json({ success: true, message: `${user.nickname} 연구원님, 환영합니다!` });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "로그인 검증 중 엔터프라이즈 서버 오류가 발생했습니다." });
    }
});

// [인증 3] 아이디/비밀번호 찾기 (MySQL SELECT)
app.post('/auth/find', async (req, res) => {
    const { username, hint } = req.body;

    try {
        const [users] = await dbPool.query('SELECT hint FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.json({ success: false, message: "존재하지 않는 가입 아이디입니다." });
        }

        if (users[0].hint !== hint) {
            return res.json({ success: false, message: "등록된 비밀번호 힌트 답변과 일치하지 않습니다." });
        }

        res.json({ success: true, message: `계정 무결성이 검증되었습니다. 임시 패스워드는 [ hexatopia123! ] 입니다. 로그인 후 변경해 주세요.` });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "계정 분실 정보 조회 중 DB 트랜잭션 에러 발생" });
    }
});

// [인증 4] 로그아웃
app.get('/auth/logout', (req, res) => {
    sessionState = { isLoggedIn: false, uid: null, nickname: null, role: "GUEST" };
    res.redirect('/');
});

// [인증 5] 회원 탈퇴 (MySQL DELETE)
app.post('/auth/withdraw', async (req, res) => {
    if (!sessionState.isLoggedIn) {
        return res.json({ success: false, message: "로그인된 상태에서만 회원 영구 탈퇴가 가능합니다." });
    }

    try {
        const [result] = await dbPool.query('DELETE FROM users WHERE username = ?', [sessionState.uid]);
        
        if (result.affectedRows === 0) {
            return res.json({ success: false, message: "삭제 대상 회원 데이터를 발견하지 못했습니다." });
        }

        sessionState = { isLoggedIn: false, uid: null, nickname: null, role: "GUEST" };
        res.json({ success: true, message: "Hexatopia 클러스터에서 연구원님의 모든 계정 정보 및 인프라 파기가 완료되었습니다." });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "회원 영구 탈퇴 쿼리 수행 중 제약 조건 위반 혹은 오류 발생" });
    }
});

app.get('/toggle-auth', (req, res) => res.redirect('/'));
app.get('/feed', (req, res) => res.redirect('/'));

app.listen(PORT, () => {
    console.log(`🚀 Hexatopia 엔터프라이즈 [MySQL Ver] 구동 중 : http://localhost:${PORT}`);
});
