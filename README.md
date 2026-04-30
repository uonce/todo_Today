# Daily Dashboard

노션 연동 데일리 대시보드

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
`.env.local.example` 파일을 `.env.local`로 복사하고 값 입력:

```bash
cp .env.local.example .env.local
```

`.env.local` 파일에 아래 값 입력:
```
NOTION_TOKEN=secret_xxx...       # 노션 API 키
TODO_DB_ID=xxx...                # To-do 데이터베이스 ID
DAILY_LOG_DB_ID=xxx...           # Daily Log 데이터베이스 ID
```

#### 노션 DB ID 찾는 방법
노션에서 해당 DB 페이지를 열고 URL에서 복사:
`https://notion.so/workspace/[여기가-DB-ID]?v=...`

### 3. 로컬 실행
```bash
npm run dev
```
→ http://localhost:3000

### 4. Vercel 배포

1. GitHub에 코드 업로드
2. vercel.com 접속 → Import Project
3. 환경변수 설정 (NOTION_TOKEN, TODO_DB_ID, DAILY_LOG_DB_ID)
4. Deploy!

## 기능
- 📅 캘린더 - 날짜 선택
- ✅ 오늘의 할일 - 체크 가능, 노션과 실시간 동기화
- 📝 오늘의 기록 - 클릭하면 노션 페이지 열림
- 📊 주간 달성도 - 완료율 표시
- 📚 기록 보기 - 이전 날짜 일기 모아보기
- 📱 모바일 반응형
