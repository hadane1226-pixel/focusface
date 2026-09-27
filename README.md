# 포커스 페이스 · 초보자를 위한 포커 입문

GitHub Pages로 무료 배포하는 정적 사이트다.

## 폴더 구성
- `index.html` : 사이트 본체 (단일 파일, 그대로 배포됨)
- `포커입문블로그_기획.md` : 원본 기획/초안 문서
- `images/` : GTOWizard 캡쳐 등 이미지 넣는 곳
  - `allin-equity.png` (4장 올인 승률표)
  - `range-advantage.png` (10장 보드 예시)

## GitHub Pages 배포 5단계
1. GitHub에서 새 repository 생성 (예: `focusface`). Public으로.
2. 이 폴더의 파일들(`index.html`, `images/` 등)을 그 repo에 업로드하거나 push.
3. repo의 **Settings → Pages** 로 이동.
4. **Source**를 `Deploy from a branch`, 브랜치를 `main`, 폴더를 `/root`로 지정하고 Save.
5. 1~2분 뒤 `https://<아이디>.github.io/focusface/` 주소로 접속.

## 이미지 교체
- `images/` 에 캡쳐를 넣고 파일명을 위와 맞추면 됨.
- GTOWizard 캡쳐를 쓸 땐 본문/푸터에 출처 표기 유지.
