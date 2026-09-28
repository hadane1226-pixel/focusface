# 포커스 페이스 · 포커 학습 사이트

GitHub Pages로 무료 배포하는 정적 사이트다. 빌드 과정 없이 push하면 바로 반영된다.

## 폴더 구성
- `index.html` : 메인 화면. 각 탭을 소개하고 이동한다.
- `intro/index.html` : 탭 1, 초보자를 위한 포커 입문 블로그
- `train/` : 탭 2, 오픈 훈련하기
  - `index.html`, `train.js` : 핸드 퀴즈 · 차트 보기/편집 · 칠하기 시험
  - `ranges.js` : 오픈 레인지 데이터 (스택 100/80/60/50/40/30/25/20/15bb × 포지션 UTG~SB)
- `assets/site.css` : 메인·훈련 페이지 공통 스타일
- `tools/gen-ranges.mjs` : 학습용 근사 레인지 생성기
- `images/` : GTOWizard 캡쳐 등 이미지 넣는 곳
  - `allin-equity.png` (입문 4장 올인 승률표)
  - `range-advantage.png` (입문 10장 보드 예시)

## 오픈 레인지 데이터
현재 `train/ranges.js`는 **학습용 근사치**다 (solver 결과 아님). 실제 차트로 바꾸는 방법:
1. 오픈 훈련 → **차트 보기**에서 스택·포지션을 고르고 **편집**을 켠다.
2. 보고 있는 차트(GTOWizard 등)를 보며 칸을 칠한다. 수정은 브라우저에 자동 저장된다.
3. **ranges.js 내보내기**로 받은 파일로 `train/ranges.js`를 교체하고 push한다.

형식: `window.RANGES.spots[스택][포지션][핸드] = "R" | "A" | {"R":0.6,"F":0.4}` (없으면 폴드).

근사 데이터를 다시 만들려면:
```bash
node tools/gen-ranges.mjs > train/ranges.js
```

## 이미지 교체
- `images/` 에 캡쳐를 넣고 파일명을 위와 맞추면 됨.
- GTOWizard 캡쳐를 쓸 땐 본문/푸터에 출처 표기 유지.
